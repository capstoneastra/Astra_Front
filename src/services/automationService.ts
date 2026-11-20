import { getData, mutate } from "./http";
import type { ResourceId } from "./contracts";

interface AutoRun {
  id: number;
  status: string;
  requirementId?: number | null;
  draftRequestId?: number | null;
  steps: { step: string; status: string; message?: string | null }[];
}

export const automationService = {
  start: (body: { inputText: string }, signal?: AbortSignal) => mutate<AutoRun>("POST", "/ai/auto-runs", body, signal),
  get: (id: ResourceId, signal?: AbortSignal) => getData<AutoRun>(`/ai/auto-runs/${id}`, undefined, signal),
  resume: (id: ResourceId, signal?: AbortSignal) =>
    mutate("POST", `/ai/auto-runs/${id}/resume`, {}, signal),
  cancel: (id: ResourceId, signal?: AbortSignal) =>
    mutate("POST", `/ai/auto-runs/${id}/cancel`, {}, signal),
};
