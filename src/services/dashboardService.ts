import { apiClient, responseData } from "../api/client";
import { contractError } from "../api/errors";
import { USER_ROLES } from "./authService";
import type { UserRole } from "./authService";
import type { NamedResource } from "./contracts";

export interface EquipmentStats {
  total: number;
  byRegion: Record<string, number>;
  byEquipmentType: Record<string, number>;
  byTestType: { code: string; nameKo: string; equipmentCount: number }[];
  institutions: { id: number; name: string; region?: string; equipmentCount: number; verifiedCount: number; verificationRate: number }[];
}
const isCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function validateEquipmentStats(data: EquipmentStats) {
  if (!data || !isCount(data.total) || !data.byRegion || !data.byEquipmentType ||
      ![data.byRegion, data.byEquipmentType].every(group => typeof group === "object" && !Array.isArray(group) && Object.values(group).every(isCount)) ||
      !Array.isArray(data.byTestType) || data.byTestType.some(row => typeof row?.code !== "string" || typeof row.nameKo !== "string" || !isCount(row.equipmentCount)) ||
      !Array.isArray(data.institutions) || data.institutions.some(row => !isCount(row?.id) || typeof row.name !== "string" || !isCount(row.equipmentCount) || !isCount(row.verifiedCount) || row.verifiedCount > row.equipmentCount || !Number.isFinite(row.verificationRate) || row.verificationRate < 0))
    throw contractError("장비 통계의 지역·시험유형·기관별 집계 형식을 확인해주세요.");
  return data;
}

export const REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "SUPPLEMENT_REQUESTED",
  "RESUBMITTED",
  "SCHEDULING",
  "CONFIRMED",
  "COMPLETED",
  "REJECTED",
  "CANCELED",
] as const;

interface DashboardRequest {
  requestId: number;
  requestNo: string;
  title: string;
  status: typeof REQUEST_STATUSES[number];
  submittedAt?: string | null;
  institutionName?: string;
}

interface DashboardSummary {
  view?: "REQUESTER" | "PROVIDER" | "ADMIN";
  role: UserRole;
  requestCounts: Record<typeof REQUEST_STATUSES[number], number>;
  equipmentStats: { total: number };
  dataAvailable: { requests: boolean };
  institution?: NamedResource | null;
  actionRequired?: DashboardRequest[];
  pendingReview?: DashboardRequest[];
  recentChats?: unknown[];
  upcomingReservations?: unknown[];
  institutionVerification?: unknown[];
  pendingUsers?: number;
  pendingInstitutions?: number;
}

export function validateSummary(data: DashboardSummary | undefined, expectedRole?: UserRole) {
  if (
    !data ||
    !USER_ROLES.includes(data.role) ||
    (expectedRole && data.role !== expectedRole) ||
    !Number.isSafeInteger(data.equipmentStats?.total) ||
    data.equipmentStats.total < 0 ||
    typeof data.dataAvailable?.requests !== "boolean"
  )
    throw contractError(
      "대시보드 role·equipmentStats·dataAvailable 응답을 확인해주세요.",
    );
  if (
    !REQUEST_STATUSES.every(
      (key) =>
        Number.isSafeInteger(data.requestCounts?.[key]) &&
        data.requestCounts[key] >= 0,
    )
  )
    throw contractError("대시보드의 10개 의뢰 상태 집계가 명세와 다릅니다.");
  for (const key of [
    "actionRequired",
    "pendingReview",
    "recentChats",
    "upcomingReservations",
    "institutionVerification",
  ] as const) {
    if (data[key] !== undefined && !Array.isArray(data[key]))
      throw contractError(`대시보드 ${key}가 목록 형식이 아닙니다.`);
  }
  for (const key of ["actionRequired", "pendingReview"] as const) {
    if (
      data[key]?.some(
        (item) =>
          !item ||
          !Number.isSafeInteger(item.requestId) ||
          typeof item.requestNo !== "string" ||
          typeof item.title !== "string" ||
          !REQUEST_STATUSES.includes(item.status) ||
          (item.submittedAt != null && typeof item.submittedAt !== "string"),
      )
    )
      throw contractError("대시보드 의뢰 항목이 명세와 다릅니다.");
  }
  if (
    data.role === "ADMIN" &&
    ![data.pendingUsers, data.pendingInstitutions].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  )
    throw contractError("관리자 승인 대기 집계가 명세와 다릅니다.");
  if (
    (data.view === "PROVIDER" || (!data.view && data.role === "INSTITUTION_MANAGER")) &&
    (!Number.isSafeInteger(data.institution?.id) ||
      typeof data.institution.name !== "string")
  )
    throw contractError("기관 대시보드의 소속 기관 응답을 확인해주세요.");
  return data;
}

export const dashboardService = {
  async equipmentStats(signal?: AbortSignal) {
    return validateEquipmentStats(responseData<EquipmentStats>(await apiClient.get("/dashboard/equipment-stats", { signal })));
  },
  async summary(role: UserRole, signal?: AbortSignal, view?: "REQUESTER" | "PROVIDER" | "ADMIN") {
    return validateSummary(
      responseData<DashboardSummary>(await apiClient.get("/dashboard/summary", { signal, params: view && view !== "ADMIN" ? { view } : undefined })),
      role,
    );
  },
};
