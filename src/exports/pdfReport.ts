import type { SimulationReport } from "../domain/simulationReport";

const encode = (value: string) => new TextEncoder().encode(value);
const joinBytes = (parts) => {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes;
};

// Browser-rendered pages preserve Korean without shipping a large font dependency.
export function pdfFromJpegs(images) {
  if (!images.length) throw new Error("PDF 페이지를 생성하지 못했습니다.");
  const objects = [null, encode("<< /Type /Catalog /Pages 2 0 R >>"), null];
  const pages = [];
  for (const image of images) {
    const pageId = objects.length, contentId = pageId + 1, imageId = pageId + 2;
    pages.push(`${pageId} 0 R`);
    objects.push(encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    const content = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
    objects.push(encode(`<< /Length ${encode(content).length} >>\nstream\n${content}endstream`));
    objects.push(joinBytes([encode(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`), image.bytes, encode("\nendstream")]));
  }
  objects[2] = encode(`<< /Type /Pages /Count ${images.length} /Kids [${pages.join(" ")}] >>`);
  const infoId = objects.length;
  objects.push(encode("<< /Title (ASTRA DEMO Simulation Report) /Author (ASTRA) /Producer (ASTRA browser exporter) >>"));
  const parts = [encode("%PDF-1.4\n%ASTRA\n")], offsets = [0];
  let offset = parts[0].length;
  for (let i = 1; i < objects.length; i++) {
    offsets.push(offset);
    const object = joinBytes([encode(`${i} 0 obj\n`), objects[i], encode("\nendobj\n")]);
    parts.push(object); offset += object.length;
  }
  const xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("");
  parts.push(encode(`${xref}trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return joinBytes(parts);
}

export async function createPdfReport(report: SimulationReport, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const sheets = report.sheets.filter((sheet) => sheet.name !== "원본 결과");
  if (sheets.reduce((n, sheet) => n + sheet.rows.length, 0) > 5000)
    throw new Error("PDF 보고서 범위가 큽니다. 전체 수치는 Excel 또는 CSV로 내려받아주세요.");
  await document.fonts?.ready;
  signal?.throwIfAborted();
  const width = 794, height = 1123, margin = 44, bottom = 1060, scale = 2;
  const font = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const images = [];
  let canvas, ctx, y;
  const text = (value, x, at, size = 12, color = "#243950", bold = false) => {
    ctx.font = `${bold ? "600" : "400"} ${size}px ${font}`;
    ctx.fillStyle = color; ctx.textBaseline = "top"; ctx.fillText(String(value), x, at);
  };
  const wrap = (value, maxWidth, size = 12) => {
    ctx.font = `400 ${size}px ${font}`;
    const lines = [];
    for (const paragraph of String(value ?? "").split(/\r?\n/)) {
      let line = "";
      for (const character of paragraph) {
        if (line && ctx.measureText(line + character).width > maxWidth) { lines.push(line); line = ""; }
        line += character;
      }
      lines.push(line);
    }
    return lines;
  };
  const flush = async () => {
    if (!canvas) return;
    signal?.throwIfAborted();
    ctx.strokeStyle = "#dce5ee"; ctx.beginPath(); ctx.moveTo(margin, 1080); ctx.lineTo(width - margin, 1080); ctx.stroke();
    text("DEMO · 실제 시험 성적서가 아닙니다.", margin, 1090, 10, "#637589");
    text(`ASTRA  /  ${images.length + 1}`, width - margin - 85, 1090, 10, "#637589");
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .94));
    if (!blob) throw new Error("PDF 페이지 생성에 실패했습니다.");
    images.push({ width: canvas.width, height: canvas.height, bytes: new Uint8Array(await blob.arrayBuffer()) });
    canvas.width = 0; canvas.height = 0; canvas = null;
    signal?.throwIfAborted();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const newPage = async () => {
    await flush();
    canvas = document.createElement("canvas"); canvas.width = width * scale; canvas.height = height * scale;
    ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서 PDF를 생성할 수 없습니다.");
    ctx.scale(scale, scale); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#13283f"; ctx.fillRect(0, 0, width, 112);
    text("ASTRA  /  SIMULATION REPORT", margin, 25, 11, "#86cddb", true);
    text(report.title, margin, 50, 23, "#ffffff", true);
    text(`실행 ID ${report.resultId}  ·  DEMO`, margin, 84, 11, "#b7c9d8");
    y = 138;
  };
  const heading = async (label) => {
    if (y + 60 > bottom) await newPage();
    text(label, margin, y, 16, "#13283f", true); y += 30;
  };
  const drawRow = async (row, header = false, stripe = false) => {
    const left = wrap(row[0], 210), right = wrap(row.slice(1).join("  ·  "), width - margin * 2 - 240);
    const total = Math.max(left.length, right.length);
    let at = 0;
    while (at < total) {
      if (y + 34 > bottom) await newPage();
      const lines = Math.min(total - at, Math.max(1, Math.floor((bottom - y - 16) / 18)));
      const rowHeight = lines * 18 + 16;
      ctx.fillStyle = header ? "#e8eff6" : stripe ? "#f5f8fb" : "#ffffff";
      ctx.fillRect(margin, y, width - margin * 2, rowHeight);
      for (let i = 0; i < lines; i++) {
        if (left[at + i] !== undefined) text(left[at + i], margin + 10, y + 8 + i * 18, 12, "#29445c", header);
        if (right[at + i] !== undefined) text(right[at + i], margin + 240, y + 8 + i * 18, 12, "#243950", header);
      }
      y += rowHeight; at += lines;
      ctx.strokeStyle = "#e5ebf1"; ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width - margin, y); ctx.stroke();
    }
  };
  try {
    await newPage();
    if (report.chart?.series.length) {
      await heading("가상 결과 그래프");
      const points = report.chart.series;
      const minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
      const minY = Math.min(0, ...points.map((p) => p[1])), maxY = Math.max(...points.map((p) => p[1]));
      const x0 = margin + 52, y0 = y + 28, chartWidth = width - margin * 2 - 70, chartHeight = 180;
      const x = (v) => x0 + (v - minX) / (maxX - minX || 1) * chartWidth;
      const py = (v) => y0 + chartHeight - (v - minY) / (maxY - minY || 1) * chartHeight;
      text(`${report.chart.yLabel} · DEMO`, margin, y, 11, "#637589");
      for (let i = 0; i <= 4; i++) {
        const value = minY + (maxY - minY) * i / 4;
        ctx.strokeStyle = "#e0e8f0"; ctx.beginPath(); ctx.moveTo(x0, py(value)); ctx.lineTo(x0 + chartWidth, py(value)); ctx.stroke();
        text(Number(value.toPrecision(3)), margin, py(value) - 5, 10, "#637589");
      }
      ctx.strokeStyle = "#157f98"; ctx.lineWidth = 2; ctx.beginPath();
      points.forEach(([a, b], i) => i ? ctx.lineTo(x(a), py(b)) : ctx.moveTo(x(a), py(b))); ctx.stroke(); ctx.lineWidth = 1;
      text(Number(minX.toPrecision(4)), x0, y0 + chartHeight + 10, 10, "#637589");
      text(Number(maxX.toPrecision(4)), x0 + chartWidth - 30, y0 + chartHeight + 10, 10, "#637589");
      text(report.chart.xLabel, x0 + chartWidth / 2 - 30, y0 + chartHeight + 28, 11, "#637589");
      y = y0 + chartHeight + 65;
    }
    for (const sheet of sheets) {
      signal?.throwIfAborted();
      await heading(sheet.name);
      for (let i = 0; i < sheet.rows.length; i++) { signal?.throwIfAborted(); await drawRow(sheet.rows[i], i === 0, i % 2 === 0); }
      y += 25;
    }
    await flush();
    return pdfFromJpegs(images);
  } finally {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
