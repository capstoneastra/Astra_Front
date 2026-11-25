import { getData, mutate } from "./http";
import { contractError } from "../api/errors";
import type { NamedResource, Page, RequestDetail, RequestRevision, RequestSummary, ResourceId, TimeInterval } from "./contracts";

interface RequestHistoryEntry {
  id: number;
  fromStatus: string;
  toStatus: string;
  createdAt: string;
  changedBy: NamedResource;
  note?: string | null;
}

interface DraftResult {
  requestId: number;
  id?: number;
  requestNo?: string;
  status?: string;
  revision?: { revisionNo: number; isAiGenerated?: boolean; content: object };
  aiNotes?: string[];
}

export const requestService = {
  list: (params: object = {}, signal?: AbortSignal) =>
    getData<Page<RequestSummary>>("/test-requests", { size: 100, ...params }, signal),
  get: (id: ResourceId, signal?: AbortSignal) => getData<RequestDetail>(`/test-requests/${id}`, undefined, signal),
  create: (body: object, signal?: AbortSignal) => mutate<DraftResult>("POST", "/test-requests", body, signal),
  aiDraft: (body: object, signal?: AbortSignal) =>
    mutate<DraftResult>("POST", "/test-requests/ai-draft", body, signal),
  save: (id: ResourceId, version: number, content: object, signal?: AbortSignal) =>
    mutate<RequestDetail>("PUT", `/test-requests/${id}/draft`, { version, content }, signal),
  submit: (id: ResourceId, version: number, signal?: AbortSignal) =>
    mutate("POST", `/test-requests/${id}/submit`, { version }, signal),
  action: (id: ResourceId, action: string, version: number, fields: object = {}, signal?: AbortSignal) =>
    mutate(
      "POST",
      `/test-requests/${id}/${action}`,
      { version, ...fields },
      signal,
    ),
  supplements: (id: ResourceId, signal?: AbortSignal) =>
    getData(`/test-requests/${id}/supplements`, undefined, signal),
  respond: (id: ResourceId, body: object, signal?: AbortSignal) =>
    mutate("POST", `/supplements/${id}/respond`, body, signal),
  revisions: (id: ResourceId, signal?: AbortSignal) =>
    getData<RequestRevision[]>(`/test-requests/${id}/revisions`, undefined, signal),
  history: (id: ResourceId, signal?: AbortSignal) =>
    getData<RequestHistoryEntry[]>(`/test-requests/${id}/history`, undefined, signal),
  propose: (id: ResourceId, version: number, body: TimeInterval, signal?: AbortSignal) =>
    mutate(
      "POST",
      `/test-requests/${id}/reservations`,
      { version, ...body },
      signal,
    ),
  reservationAction: (id: ResourceId, action: string, version: number, fields: object = {}, signal?: AbortSignal) =>
    mutate(
      "POST",
      `/reservations/${id}/${action}`,
      { version, ...fields },
      signal,
    ),
  availability: async (equipmentId: ResourceId, params: object = {}, signal?: AbortSignal) => {
    const intervals = await getData<TimeInterval[]>(`/equipment/${equipmentId}/reservations`, params, signal);
    if (!Array.isArray(intervals) || intervals.some((item) =>
      !Number.isFinite(Date.parse(item?.startAt)) || !Number.isFinite(Date.parse(item?.endAt)) || Date.parse(item.startAt) >= Date.parse(item.endAt)))
      throw contractError("장비의 확정 예약 구간 응답을 확인해주세요.");
    return intervals;
  },
};
