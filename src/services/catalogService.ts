import { getData, postData, mutate } from "./http";
import type { EquipmentDto, EquipmentSpec, NamedResource, RequirementCondition, ResourceId, TestType, TestTypeDetail } from "./contracts";

type CatalogEquipment = EquipmentDto & { institution: NamedResource };

interface Comparison {
  usedMockData: boolean;
  equipment: CatalogEquipment[];
  rows: { key: string; label: string; values: (EquipmentSpec | null)[] }[];
  usage: {
    equipmentId: number;
    feeText?: string | null;
    durationText?: string | null;
    availability?: string | null;
    infoUpdatedAt?: string | null;
  }[];
}

export interface SearchResult {
  interpreted: { interpreter?: "AI" | "KEYWORD" | string; testTypes: string[]; conditions: RequirementCondition[]; regions: string[] };
  testTypes: { code: string; nameKo: string }[];
  equipment: EquipmentDto[];
}

export const catalogService = {
  testTypes: (signal?: AbortSignal) => getData<TestType[]>("/test-types", undefined, signal),
  testType: (code: string, signal?: AbortSignal) => getData<TestTypeDetail>(`/test-types/${code}`, undefined, signal),
  /** 시험항목·자연어 통합 검색 (명세 §2 GET /search) — 문장을 시험유형·조건·지역으로 해석하고 장비 후보(최대 20대)를 돌려줌 */
  search: (q: string, signal?: AbortSignal) => getData<SearchResult>("/search", { q }, signal),
  compare: (equipmentIds: number[], testType?: string, signal?: AbortSignal) =>
    postData<Comparison>(
      "/equipment/compare",
      { equipmentIds, ...(testType ? { testType } : {}) },
      signal,
    ),
  createEquipment: (body: object, signal?: AbortSignal) => mutate("POST", "/equipment", body, signal),
  updateEquipment: (id: ResourceId, body: object, signal?: AbortSignal) =>
    mutate("PATCH", `/equipment/${id}`, body, signal),
  saveSpecs: (id: ResourceId, specs: EquipmentSpec[], signal?: AbortSignal) =>
    mutate("PUT", `/equipment/${id}/specs`, { specs }, signal),
  confirmEquipment: (id: ResourceId, signal?: AbortSignal) =>
    mutate("POST", `/equipment/${id}/confirm`, {}, signal),
  deleteEquipment: (id: ResourceId, signal?: AbortSignal) =>
    mutate("DELETE", `/equipment/${id}`, undefined, signal),
};
