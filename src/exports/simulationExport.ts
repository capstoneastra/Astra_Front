import { createCsv, createXlsx } from "./spreadsheet";
import type { SimulationReport } from "../domain/simulationReport";

export type SimulationExportFormat = "xlsx" | "csv" | "pdf";

export async function exportSimulation(report: SimulationReport, format: SimulationExportFormat, signal?: AbortSignal) {
  signal?.throwIfAborted();
  let content, type;
  if (format === "xlsx") {
    content = createXlsx(report.sheets);
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "csv") {
    content = createCsv(report.sheets); type = "text/csv;charset=utf-8";
  } else if (format === "pdf") {
    const { createPdfReport } = await import("./pdfReport");
    content = await createPdfReport(report, signal); type = "application/pdf";
  } else throw new Error("지원하지 않는 파일 형식입니다.");
  signal?.throwIfAborted();
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = `${report.filename}.${format}`; link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
