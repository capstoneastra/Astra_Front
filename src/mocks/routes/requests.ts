import type { MockRoute } from "../engine";
import { ok, pageOf, reject, textRequired } from "../http";

export function requestView(ctx, item) {
  return {
    id: item.id,
    requestId: item.id,
    requestNo: item.requestNo,
    title: item.title,
    status: item.status,
    version: item.version,
    equipment: {
      id: item.equipmentId,
      name: item.equipmentName,
      externalId: item.externalId,
    },
    institution: {
      id: item.institutionId,
      name:
        ctx.state.organizations.find((o) => o.id === item.institutionId)
          ?.name ?? "",
    },
    revision: item.revisions.at(-1),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    submittedAt: item.submittedAt,
    supplements: ctx.state.supplements.filter((s) => s.requestId === item.id),
    reservations: ctx.state.reservations.filter((r) => r.requestId === item.id),
  };
}
function validateContent(content, submit = false) {
  if (
    !content ||
    typeof content !== "object" ||
    !Array.isArray(content.conditions)
  )
    reject(
      400,
      "VALIDATION_FAILED",
      "의뢰서 본문과 conditions를 확인해주세요.",
    );
  if (submit) {
    for (const [value, label] of [
      [content.applicant?.companyName, "기업명"],
      [content.applicant?.contactName, "담당자"],
      [content.applicant?.email, "이메일"],
      [content.test?.purpose, "시험 목적"],
      [content.sample?.name, "시료명"],
    ])
      textRequired(value, label, 10000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.applicant.email))
      reject(400, "VALIDATION_FAILED", "담당자 이메일을 확인해주세요.");
    if (
      !Number.isInteger(content.sample?.quantity) ||
      content.sample.quantity < 1
    )
      reject(400, "VALIDATION_FAILED", "시료 수량은 1 이상의 정수여야 합니다.");
  }
  const { desiredStartDate: start, desiredEndDate: end } =
    content.schedule ?? {};
  if (
    (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) ||
    (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) ||
    (start && end && start > end)
  )
    reject(400, "VALIDATION_FAILED", "희망 시험 기간을 확인해주세요.");
}
export function createDraft(
  ctx,
  { equipmentId, requirementId, matchResultId },
  ai = false,
) {
  ctx.role("COMPANY_USER");
  const equipment = ctx.equipment(equipmentId);
  const requirement = requirementId
    ? ctx.owner(
        ctx.state.requirements.find((r) => r.id === Number(requirementId)),
      )
    : null;
  if (ai && !requirement)
    reject(400, "VALIDATION_FAILED", "AI 초안에는 시험조건이 필요합니다.");
  if (requirement && !equipment.testTypes.includes(requirement.testTypeCode))
    reject(409, "CONFLICT", "장비의 시험유형과 의뢰 조건이 다릅니다.");
  if (matchResultId) {
    const run = ctx.state.matchRuns.find((r) =>
      r.results.some((m) => m.id === Number(matchResultId)),
    );
    ctx.owner(run);
    const result = run.results.find((r) => r.id === Number(matchResultId));
    if (
      result.equipment.id !== equipment.id ||
      run.requirementId !== requirement?.id
    )
      reject(409, "CONFLICT", "매칭 결과와 선택 장비·시험조건이 다릅니다.");
  }
  const org = ctx.state.organizations.find(
      (o) => o.id === ctx.user.organizationId,
    ),
    id = ctx.nextId();
  const content = {
    applicant: {
      companyName: org?.name ?? "",
      contactName: ctx.user.name,
      phone: ctx.user.phone ?? "",
      email: ctx.user.email,
    },
    test: {
      testTypeCode: requirement?.testTypeCode ?? equipment.testTypes[0] ?? null,
      purpose: requirement?.purpose ?? "",
      standard: "",
    },
    sample: {
      name: requirement?.sampleName ?? "",
      quantity: requirement?.sampleQuantity ?? null,
      readyDate: null,
    },
    conditions: structuredClone(requirement?.conditions ?? []),
    schedule: { desiredStartDate: null, desiredEndDate: null },
    equipment: {
      id: equipment.id,
      externalId: equipment.externalId,
      name: equipment.name,
    },
    notes: "",
  };
  const item = {
    id,
    ownerId: ctx.user.id,
    institutionId: equipment.institution.id,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    externalId: equipment.externalId,
    requirementId: requirement?.id ?? null,
    matchResultId: matchResultId ?? null,
    requestNo: `REQ-${ctx.now.slice(0, 10).replaceAll("-", "")}-${String(id).padStart(4, "0")}`,
    title: requirement?.title || `${equipment.name} 시험 의뢰`,
    status: "DRAFT",
    version: 0,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    submittedAt: null,
    revisions: [
      {
        revisionNo: 1,
        isAiGenerated: ai,
        content,
        createdAt: ctx.now,
        changeSummary: ai ? "DEMO AI 초안 생성" : "새 의뢰 작성",
      },
    ],
    history: [],
  };
  ctx.state.requests.push(item);
  return {
    ...requestView(ctx, item),
    aiNotes: ai
      ? [
          "DEMO 규칙 기반 초안입니다. 미확인 정보를 검토하고 수정한 뒤 직접 제출해주세요.",
        ]
      : [],
  };
}
function reservationFor(ctx) {
  const res =
    ctx.state.reservations.find((r) => r.id === Number(ctx.params.id)) ??
    reject(404, "NOT_FOUND", "예약을 찾을 수 없습니다.");
  const item = ctx.testRequest(res.requestId);
  return { res, item };
}
function validateInterval(ctx, equipmentId: number, startAt: string, endAt: string, excluding?: number) {
  const start = Date.parse(startAt),
    end = Date.parse(endAt);
  if (
    typeof startAt !== "string" ||
    typeof endAt !== "string" ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end
  )
    reject(400, "VALIDATION_FAILED", "예약 시작과 종료 시간을 확인해주세요.");
  const conflicts = ctx.state.reservations.filter(
    (r) =>
      r.id !== excluding &&
      r.equipmentId === equipmentId &&
      r.status === "CONFIRMED" &&
      start < Date.parse(r.endAt) &&
      end > Date.parse(r.startAt),
  );
  if (conflicts.length)
    reject(
      409,
      "RESERVATION_OVERLAP",
      "선택한 시간에 이미 확정된 예약이 있습니다.",
      {
        conflicts: conflicts.map(({ startAt, endAt }) => ({ startAt, endAt })),
      },
    );
}
function fieldValue(content, key) {
  if (key.includes("."))
    return key.split(".").reduce((value, k) => value?.[k], content);
  const c = content.conditions.find((c) => c.key === key);
  return c?.status === "CONFIRMED"
    ? (c.value ??
        c.valueText ??
        (c.min != null && c.max != null ? `${c.min}:${c.max}` : null))
    : null;
}
export const requestRoutes: MockRoute[] = [
  ["POST", "/test-requests", (ctx) => ok(createDraft(ctx, ctx.body), 201)],
  [
    "POST",
    "/test-requests/ai-draft",
    (ctx) => ok(createDraft(ctx, ctx.body, true), 201),
  ],
  [
    "GET",
    "/test-requests",
    (ctx) =>
      ok(
        pageOf(
          ctx.state.requests
            .filter(
              (r) =>
                ctx.requestVisible(r) &&
                (ctx.user.role !== "INSTITUTION_MANAGER" ||
                  r.status !== "DRAFT") &&
                (!ctx.url.searchParams.get("status") ||
                  r.status === ctx.url.searchParams.get("status")),
            )
            .sort((a, b) => b.id - a.id)
            .map((r) => requestView(ctx, r)),
          ctx.url,
        ),
      ),
  ],
  [
    "GET",
    "/test-requests/:id",
    (ctx) => {
      const item = ctx.testRequest(ctx.params.id);
      if (ctx.user.role === "INSTITUTION_MANAGER" && item.status === "DRAFT")
        reject(403, "FORBIDDEN", "제출 전 초안은 조회할 수 없습니다.");
      return ok(requestView(ctx, item));
    },
  ],
  [
    "PUT",
    "/test-requests/:id/draft",
    (ctx) => {
      const item = ctx.companyRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["DRAFT", "SUPPLEMENT_REQUESTED"]);
      validateContent(ctx.body.content);
      if (ctx.body.content.equipment?.id !== item.equipmentId)
        reject(409, "CONFLICT", "작성 중인 의뢰의 장비는 변경할 수 없습니다.");
      // Submitted revisions are immutable; a supplement is committed only by respond.
      if (item.status === "DRAFT")
        item.revisions.at(-1).content = structuredClone(ctx.body.content);
      else item.workingContent = structuredClone(ctx.body.content);
      item.version++;
      item.updatedAt = ctx.now;
      return ok(requestView(ctx, item));
    },
  ],
  [
    "POST",
    "/test-requests/:id/submit",
    (ctx) => {
      const item = ctx.companyRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["DRAFT"]);
      validateContent(item.revisions.at(-1).content, true);
      ctx.transition(item, "SUBMITTED");
      item.submittedAt = ctx.now;
      ctx.notifyInstitution(
        item,
        "REQUEST_SUBMITTED",
        "새 시험 의뢰가 접수되었습니다.",
      );
      return ok(requestView(ctx, item));
    },
  ],
  [
    "POST",
    "/test-requests/:id/cancel",
    (ctx) => {
      const item = ctx.companyRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "SUPPLEMENT_REQUESTED",
        "RESUBMITTED",
        "SCHEDULING",
      ]);
      ctx.transition(
        item,
        "CANCELED",
        textRequired(ctx.body.reason, "취소 사유", 1000),
      );
      for (const r of ctx.state.reservations.filter(
        (r) => r.requestId === item.id && r.status !== "CONFIRMED",
      ))
        r.status = "CANCELED";
      return ok(requestView(ctx, item));
    },
  ],
  [
    "GET",
    "/test-requests/:id/revisions",
    (ctx) => ok(ctx.testRequest(ctx.params.id).revisions),
  ],
  [
    "GET",
    "/test-requests/:id/revisions/:no",
    (ctx) =>
      ok(
        ctx
          .testRequest(ctx.params.id)
          .revisions.find((r) => r.revisionNo === Number(ctx.params.no)) ??
          reject(404, "NOT_FOUND", "제출본을 찾을 수 없습니다."),
      ),
  ],
  [
    "GET",
    "/test-requests/:id/history",
    (ctx) => ok(ctx.testRequest(ctx.params.id).history),
  ],
  [
    "POST",
    "/test-requests/:id/review/start",
    (ctx) => {
      const item = ctx.institutionRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["SUBMITTED", "RESUBMITTED"]);
      ctx.transition(item, "UNDER_REVIEW");
      return ok(requestView(ctx, item));
    },
  ],
  [
    "POST",
    "/test-requests/:id/supplements",
    (ctx) => {
      const item = ctx.institutionRequest(ctx.params.id);
      ctx.version(item);
      if (
        ctx.state.supplements.some(
          (s) => s.requestId === item.id && s.status === "OPEN",
        )
      )
        reject(
          409,
          "SUPPLEMENT_ALREADY_OPEN",
          "답변 대기 중인 보완 요청이 있습니다.",
        );
      ctx.status(item, ["UNDER_REVIEW"]);
      const message = textRequired(ctx.body.message, "보완 요청 내용", 2000),
        items = ctx.body.items;
      const validKeys = [
        ...ctx.state.rules.map((r) => r.condition_key),
        "sample.readyDate",
        "sample.name",
        "sample.quantity",
        "test.standard",
        "notes",
      ];
      if (
        !Array.isArray(items) ||
        !items.length ||
        items.some(
          (i) =>
            !validKeys.includes(i?.fieldKey) || typeof i.label !== "string",
        )
      )
        reject(400, "VALIDATION_FAILED", "보완 항목을 선택해주세요.");
      if (ctx.body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(ctx.body.dueDate))
        reject(400, "VALIDATION_FAILED", "보완 기한을 확인해주세요.");
      const supplement = {
        id: ctx.nextId(),
        requestId: item.id,
        status: "OPEN",
        message,
        items: structuredClone(items),
        dueDate: ctx.body.dueDate ?? null,
        createdAt: ctx.now,
        response: null,
      };
      ctx.state.supplements.push(supplement);
      ctx.transition(item, "SUPPLEMENT_REQUESTED", message);
      ctx.notify(item.ownerId, "SUPPLEMENT_REQUESTED", item.id, message);
      return ok(supplement, 201);
    },
  ],
  [
    "GET",
    "/test-requests/:id/supplements",
    (ctx) => {
      const item = ctx.testRequest(ctx.params.id);
      return ok(ctx.state.supplements.filter((s) => s.requestId === item.id));
    },
  ],
  [
    "POST",
    "/supplements/:id/respond",
    (ctx) => {
      const supplement =
        ctx.state.supplements.find((s) => s.id === Number(ctx.params.id)) ??
        reject(404, "NOT_FOUND", "보완 요청을 찾을 수 없습니다.");
      const item = ctx.companyRequest(supplement.requestId);
      ctx.version(item);
      ctx.status(item, ["SUPPLEMENT_REQUESTED"]);
      if (supplement.status !== "OPEN")
        reject(409, "CONFLICT", "이미 응답한 보완 요청입니다.");
      const content = ctx.body.content;
      validateContent(content, true);
      if (content.equipment?.id !== item.equipmentId)
        reject(409, "CONFLICT", "장비를 변경할 수 없습니다.");
      if (
        supplement.items.some(
          (field) =>
            field.required &&
            (fieldValue(content, field.fieldKey) === null ||
              fieldValue(content, field.fieldKey) === undefined ||
              fieldValue(content, field.fieldKey) === ""),
        )
      )
        reject(
          400,
          "VALIDATION_FAILED",
          "필수 보완 항목을 입력하고 확인해주세요.",
        );
      const revisionNo = item.revisions.at(-1).revisionNo + 1;
      item.revisions.push({
        revisionNo,
        isAiGenerated: false,
        content: structuredClone(content),
        createdAt: ctx.now,
        changeSummary: textRequired(ctx.body.changeSummary, "보완 요약", 2000),
      });
      supplement.status = "RESPONDED";
      supplement.response = {
        message: textRequired(ctx.body.message, "보완 응답", 2000),
        revisionNo,
        respondedAt: ctx.now,
      };
      delete item.workingContent;
      ctx.transition(item, "RESUBMITTED", supplement.response.message);
      ctx.notifyInstitution(
        item,
        "REQUEST_RESUBMITTED",
        "기업이 보완 정보를 재제출했습니다.",
      );
      return ok({ requestId: item.id, status: item.status, revisionNo });
    },
  ],
  [
    "POST",
    "/test-requests/:id/accept",
    (ctx) => {
      const item = ctx.institutionRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["UNDER_REVIEW"]);
      ctx.transition(item, "SCHEDULING");
      ctx.notify(
        item.ownerId,
        "REQUEST_ACCEPTED",
        item.id,
        "검토를 통과했습니다. 일정을 협의해주세요.",
      );
      return ok(requestView(ctx, item));
    },
  ],
  [
    "POST",
    "/test-requests/:id/reject",
    (ctx) => {
      const item = ctx.institutionRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["UNDER_REVIEW"]);
      ctx.transition(
        item,
        "REJECTED",
        textRequired(ctx.body.reason, "반려 사유", 2000),
      );
      ctx.notify(
        item.ownerId,
        "REQUEST_REJECTED",
        item.id,
        "의뢰가 반려되었습니다. 사유를 확인해주세요.",
      );
      return ok(requestView(ctx, item));
    },
  ],
  [
    "POST",
    "/test-requests/:id/complete",
    (ctx) => {
      const item = ctx.institutionRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["CONFIRMED"]);
      ctx.transition(item, "COMPLETED");
      return ok(requestView(ctx, item));
    },
  ],
  [
    "POST",
    "/test-requests/:id/reservations",
    (ctx) => {
      const item = ctx.testRequest(ctx.params.id);
      ctx.version(item);
      ctx.status(item, ["SCHEDULING"]);
      validateInterval(ctx, item.equipmentId, ctx.body.startAt, ctx.body.endAt);
      const res = {
        id: ctx.nextId(),
        requestId: item.id,
        equipmentId: item.equipmentId,
        startAt: ctx.body.startAt,
        endAt: ctx.body.endAt,
        note: ctx.body.note ?? "",
        status: "PROPOSED",
        createdAt: ctx.now,
        externalSystem: null,
        externalRef: null,
      };
      ctx.state.reservations.push(res);
      item.version++;
      item.updatedAt = ctx.now;
      ctx.notify(
        item.ownerId,
        "RESERVATION_PROPOSED",
        item.id,
        "예약 일정이 제안되었습니다.",
      );
      return ok(res, 201);
    },
  ],
  [
    "POST",
    "/reservations/:id/counter",
    (ctx) => {
      const { res, item } = reservationFor(ctx);
      ctx.version(item);
      ctx.status(item, ["SCHEDULING"]);
      if (!["PROPOSED", "COUNTER_PROPOSED"].includes(res.status))
        reject(409, "CONFLICT", "대안 일정을 제안할 수 없는 예약입니다.");
      validateInterval(
        ctx,
        res.equipmentId,
        ctx.body.startAt,
        ctx.body.endAt,
        res.id,
      );
      Object.assign(res, {
        startAt: ctx.body.startAt,
        endAt: ctx.body.endAt,
        note: ctx.body.note ?? "",
        status: "COUNTER_PROPOSED",
      });
      item.version++;
      return ok(res);
    },
  ],
  [
    "POST",
    "/reservations/:id/confirm",
    (ctx) => {
      ctx.role("INSTITUTION_MANAGER");
      const { res, item } = reservationFor(ctx);
      if (
        ctx.state.reservations.some(
          (r) => r.requestId === item.id && r.status === "CONFIRMED",
        )
      )
        reject(
          409,
          "RESERVATION_ALREADY_CONFIRMED",
          "이미 확정된 예약이 있습니다.",
        );
      ctx.version(item);
      ctx.status(item, ["SCHEDULING"]);
      if (!["PROPOSED", "COUNTER_PROPOSED"].includes(res.status))
        reject(409, "CONFLICT", "예약 상태를 다시 확인해주세요.");
      validateInterval(ctx, res.equipmentId, res.startAt, res.endAt, res.id);
      res.status = "CONFIRMED";
      ctx.transition(item, "CONFIRMED");
      ctx.notify(
        item.ownerId,
        "RESERVATION_CONFIRMED",
        item.id,
        "예약 일정이 확정되었습니다.",
      );
      return ok(res);
    },
  ],
  [
    "POST",
    "/reservations/:id/cancel",
    (ctx) => {
      const { res, item } = reservationFor(ctx);
      ctx.version(item);
      if (res.status === "CANCELED" || item.status === "COMPLETED")
        reject(409, "CONFLICT", "취소할 수 없는 예약입니다.");
      res.status = "CANCELED";
      if (item.status === "CONFIRMED")
        ctx.transition(item, "SCHEDULING", "예약 취소 후 재협의");
      else item.version++;
      return ok(res);
    },
  ],
  [
    "GET",
    "/equipment/:id/reservations",
    (ctx) => {
      ctx.equipment(ctx.params.id);
      const from = ctx.url.searchParams.get("from"),
        to = ctx.url.searchParams.get("to");
      return ok(
        ctx.state.reservations
          .filter(
            (r) =>
              r.equipmentId === Number(ctx.params.id) &&
              r.status === "CONFIRMED" &&
              (!from || r.endAt >= from) &&
              (!to || r.startAt.slice(0, 10) <= to),
          )
          .map(({ startAt, endAt }) => ({ startAt, endAt })),
      );
    },
  ],
];
