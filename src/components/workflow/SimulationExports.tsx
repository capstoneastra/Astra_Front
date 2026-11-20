import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../ui/index";
import { apiConfig } from "../../api/config";
import { buildSimulationReport } from "../../domain/simulationReport";
import type { Equipment } from "../../services/equipmentService";
import type { SimulationResult } from "../../services/simulationService";
import type { SimulationExportFormat } from "../../exports/simulationExport";

export default function SimulationExports({ result, equipment }: { result: SimulationResult; equipment?: Equipment }) {
  const [busy, setBusy] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);
  const download = async (format: SimulationExportFormat) => {
    if (job.current) return;
    const controller = new AbortController(); job.current = controller;
    setBusy(format); setError(""); setMessage("");
    try {
      const report = buildSimulationReport(result, { equipmentName: equipment?.name, institutionName: equipment?.institution,
        source: apiConfig.isMock ? "MSW Mock · 브라우저별 시연 데이터" : "서버 API · 가상 모델 결과" });
      const { exportSimulation } = await import("../../exports/simulationExport");
      await exportSimulation(report, format, controller.signal);
      if (!controller.signal.aborted) setMessage(`${format.toUpperCase()} 파일을 생성했습니다.`);
    } catch (failure) {
      if (!controller.signal.aborted) setError((failure instanceof Error && failure.message) || "파일 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      if (!controller.signal.aborted) setBusy("");
      if (job.current === controller) job.current = null;
    }
  };
  return <div className="simulation-export" aria-label="시뮬레이션 결과 다운로드">
    <span>결과 다운로드</span>
    {([["xlsx", "Excel"], ["csv", "CSV"], ["pdf", "PDF"]] as const).map(([format, label]) =>
      <Button key={format} variant="secondary" icon={Download} disabled={Boolean(busy)} onClick={() => download(format)} aria-label={`${label} 결과 다운로드`}>
        {busy === format ? "파일 생성 중…" : label}
      </Button>)}
    {(error || message) && <div className="simulation-export__feedback" role={error ? "alert" : "status"}>{error || message}</div>}
  </div>;
}
