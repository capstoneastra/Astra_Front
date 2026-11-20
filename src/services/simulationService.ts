import { getData, mutate } from "./http";
import type { Page, ResourceId } from "./contracts";

export type SimulationInput = Record<string, number | string>;

export interface SimulationChartData {
  xLabel: string;
  yLabel: string;
  series: [number, number][];
}

export interface SimulationOutput {
  summary?: Record<string, number | string | boolean | null>;
  chart?: SimulationChartData;
  checks?: { key: string; input: number | string; result: "MET" | "NOT_MET" | "UNKNOWN"; sourceType?: string }[];
  concept?: { label?: string; value: number | string; unit?: string };
  steps?: string[];
  inputParameters?: SimulationInput;
}

export interface SimulationResult {
  id: number;
  equipmentId: number;
  presetId: string;
  status: string;
  modelType: string;
  modelVersion: string;
  capability: string;
  inputParameters: SimulationInput;
  output: SimulationOutput;
  warning: string;
  limitation: string;
  createdAt: string;
}

interface SimulationModel {
  modelType: string;
  description: string;
  requiredInputFields: string[];
  limitation: string;
  capability: string;
}

interface SimulationPreset {
  presetId: string;
  modelType: string;
  inputParameters: SimulationInput;
}

export const simulationService = {
  models: (signal?: AbortSignal) => getData<SimulationModel[]>("/simulation/models", undefined, signal),
  presets: (id: ResourceId, signal?: AbortSignal) =>
    getData<SimulationPreset[]>(`/equipment/${id}/simulation-presets`, undefined, signal),
  run: (body: { presetId: string; inputParameters: SimulationInput; requirementId?: number }, signal?: AbortSignal) =>
    mutate<SimulationResult>("POST", "/simulation/runs", body, signal),
  result: (id: ResourceId, signal?: AbortSignal) =>
    getData<SimulationResult>(`/simulation/runs/${id}`, undefined, signal),
  history: (signal?: AbortSignal) => getData<Page<SimulationResult>>("/simulation/runs", { size: 100 }, signal),
};
