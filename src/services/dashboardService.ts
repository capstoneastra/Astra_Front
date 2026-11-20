import { apiClient, responseData } from "../api/client";
import { contractError } from "../api/errors";
import { USER_ROLES } from "./authService";
import type { UserRole } from "./authService";
import type { NamedResource } from "./contracts";

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
    data.role === "INSTITUTION_MANAGER" &&
    (!Number.isSafeInteger(data.institution?.id) ||
      typeof data.institution.name !== "string")
  )
    throw contractError("기관 대시보드의 소속 기관 응답을 확인해주세요.");
  return data;
}

export const dashboardService = {
  async summary(role: UserRole, signal?: AbortSignal) {
    return validateSummary(
      responseData<DashboardSummary>(await apiClient.get("/dashboard/summary", { signal })),
      role,
    );
  },
};
