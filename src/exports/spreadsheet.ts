import type { ReportCell, ReportSheet } from "../domain/simulationReport";

const encoder = new TextEncoder();
export const csvCell = (value: ReportCell) => {
  let text = value == null ? "" : String(value);
  // Untrusted strings must not become spreadsheet formulas. Numeric negatives remain numeric.
  if (typeof value === "string" && /^[\s]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function createCsv(sheets: ReportSheet[]) {
  const width = Math.max(...sheets.flatMap((sheet) => sheet.rows.map((row) => row.length)), 1) + 1;
  const rows: ReportCell[][] = [["구분", "항목 / X", "값 / Y", "추가 정보", "출처"]];
  for (const sheet of sheets) for (const row of sheet.rows) rows.push([sheet.name, ...row]);
  return "\uFEFF" + rows.map((row) => Array.from({ length: Math.max(width, 5) }, (_, i) => csvCell(row[i])).join(",")).join("\r\n");
}
// XML 1.0 forbids these controls even inside an escaped string.
// eslint-disable-next-line no-control-regex
const xml = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const mainNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relNs = "http://schemas.openxmlformats.org/package/2006/relationships";
const officeRelNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const column = (index) => {
  let value = index + 1, result = "";
  while (value) { result = String.fromCharCode(65 + (value - 1) % 26) + result; value = Math.floor((value - 1) / 26); }
  return result;
};
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const concat = (parts) => { const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; };
const binaryHeader = (size) => { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; };

// A standards-based, uncompressed ZIP container for the small OOXML report; no runtime package.
export function zipFiles(files: Record<string, string>) {
  const body = [], directory = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const path = encoder.encode(name), data = encoder.encode(text), crc = crc32(data);
    const local = binaryHeader(30), l = local.view;
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
    l.setUint16(12, 0x21, true); l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, path.length, true);
    body.push(local.bytes, path, data);
    const central = binaryHeader(46), c = central.view;
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true);
    c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, path.length, true); c.setUint32(42, offset, true); directory.push(central.bytes, path);
    offset += local.bytes.length + path.length + data.length;
  }
  const central = concat(directory), end = binaryHeader(22), e = end.view;
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(files).length, true); e.setUint16(10, Object.keys(files).length, true);
  e.setUint32(12, central.length, true); e.setUint32(16, offset, true);
  return concat([...body, central, end.bytes]);
}

export function createXlsx(sheets: ReportSheet[]) {
  const files: Record<string, string> = {};
  files["[Content_Types].xml"] = declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + '</Types>';
  files["_rels/.rels"] = declaration + `<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${officeRelNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files["xl/workbook.xml"] = declaration + `<workbook xmlns="${mainNs}" xmlns:r="${officeRelNs}"><sheets>` + sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + '</sheets></workbook>';
  files["xl/_rels/workbook.xml.rels"] = declaration + `<Relationships xmlns="${relNs}">` + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${officeRelNs}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") + `<Relationship Id="rId${sheets.length + 1}" Type="${officeRelNs}/styles" Target="styles.xml"/></Relationships>`;
  files["xl/styles.xml"] = declaration + `<styleSheet xmlns="${mainNs}"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14283F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  sheets.forEach((sheet, index) => {
    const rows = sheet.rows.map((row, r) => `<row r="${r + 1}"${r === 0 ? ' ht="26" customHeight="1"' : ""}>` + row.map((value, c) => {
      const attributes = `r="${column(c)}${r + 1}" s="${r === 0 ? 1 : 0}"`;
      if (typeof value === "number" && Number.isFinite(value)) return `<c ${attributes}><v>${value}</v></c>`;
      if (typeof value === "boolean") return `<c ${attributes} t="b"><v>${value ? 1 : 0}</v></c>`;
      if (String(value ?? "").length > 32767) throw new Error("일부 텍스트가 Excel 셀 길이 제한을 초과합니다. CSV로 내려받아주세요.");
      return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join("") + '</row>').join("");
    files[`xl/worksheets/sheet${index + 1}.xml`] = declaration + `<worksheet xmlns="${mainNs}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="58" customWidth="1"/><col min="3" max="8" width="28" customWidth="1"/></cols><sheetData>${rows}</sheetData></worksheet>`;
  });
  return zipFiles(files);
}
