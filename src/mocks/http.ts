import type { UserRole } from "../auth/session";

export interface MockParticipant {
  id: number;
  role: UserRole;
  organizationId: number | null;
}

export class MockApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function reject(status: number, code: string, message: string, details?: unknown): never {
  throw new MockApiError(status, code, message, details);
}
export const ok = <T>(data: T, status = 200) => ({
  status,
  envelope: { success: true, data },
});
export function pageOf<T>(items: T[], url: URL) {
  const page = Number(url.searchParams.get("page") ?? 0),
    size = Number(url.searchParams.get("size") ?? 20);
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    reject(
      400,
      "VALIDATION_FAILED",
      "page는 0 이상, size는 1~100의 정수여야 합니다.",
    );
  return {
    content: items.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}
export function textRequired(text: unknown, label = "입력값", max = 10000): string {
  if (typeof text !== "string" || !text.trim() || text.length > max)
    reject(400, "VALIDATION_FAILED", `${label}을(를) 올바르게 입력해주세요.`);
  return text.trim();
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
];
export const summaryEquipment = ({
  manufacturer: _m,
  category: _c,
  description: _d,
  usage: _u,
  specs: _s,
  source: _o,
  simulation: _sim,
  isActive: _a,
  ...item
}) => item;
export function contextFor(state, request, clock) {
  const now = clock().toISOString();
  const participants: ReadonlyMap<number, MockParticipant> = request.participants;
  const ctx = { state, ...request, now, nextId: () => ++state.sequence };
  ctx.role = (...roles) => {
    if (ctx.user?.role !== "ADMIN" && !roles.includes(ctx.user?.role))
      reject(403, "FORBIDDEN", "현재 계정의 역할로 이용할 수 없습니다.");
  };
  ctx.owner = (record, userId = record?.ownerId) => {
    if (!record) reject(404, "NOT_FOUND", "정보를 찾을 수 없습니다.");
    if (ctx.user.role !== "ADMIN" && userId !== ctx.user.id)
      reject(
        403,
        "FORBIDDEN",
        "다른 사용자의 비공개 정보에 접근할 수 없습니다.",
      );
    return record;
  };
  ctx.equipment = (id) =>
    state.equipment.find((item) => item.id === Number(id) && item.isActive) ??
    reject(404, "EQUIPMENT_NOT_FOUND", "장비가 없거나 비활성화되었습니다.");
  ctx.manageEquipment = (item) => {
    ctx.role("INSTITUTION_MANAGER");
    if (
      ctx.user.role !== "ADMIN" &&
      item.institution.id !== ctx.user.organizationId
    )
      reject(403, "FORBIDDEN", "소속 기관의 장비만 관리할 수 있습니다.");
    return item;
  };
  ctx.requestVisible = (item) =>
    ctx.user.role === "ADMIN" ||
    (ctx.user.role === "COMPANY_USER"
      ? item.ownerId === ctx.user.id
      : item.institutionId === ctx.user.organizationId);
  ctx.testRequest = (id) => {
    const item = state.requests.find((r) => r.id === Number(id));
    if (!item) reject(404, "NOT_FOUND", "의뢰를 찾을 수 없습니다.");
    if (ctx.user.role === "INSTITUTION_MANAGER" && item.status === "DRAFT")
      reject(403, "FORBIDDEN", "제출 전 초안은 조회할 수 없습니다.");
    if (!ctx.requestVisible(item))
      reject(403, "FORBIDDEN", "소속 기업·기관의 의뢰만 조회할 수 있습니다.");
    return item;
  };
  ctx.companyRequest = (id) => {
    ctx.role("COMPANY_USER");
    return ctx.owner(ctx.testRequest(id));
  };
  ctx.institutionRequest = (id) => {
    ctx.role("INSTITUTION_MANAGER");
    return ctx.testRequest(id);
  };
  ctx.version = (item) => {
    if (
      !Number.isInteger(ctx.body?.version) ||
      ctx.body.version !== item.version
    )
      reject(
        409,
        "CONFLICT",
        "다른 작업으로 정보가 변경되었습니다. 새로 조회한 뒤 다시 시도해주세요.",
        { version: item.version },
      );
  };
  ctx.status = (item, allowed) => {
    if (!allowed.includes(item.status))
      reject(
        409,
        "REQUEST_INVALID_STATUS",
        "현재 진행 상태에서는 이 작업을 실행할 수 없습니다.",
      );
  };
  ctx.notify = (userId, type, requestId, message) =>
    state.notifications.push({
      id: ctx.nextId(),
      userId,
      type,
      requestId,
      message,
      isRead: false,
      createdAt: now,
    });
  ctx.notifyInstitution = (item, type, message) =>
    Array.from(participants.values())
      .filter(
        (u) =>
          u.role === "INSTITUTION_MANAGER" &&
          u.organizationId === item.institutionId,
      )
      .forEach((u) => ctx.notify(u.id, type, item.id, message));
  ctx.transition = (item, to, note = null) => {
    item.history.push({
      id: ctx.nextId(),
      fromStatus: item.status,
      toStatus: to,
      changedBy: { id: ctx.user.id, name: ctx.user.name },
      note,
      createdAt: now,
    });
    item.status = to;
    item.version++;
    item.updatedAt = now;
  };
  return ctx;
}
