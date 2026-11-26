import { getData, postData, mutate } from "./http";
import type { MatchRun, Requirement, RequirementCondition, ResourceId } from "./contracts";

/** POST /requirements/{id}/analyze — 매칭 전에 빠진 조건을 먼저 안내할 때 쓴다 */
export interface RequirementAnalysis {
  readyForMatching: boolean;
  /** 빠진 필수 조건과 물어볼 문구 (예: "시료 질량을 알려 주세요.") */
  missing: { key?: string; label: string; question?: string }[];
  /** AI가 뽑았지만 확인이 필요한 조건과 그 이유 */
  unconfirmed: { key?: string; label: string; reason?: string }[];
}

export const requirementService = {
  create: (body: object, signal?: AbortSignal) => mutate<Requirement>("POST", "/requirements", body, signal),
  get: (id: ResourceId, signal?: AbortSignal) => getData<Requirement>(`/requirements/${id}`, undefined, signal),
  update: (id: ResourceId, body: object, signal?: AbortSignal) =>
    mutate<Requirement>("PATCH", `/requirements/${id}`, body, signal),
  conditions: (id: ResourceId, conditions: RequirementCondition[], signal?: AbortSignal) =>
    mutate<Requirement>("PUT", `/requirements/${id}/conditions`, { conditions }, signal),
  analyze: (id: ResourceId, signal?: AbortSignal) =>
    postData<RequirementAnalysis>(`/requirements/${id}/analyze`, {}, signal),
  confirm: (id: ResourceId, signal?: AbortSignal) =>
    mutate<Requirement>("POST", `/requirements/${id}/confirm`, {}, signal),
  match: (id: ResourceId, options: { limit?: number; region?: string } = {}, signal?: AbortSignal) =>
    mutate<MatchRun>(
      "POST",
      `/requirements/${id}/match-runs`,
      { limit: 5, ...options },
      signal,
    ),
  matchResult: (id: ResourceId, signal?: AbortSignal) =>
    getData<MatchRun>(`/match-runs/${id}`, undefined, signal),
};
