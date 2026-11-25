import { useState } from "react";
import { Activity, Play } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, EmptyState, FormField, PageHeader, Panel } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { simulationService } from "../services/simulationService";
import type { SimulationInput, SimulationResult } from "../services/simulationService";
import { Feedback } from "./workflow/Feedback";
import SimulationChart from "./workflow/SimulationChart";
import ApiState from "./ui/ApiState";
import SimulationExports from "./workflow/SimulationExports";

const labels = {
  massKg: "시료 질량 (kg)", fixtureMassKg: "고정구 질량 (kg)", stiffnessNPerM: "가상 강성 (N/m)",
  dampingRatio: "감쇠비 (0 초과~1)", frequencyMinHz: "시작 주파수 (Hz)", frequencyMaxHz: "종료 주파수 (Hz)",
  startTempC: "시작 온도 (°C)", targetTempC: "목표 온도 (°C)", rampMin: "승온 시간 (분)",
  holdMin: "유지 시간 (분)", targetHumidityPct: "목표 습도 (%)",
};
export default function Simulation() {
  const { equipmentList, simulationEquipmentId, setSimulationEquipmentId, requirementId } = useWorkspace();
  const [chosen, setChosen] = useState("");
  const [edited, setEdited] = useState<{ presetId: string; values: SimulationInput } | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const action = useAction();
  const models = useApiQuery((signal) => simulationService.models(signal), "simulation-models");
  const presets = useApiQuery((signal) => simulationService.presets(simulationEquipmentId, signal),
    `simulation-presets:${simulationEquipmentId}`, Boolean(simulationEquipmentId));
  const preset = presets.data?.find((p) => p.presetId === chosen) ?? presets.data?.[0];
  const model = models.data?.find((m) => m.modelType === preset?.modelType);
  const input = edited?.presetId === preset?.presetId ? edited?.values ?? {} : preset?.inputParameters ?? {};

  return <div className="content-page page-enter simulation-page">
    <PageHeader eyebrow={null} title="가상 시뮬레이션"><Badge tone="amber">DEMO</Badge></PageHeader>
    <Panel className="form-panel simulation-controls">
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!preset || !model || action.busy) return;
        setResult(null);
        action.run(async (signal) => {
          setResult(await simulationService.run({
            presetId: preset.presetId, inputParameters: input,
            ...(requirementId ? { requirementId } : {}),
          }, signal));
        });
      }}>
        <div className="simulation-controls__row">
          <FormField id="simulation-equipment" label="장비">
            <select id="simulation-equipment" value={simulationEquipmentId ?? ""} disabled={action.busy}
              onChange={(event) => {
                setSimulationEquipmentId(Number(event.target.value)); setChosen(""); setEdited(null); setResult(null);
              }}>
              <option value="" disabled>장비 선택</option>
              {equipmentList.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.name}</option>)}
            </select>
          </FormField>
          <FormField id="simulation-preset" label="가상 프리셋">
            <select id="simulation-preset" value={preset?.presetId ?? ""} disabled={!preset || action.busy}
              onChange={(event) => { setChosen(event.target.value); setEdited(null); setResult(null); }}>
              {!preset && <option value="">프리셋 선택</option>}
              {presets.data?.map((item) => <option key={item.presetId} value={item.presetId}>{item.presetId} · {item.modelType}</option>)}
            </select>
          </FormField>
          <Button type="submit" icon={Play} disabled={!model || !preset || action.busy}>{action.busy ? "계산 중…" : "시뮬레이션 실행"}</Button>
        </div>
        {model && preset && <details className="simulation-parameters">
          <summary>입력 조건 조정</summary>
          <div className="form-grid">
            {model.requiredInputFields.map((field) => <FormField key={field} id={`simulation-${field}`} label={labels[field] ?? field}>
              <input id={`simulation-${field}`} type={typeof preset.inputParameters[field] === "number" ? "number" : "text"}
                step="any" required disabled={action.busy} value={input[field] ?? ""}
                onChange={(event) => {
                  setResult(null);
                  setEdited({ presetId: preset.presetId, values: {
                    ...input, [field]: typeof preset.inputParameters[field] === "number"
                      ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value,
                  } });
                }} />
            </FormField>)}
          </div>
          <p className="field-hint">{model.limitation}</p>
        </details>}
      </form>
      {(models.loading || models.error || presets.loading || presets.error) && <ApiState
        loading={models.loading || presets.loading} error={models.error ?? presets.error}
        onRetry={() => { models.reload(); presets.reload(); }} />}
      {presets.data?.length === 0 && <p className="field-hint">이 장비에 등록된 프리셋이 없습니다.</p>}
      <Feedback action={action} />
    </Panel>
    <Panel className="simulation-graph" title="시뮬레이션 그래프" action={<Badge tone="amber">가상 모델 · DEMO</Badge>}>
      {result?.output.chart ? <SimulationChart chart={result.output.chart} /> :
        <EmptyState icon={Activity} title={result ? "그래프를 제공하지 않는 모델입니다" : "표시할 그래프가 없습니다"}
          description={result ? "결과는 다운로드 파일에서 확인할 수 있습니다." : "장비와 프리셋을 선택한 뒤 실행해주세요."} />}
      {result && <SimulationExports key={result.id} result={result} equipment={equipmentList.find((item) => item.id === result.equipmentId)} />}
      <p className="simulation-graph__notice">{result?.warning || "가상 모델 결과이며 실제 시험 성능·적합성·안전성을 보장하지 않습니다."}</p>
    </Panel>
  </div>;
}
