import type { MockRoute } from "../engine";
import {
  analyzeConditions,
  evaluateEquipment,
  interpretText,
} from "../rules";
import { ok, pageOf, reject, textRequired } from "../http";
import { createDraft } from "./requests";
import type { RequirementCondition } from "../../services/contracts";

export function normalizedConditions(ctx, code: string, input: RequirementCondition[] = [], source = "USER") {
  const rules = ctx.state.rules.filter((r) => r.test_type_code === code);
  if (
    !Array.isArray(input) ||
    input.length > 100 ||
    new Set(input.map((c) => c?.key)).size !== input.length ||
    input.some((c) => !rules.some((r) => r.condition_key === c?.key))
  )
    reject(400, "VALIDATION_FAILED", "시험유형의 조건 키를 확인해주세요.");
  return rules.map((rule) => {
    const c = input.find((v) => v.key === rule.condition_key),
      key = rule.condition_key;
    const status = c?.status ?? "MISSING";
    if (!["MISSING", "UNCONFIRMED", "CONFIRMED"].includes(status))
      reject(400, "VALIDATION_FAILED", "조건 확인 상태를 확인해주세요.");
    const result: RequirementCondition = {
      key,
      label: rule.label,
      unit: c?.unit ?? rule.unit,
      status,
      source,
      confidence: c?.confidence ?? null,
      note: c?.note ?? null,
    };
    if (!c || status === "MISSING") return result;
    if (rule.value_type === "NUMBER" && c.value != null) {
      if (!Number.isFinite(c.value))
        reject(
          400,
          "VALIDATION_FAILED",
          `${rule.label}의 숫자를 확인해주세요.`,
        );
      result.value = c.value;
    }
    if (rule.value_type === "RANGE" && (c.min != null || c.max != null)) {
      if (!Number.isFinite(c.min) || !Number.isFinite(c.max) || c.min > c.max)
        reject(
          400,
          "VALIDATION_FAILED",
          `${rule.label}의 범위를 확인해주세요.`,
        );
      result.min = c.min;
      result.max = c.max;
    }
    if (rule.value_type === "TEXT" && c.valueText != null)
      result.valueText = String(c.valueText).slice(0, 500);
    if (
      status === "CONFIRMED" &&
      result.value == null &&
      result.min == null &&
      !result.valueText?.trim()
    )
      reject(
        400,
        "VALIDATION_FAILED",
        `${rule.label}에 확인된 값을 입력해주세요.`,
      );
    if (
      [
        "kg",
        "mm",
        "Hz",
        "GHz",
        "kN",
        "N",
        "kgf",
        "x",
        "samples/day",
        "%RH",
      ].includes(rule.unit) &&
      [result.value, result.min, result.max].some((v) => v != null && v < 0)
    )
      reject(
        400,
        "VALIDATION_FAILED",
        `${rule.label}에는 음수를 입력할 수 없습니다.`,
      );
    return result;
  });
}
export function newRequirement(ctx, body, source = "USER") {
  if (!ctx.state.testTypes.some((t) => t.code === body.testTypeCode))
    reject(400, "VALIDATION_FAILED", "시험유형을 선택해주세요.");
  if (
    body.sampleQuantity != null &&
    (!Number.isInteger(body.sampleQuantity) || body.sampleQuantity < 1)
  )
    reject(400, "VALIDATION_FAILED", "시료 수량을 확인해주세요.");
  const item = {
    id: ctx.nextId(),
    ownerId: ctx.user.id,
    chatSessionId: body.chatSessionId ?? null,
    testTypeCode: body.testTypeCode,
    title: body.title ?? "",
    purpose: body.purpose ?? "",
    sampleName: body.sampleName ?? "",
    sampleQuantity: body.sampleQuantity ?? null,
    status: "DRAFT",
    conditions: normalizedConditions(
      ctx,
      body.testTypeCode,
      body.conditions ?? [],
      source,
    ),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  ctx.state.requirements.push(item);
  return item;
}
const requirementFor = (ctx, id = ctx.params.id) => {
  ctx.role("COMPANY_USER");
  return ctx.owner(ctx.state.requirements.find((r) => r.id === Number(id)));
};
const publicRequirement = ({ ownerId: _owner, ...r }) => r;
const publicChat = ({
  ownerId: _owner,
  messages: _messages,
  requirementId: _req,
  ...c
}) => c;
function chatFor(ctx) {
  ctx.role("COMPANY_USER");
  return ctx.owner(ctx.state.chats.find((c) => c.id === Number(ctx.params.id)));
}
export function matchRequirement(ctx, requirement, body: { limit?: number; region?: string } = {}) {
  const limit = body.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    reject(400, "VALIDATION_FAILED", "추천 개수는 1~20이어야 합니다.");
  const results = ctx.state.equipment
    .filter(
      (e) =>
        e.isActive &&
        e.institution.id !== ctx.user.organizationId &&
        e.testTypes.includes(requirement.testTypeCode) &&
        (!body.region || e.region === body.region),
    )
    .map((e) => ({
      id: ctx.nextId(),
      equipment: {
        id: e.id,
        externalId: e.externalId,
        name: e.name,
        institutionName: e.institution.name,
      },
      ...evaluateEquipment(requirement, e, ctx.state.rules),
    }));
  const order = { SUITABLE: 0, PARTIAL: 1, UNKNOWN: 2, UNSUITABLE: 3 };
  results.sort(
    (a, b) =>
      order[a.verdict] - order[b.verdict] ||
      b.score - a.score ||
      a.equipment.id - b.equipment.id,
  );
  const run = {
    id: ctx.nextId(),
    ownerId: ctx.user.id,
    requirementId: requirement.id,
    algorithmVersion: "rule-v1",
    createdAt: ctx.now,
    results: results
      .slice(0, limit)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
        reason: `DEMO 규칙 비교: 충족 ${r.checks.filter((c) => c.result === "MET").length}개, 불일치 ${r.checks.filter((c) => c.result === "NOT_MET").length}개, 미확인 ${r.checks.filter((c) => c.result === "UNKNOWN").length}개. 기관의 최종 검토가 필요합니다.`,
      })),
    disclaimer:
      "DEMO 규칙 기반 추천입니다. 최종 시험 가능 여부는 기관 검토로 확정됩니다.",
  };
  ctx.state.matchRuns.push(run);
  return run;
}
const publicRun = ({ ownerId: _owner, ...run }) => run;
function autoView({
  ownerId: _owner,
  updatedAt: _updated,
  inputText: _input,
  ...run
}) {
  return run;
}
function progressAuto(ctx, run) {
  if (
    run.status !== "RUNNING" ||
    Date.parse(ctx.now) - Date.parse(run.updatedAt) < 600
  )
    return;
  ctx.changed = true;
  run.updatedAt = ctx.now;
  const step = run.steps.find((s) => s.step === run.currentStep);
  const requirement = ctx.state.requirements.find(
    (r) => r.id === run.requirementId,
  );
  if (run.currentStep === "ANALYZE") {
    if (!requirement) {
      run.status = "WAITING_USER";
      step.status = "WAITING_USER";
      step.message = "시험유형을 포함한 문장으로 다시 시작해주세요.";
      return;
    }
    const analysis = analyzeConditions(requirement, ctx.state.rules);
    if (!analysis.readyForMatching) {
      run.status = "WAITING_USER";
      step.status = "WAITING_USER";
      step.message = `필수 조건 확인 필요: ${[...analysis.missing, ...analysis.unconfirmed].map((c) => c.label).join(", ")}`;
      return;
    }
    step.status = "DONE";
    step.message = "입력 조건 확인 완료 · DEMO";
    run.currentStep = "SEARCH";
  } else if (run.currentStep === "SEARCH") {
    const count = ctx.state.equipment.filter(
      (e) => e.isActive && e.testTypes.includes(requirement.testTypeCode),
    ).length;
    if (!count) {
      run.status = "WAITING_USER";
      step.status = "WAITING_USER";
      step.message = "DB에서 시험 가능한 후보를 찾지 못했습니다.";
      return;
    }
    step.status = "DONE";
    step.message = `통합 DB 후보 ${count}대`;
    run.currentStep = "MATCH";
  } else if (run.currentStep === "MATCH") {
    const match = matchRequirement(ctx, requirement);
    run.matchRunId = match.id;
    if (
      !match.results.some(
        (r) => r.verdict === "SUITABLE" || r.verdict === "PARTIAL",
      )
    ) {
      run.status = "WAITING_USER";
      step.status = "WAITING_USER";
      step.message =
        "적합성 조건을 검토해주세요. 자동으로 장비를 선택하지 않았습니다.";
      return;
    }
    step.status = "DONE";
    step.message = "조건별 규칙 비교 완료 · DEMO";
    run.currentStep = "DRAFT";
  } else if (run.currentStep === "DRAFT") {
    const match = ctx.state.matchRuns.find((m) => m.id === run.matchRunId),
      candidate = match.results.find(
        (r) => r.verdict === "SUITABLE" || r.verdict === "PARTIAL",
      );
    const draft = createDraft(
      ctx,
      {
        requirementId: requirement.id,
        equipmentId: candidate.equipment.id,
        matchResultId: candidate.id,
      },
      true,
    );
    run.draftRequestId = draft.requestId;
    step.status = "DONE";
    step.message = "초안 저장 · 사용자 검토/제출 대기";
    run.status = "SUCCEEDED";
    run.currentStep = "DONE";
    return;
  }
  const next = run.steps.find((s) => s.step === run.currentStep);
  if (next) next.status = "RUNNING";
}
export const aiRoutes: MockRoute[] = [
  [
    "POST",
    "/chat/sessions",
    (ctx) => {
      ctx.role("COMPANY_USER");
      const chat = {
        id: ctx.nextId(),
        ownerId: ctx.user.id,
        title: ctx.body.title ?? "DEMO 시험 상담",
        status: "ACTIVE",
        createdAt: ctx.now,
        updatedAt: ctx.now,
        messages: [],
        requirementId: null,
      };
      ctx.state.chats.push(chat);
      return ok(publicChat(chat), 201);
    },
  ],
  [
    "GET",
    "/chat/sessions",
    (ctx) => {
      ctx.role("COMPANY_USER");
      return ok(
        pageOf(
          ctx.state.chats
            .filter(
              (c) => ctx.user.role === "ADMIN" || c.ownerId === ctx.user.id,
            )
            .map(publicChat),
          ctx.url,
        ),
      );
    },
  ],
  [
    "GET",
    "/chat/sessions/:id/messages",
    (ctx) => ok(pageOf(chatFor(ctx).messages, ctx.url)),
  ],
  [
    "POST",
    "/chat/sessions/:id/messages",
    (ctx) => {
      const chat = chatFor(ctx),
        content = textRequired(ctx.body.content, "상담 내용"),
        userMessage = {
          id: ctx.nextId(),
          role: "USER",
          content,
          metadata: null,
          createdAt: ctx.now,
        };
      chat.messages.push(userMessage);
      const interpreted = interpretText(
        chat.messages
          .filter((m) => m.role === "USER")
          .map((m) => m.content)
          .join("\n")
          .slice(-30000),
        ctx.state.testTypes,
        ctx.state.rules,
      );
      const missing = interpreted.conditions.filter(
        (c) => c.status === "MISSING",
      );
      const assistantMessage = {
        id: ctx.nextId(),
        role: "ASSISTANT",
        createdAt: ctx.now,
        content: `[DEMO 상담 · 실제 AI 응답 아님] ${interpreted.testTypeCode ? `시험유형 ${ctx.state.testTypes.find((t) => t.code === interpreted.testTypeCode).name_ko}의 조건을 정리했습니다. ${missing.length ? `${missing.map((c) => c.label).join(", ")} 정보를 추가로 알려주세요.` : "입력한 조건을 직접 확인한 뒤 적합 장비를 비교해보세요."}` : "필요한 시험 종류와 시료 질량·주파수 등의 조건을 알려주세요. 확인되지 않은 내용은 추정하지 않습니다."}`,
        metadata: {
          extractedConditions: interpreted.conditions,
          suggestedTestType: interpreted.testTypeCode,
        },
      };
      chat.messages.push(assistantMessage);
      chat.updatedAt = ctx.now;
      return ok({ userMessage, assistantMessage });
    },
  ],
  [
    "POST",
    "/chat/sessions/:id/requirement",
    (ctx) => {
      const chat = chatFor(ctx),
        input = chat.messages
          .filter((m) => m.role === "USER")
          .map((m) => m.content)
          .join("\n");
      const interpreted = interpretText(
        input,
        ctx.state.testTypes,
        ctx.state.rules,
      );
      if (!interpreted.testTypeCode)
        reject(400, "VALIDATION_FAILED", "시험유형을 먼저 알려주세요.");
      let requirement = ctx.state.requirements.find(
        (r) => r.id === chat.requirementId,
      );
      if (!requirement) {
        requirement = newRequirement(
          ctx,
          {
            testTypeCode: interpreted.testTypeCode,
            conditions: interpreted.conditions,
            title: chat.title,
            purpose: input,
            chatSessionId: chat.id,
          },
          "AI_EXTRACTED",
        );
        chat.requirementId = requirement.id;
      } else {
        requirement.conditions = interpreted.conditions.map(
          (c) =>
            requirement.conditions.find(
              (old) => old.key === c.key && old.source === "USER",
            ) ?? c,
        );
        requirement.updatedAt = ctx.now;
      }
      return ok(publicRequirement(requirement));
    },
  ],
  [
    "POST",
    "/requirements",
    (ctx) => {
      ctx.role("COMPANY_USER");
      return ok(publicRequirement(newRequirement(ctx, ctx.body)), 201);
    },
  ],
  [
    "GET",
    "/requirements/:id",
    (ctx) => ok(publicRequirement(requirementFor(ctx))),
  ],
  [
    "PATCH",
    "/requirements/:id",
    (ctx) => {
      const r = requirementFor(ctx);
      for (const key of ["title", "purpose", "sampleName", "sampleQuantity"])
        if (ctx.body[key] !== undefined) r[key] = ctx.body[key];
      r.updatedAt = ctx.now;
      return ok(publicRequirement(r));
    },
  ],
  [
    "PUT",
    "/requirements/:id/conditions",
    (ctx) => {
      const r = requirementFor(ctx);
      r.conditions = normalizedConditions(
        ctx,
        r.testTypeCode,
        ctx.body.conditions,
      );
      r.status = "DRAFT";
      r.updatedAt = ctx.now;
      return ok(publicRequirement(r));
    },
  ],
  [
    "POST",
    "/requirements/:id/analyze",
    (ctx) => ok(analyzeConditions(requirementFor(ctx), ctx.state.rules)),
  ],
  [
    "POST",
    "/requirements/:id/confirm",
    (ctx) => {
      const r = requirementFor(ctx);
      if (!analyzeConditions(r, ctx.state.rules).readyForMatching)
        reject(409, "CONFLICT", "필수 시험조건을 입력하고 확인해주세요.");
      r.status = "CONFIRMED";
      return ok(publicRequirement(r));
    },
  ],
  [
    "POST",
    "/requirements/:id/match-runs",
    (ctx) =>
      ok(publicRun(matchRequirement(ctx, requirementFor(ctx), ctx.body)), 201),
  ],
  [
    "GET",
    "/requirements/:id/match-runs",
    (ctx) => {
      const r = requirementFor(ctx);
      return ok(
        ctx.state.matchRuns
          .filter((m) => m.requirementId === r.id)
          .map(publicRun),
      );
    },
  ],
  [
    "GET",
    "/match-runs/:id",
    (ctx) => {
      ctx.role("COMPANY_USER");
      return ok(
        publicRun(
          ctx.owner(
            ctx.state.matchRuns.find((m) => m.id === Number(ctx.params.id)),
          ),
        ),
      );
    },
  ],
  [
    "POST",
    "/ai/auto-runs",
    (ctx) => {
      ctx.role("COMPANY_USER");
      const chat = ctx.body.chatSessionId
        ? ctx.owner(
            ctx.state.chats.find(
              (c) => c.id === Number(ctx.body.chatSessionId),
            ),
          )
        : null;
      const inputText = chat
        ? chat.messages
            .filter((m) => m.role === "USER")
            .map((m) => m.content)
            .join("\n")
        : textRequired(ctx.body.inputText, "시험 목적");
      const interpreted = interpretText(
        inputText,
        ctx.state.testTypes,
        ctx.state.rules,
      );
      const requirement = interpreted.testTypeCode
        ? newRequirement(
            ctx,
            {
              testTypeCode: interpreted.testTypeCode,
              conditions: interpreted.conditions,
              purpose: inputText,
              title: "DEMO 자동 추진 의뢰",
            },
            "AI_EXTRACTED",
          )
        : null;
      const run = {
        id: ctx.nextId(),
        ownerId: ctx.user.id,
        status: "RUNNING",
        currentStep: "ANALYZE",
        inputText,
        updatedAt: ctx.now,
        requirementId: requirement?.id ?? null,
        matchRunId: null,
        draftRequestId: null,
        steps: ["ANALYZE", "SEARCH", "MATCH", "DRAFT"].map((step, i) => ({
          step,
          status: i === 0 ? "RUNNING" : "PENDING",
          message: null,
        })),
      };
      ctx.state.autoRuns.push(run);
      return ok(autoView(run), 202);
    },
  ],
  [
    "GET",
    "/ai/auto-runs/:id",
    (ctx) => {
      ctx.role("COMPANY_USER");
      const run = ctx.owner(
        ctx.state.autoRuns.find((r) => r.id === Number(ctx.params.id)),
      );
      progressAuto(ctx, run);
      return ok(autoView(run));
    },
  ],
  [
    "POST",
    "/ai/auto-runs/:id/resume",
    (ctx) => {
      ctx.role("COMPANY_USER");
      const run = ctx.owner(
        ctx.state.autoRuns.find((r) => r.id === Number(ctx.params.id)),
      );
      if (run.status !== "WAITING_USER")
        reject(
          409,
          "CONFLICT",
          "사용자 입력 대기 상태에서만 재개할 수 있습니다.",
        );
      run.status = "RUNNING";
      run.currentStep = "ANALYZE";
      run.steps.forEach((s, i) => {
        s.status = i === 0 ? "RUNNING" : "PENDING";
        s.message = null;
      });
      run.updatedAt = ctx.now;
      return ok(autoView(run));
    },
  ],
  [
    "POST",
    "/ai/auto-runs/:id/cancel",
    (ctx) => {
      ctx.role("COMPANY_USER");
      const run = ctx.owner(
        ctx.state.autoRuns.find((r) => r.id === Number(ctx.params.id)),
      );
      if (!["PENDING", "RUNNING", "WAITING_USER"].includes(run.status))
        reject(409, "CONFLICT", "이미 종료된 자동 추진입니다.");
      run.status = "CANCELED";
      return ok(autoView(run));
    },
  ],
];
