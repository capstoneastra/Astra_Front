import { getData, postData, mutate } from "./http";
import type { MatchRun, Requirement, RequirementCondition, ResourceId } from "./contracts";

export interface RequirementAnalysis {
  readyForMatching: boolean;
  missing: { label: string; question?: string }[];
  unconfirmed: { label: string }[];
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
