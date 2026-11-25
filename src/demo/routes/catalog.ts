import type { MockRoute } from "../engine";
import { interpretText } from "../rules";
import { ok, pageOf, reject, summaryEquipment, textRequired } from "../http";

export function testTypeDetail(ctx, code) {
  const type =
    ctx.state.testTypes.find((t) => t.code === code) ??
    reject(404, "NOT_FOUND", "시험유형을 찾을 수 없습니다.");
  const available = ctx.state.equipment.filter(
    (e) => e.isActive && e.testTypes.includes(code),
  );
  return {
    code: type.code,
    nameKo: type.name_ko,
    description: null,
    conditionRules: ctx.state.rules
      .filter((r) => r.test_type_code === code)
      .map((r) => ({
        conditionKey: r.condition_key,
        label: r.label,
        valueType: r.value_type,
        unit: r.unit,
        isRequired: r.is_required,
        specKey: r.spec_key,
        comparator: r.comparator,
      })),
    institutions: [...new Set(available.map((e) => e.institution.id))].map(
      (id) => {
        const org = ctx.state.organizations.find((o) => o.id === id);
        const own = available.filter((e) => e.institution.id === id);
        return {
          id,
          name: org.name,
          region: org.region,
          equipmentCount: own.length,
          estCostMin: null,
          estCostMax: null,
          estDurationDays: null,
          accessScope: own.some(
            (e) => e.usage.accessScope === "EXTERNAL_ALLOWED",
          )
            ? "EXTERNAL_ALLOWED"
            : own.every((e) => e.usage.accessScope === "INTERNAL_ONLY")
              ? "INTERNAL_ONLY"
              : "UNKNOWN",
        };
      },
    ),
  };
}
const comparableSpec = (e, key) =>
  e.specs.find((s) => s.key === key && s.sourceType === "REAL") ??
  e.specs.find((s) => s.key === key);
function validateSpecs(specs) {
  if (!Array.isArray(specs) || specs.length > 100)
    reject(400, "VALIDATION_FAILED", "사양 목록을 확인해주세요.");
  if (new Set(specs.map((s) => s?.key)).size !== specs.length)
    reject(400, "VALIDATION_FAILED", "사양 키는 중복될 수 없습니다.");
  return specs.map((s) => {
    textRequired(s?.key, "사양 키", 100);
    textRequired(s.label, "사양 이름", 200);
    const nums = ["value", "min", "max"];
    if (
      nums.some((k) => s[k] != null && !Number.isFinite(s[k])) ||
      (s.min != null && s.max != null && s.min > s.max)
    )
      reject(400, "VALIDATION_FAILED", "사양 범위가 올바르지 않습니다.");
    return {
      ...s,
      sourceType: "MOCK",
      verificationStatus: "UNVERIFIED",
      usageScope: "GENERAL",
    };
  });
}
export const catalogRoutes: MockRoute[] = [
  [
    "GET",
    "/equipment",
    (ctx) => {
      const p = ctx.url.searchParams,
        q = p.get("q")?.toLowerCase(),
        regions = p.getAll("region");
      const sort = p.get("sort") ?? "externalId,asc";
      if (!["externalId", "infoUpdatedAt"].includes(sort.split(",")[0]))
        reject(400, "VALIDATION_FAILED", "지원하지 않는 정렬입니다.");
      const types = ctx.state.testTypes
        .filter((t) =>
          [t.code, t.name_ko, ...t.keywords].some(
            (s) => q && s.toLowerCase().includes(q),
          ),
        )
        .map((t) => t.code);
      const items = ctx.state.equipment.filter(
        (e) =>
          e.isActive &&
          (!q ||
            [e.name, e.model, e.manufacturer].some((s) =>
              s?.toLowerCase().includes(q),
            ) ||
            e.testTypes.some((t) => types.includes(t))) &&
          (!regions.length || regions.includes(e.region)) &&
          (!p.get("institutionId") ||
            e.institution.id === Number(p.get("institutionId"))) &&
          (!p.get("testType") || e.testTypes.includes(p.get("testType"))) &&
          (!p.get("equipmentType") ||
            e.equipmentType === p.get("equipmentType")) &&
          (!p.get("availability") ||
            e.availability === p.get("availability")) &&
          (p.get("includeMock") !== "false" || !e.isMock) &&
          (p.get("externalOnly") !== "true" ||
            e.usage.accessScope === "EXTERNAL_ALLOWED"),
      );
      const [key, dir] = sort.split(",");
      items.sort(
        (a, b) =>
          String(a[key] ?? "").localeCompare(String(b[key] ?? "")) *
          (dir === "desc" ? -1 : 1),
      );
      return ok(pageOf(items.map(summaryEquipment), ctx.url));
    },
  ],
  ["GET", "/equipment/:id", (ctx) => ok(ctx.equipment(ctx.params.id))],
  [
    "GET",
    "/test-types",
    (ctx) =>
      ok(
        ctx.state.testTypes.map((t) => ({
          code: t.code,
          nameKo: t.name_ko,
          description: null,
          keywords: t.keywords,
          equipmentCount: ctx.state.equipment.filter(
            (e) => e.isActive && e.testTypes.includes(t.code),
          ).length,
        })),
      ),
  ],
  [
    "GET",
    "/test-types/:code",
    (ctx) => ok(testTypeDetail(ctx, ctx.params.code)),
  ],
  [
    "GET",
    "/search",
    (ctx) => {
      const q = textRequired(ctx.url.searchParams.get("q"), "검색어", 1000),
        interpreted = interpretText(q, ctx.state.testTypes, ctx.state.rules);
      const items = ctx.state.equipment.filter(
        (e) =>
          e.isActive &&
          (interpreted.testTypes.length
            ? e.testTypes.some((t) => interpreted.testTypes.includes(t))
            : [e.name, e.model, e.manufacturer, e.institution.name].some((v) =>
                v?.toLowerCase().includes(q.toLowerCase()),
              )) &&
          (!interpreted.regions.length ||
            interpreted.regions.includes(e.region)),
      );
      return ok({
        interpreted: {
          interpreter: "KEYWORD",
          testTypes: interpreted.testTypes,
          conditions: interpreted.conditions.filter(
            (c) => c.status === "CONFIRMED",
          ),
          regions: interpreted.regions,
        },
        testTypes: ctx.state.testTypes
          .filter((t) => interpreted.testTypes.includes(t.code))
          .map((t) => ({ code: t.code, nameKo: t.name_ko })),
        equipment: items.slice(0, 20).map(summaryEquipment),
      });
    },
  ],
  [
    "GET",
    "/equipment/duplicates",
    (ctx) => {
      const groups = [];
      for (const region of [
        ...new Set(ctx.state.equipment.map((e) => e.region).filter(Boolean)),
      ])
        for (const t of ctx.state.testTypes) {
          if (
            ctx.url.searchParams.get("region") &&
            ctx.url.searchParams.get("region") !== region
          )
            continue;
          if (
            ctx.url.searchParams.get("testType") &&
            ctx.url.searchParams.get("testType") !== t.code
          )
            continue;
          const equipment = ctx.state.equipment.filter(
            (e) =>
              e.isActive && e.region === region && e.testTypes.includes(t.code),
          );
          if (equipment.length > 1)
            groups.push({
              region,
              testType: { code: t.code, nameKo: t.name_ko },
              equipmentCount: equipment.length,
              institutionCount: new Set(equipment.map((e) => e.institution.id))
                .size,
              equipment: equipment.map(summaryEquipment),
            });
        }
      return ok(groups.sort((a, b) => b.equipmentCount - a.equipmentCount));
    },
  ],
  [
    "GET",
    "/equipment/:id/similar",
    (ctx) => {
      const item = ctx.equipment(ctx.params.id);
      return ok(
        ctx.state.equipment
          .filter(
            (e) =>
              e.isActive &&
              e.id !== item.id &&
              (e.testTypes.some((t) => item.testTypes.includes(t)) ||
                (e.equipmentType === item.equipmentType &&
                  e.category &&
                  e.category === item.category)),
          )
          .slice(0, 10)
          .map((e) => ({
            equipment: summaryEquipment(e),
            reasons: [
              e.testTypes.some((t) => item.testTypes.includes(t))
                ? "같은 시험유형"
                : "같은 장비 유형·분류",
            ],
            nameSimilarity: null,
          })),
      );
    },
  ],
  [
    "POST",
    "/equipment/compare",
    (ctx) => {
      const ids = ctx.body.equipmentIds;
      if (
        !Array.isArray(ids) ||
        ids.length < 2 ||
        ids.length > 5 ||
        new Set(ids).size !== ids.length
      )
        reject(
          400,
          "VALIDATION_FAILED",
          "서로 다른 장비 2~5대를 선택해주세요.",
        );
      if (ctx.body.testType) testTypeDetail(ctx, ctx.body.testType);
      const equipment = ids.map((id) => ctx.equipment(id)),
        keys = [
          ...new Set(equipment.flatMap((e) => e.specs.map((s) => s.key))),
        ];
      const rows = keys.map((key) => ({
        key,
        label: equipment.flatMap((e) => e.specs).find((s) => s.key === key)
          .label,
        values: equipment.map((e) => {
          const spec = comparableSpec(e, key);
          return spec ? { equipmentId: e.id, ...spec } : null;
        }),
      }));
      return ok({
        equipment: equipment.map(summaryEquipment),
        rows,
        usage: equipment.map((e) => ({
          equipmentId: e.id,
          ...e.usage,
          verificationStatus: e.verificationStatus,
          infoUpdatedAt: e.infoUpdatedAt,
          testTypeEstimate: ctx.body.testType
            ? {
                code: ctx.body.testType,
                supported: e.testTypes.includes(ctx.body.testType),
                estCostMin: null,
                estCostMax: null,
                estDurationDays: null,
              }
            : null,
        })),
        testType: ctx.body.testType ?? null,
        usedMockData: rows.some((r) =>
          r.values.some((v) => v?.sourceType === "MOCK"),
        ),
      });
    },
  ],
  [
    "GET",
    "/institutions",
    (ctx) =>
      ok(
        ctx.state.organizations
          .filter((o) => ["INSTITUTION", "UNIVERSITY"].includes(o.orgType) && o.isVerified)
          .map((o) => ({
            ...o,
            equipmentCount: ctx.state.equipment.filter(
              (e) => e.isActive && e.institution.id === o.id,
            ).length,
          })),
      ),
  ],
  [
    "GET",
    "/institutions/me/equipment",
    (ctx) => {
      ctx.role("INSTITUTION_MANAGER");
      const id =
        ctx.user.role === "ADMIN"
          ? Number(ctx.url.searchParams.get("institutionId"))
          : ctx.user.organizationId;
      if (!id)
        reject(400, "VALIDATION_FAILED", "관리자는 기관을 선택해주세요.");
      return ok(
        pageOf(
          ctx.state.equipment
            .filter((e) => e.isActive && e.institution.id === id)
            .map((e) => ({
              ...summaryEquipment(e),
              needsUpdate: e.verificationStatus !== "INSTITUTION_VERIFIED" || e.availability === "UNKNOWN" || !e.availabilityUpdatedAt,
              updateReasons:
                e.verificationStatus !== "INSTITUTION_VERIFIED"
                  ? ["NOT_CONFIRMED"]
                  : [],
              daysSinceUpdate: null,
            })),
          ctx.url,
        ),
      );
    },
  ],
  [
    "POST",
    "/equipment",
    (ctx) => {
      ctx.role("INSTITUTION_MANAGER");
      const institutionId =
        ctx.user.role === "ADMIN"
          ? Number(ctx.body.institutionId)
          : ctx.user.organizationId;
      const org =
        ctx.state.organizations.find(
          (o) => o.id === institutionId && ["COMPANY", "INSTITUTION", "UNIVERSITY"].includes(o.orgType),
        ) ?? reject(400, "VALIDATION_FAILED", "기관을 선택해주세요.");
      const name = textRequired(ctx.body.name, "장비명", 200),
        id = ctx.nextId();
      const specs = validateSpecs(ctx.body.specs ?? []),
        testTypes = ctx.body.testTypes ?? [];
      if (
        testTypes.some(
          (code) => !ctx.state.testTypes.some((t) => t.code === code),
        )
      )
        reject(400, "VALIDATION_FAILED", "시험유형을 확인해주세요.");
      const item = {
        id,
        externalId: `ASTRA-EQ-${String(id).padStart(4, "0")}`,
        name,
        model: ctx.body.model ?? null,
        manufacturer: ctx.body.manufacturer ?? null,
        category: ctx.body.category ?? null,
        description: ctx.body.description ?? null,
        institution: { id: org.id, name: org.name },
        region: ctx.body.region ?? org.region,
        equipmentType: ctx.body.equipmentType ?? "TEST",
        testTypes,
        availability: "UNKNOWN",
        utilizationRate: null,
        feeText: null,
        verificationStatus: "INSTITUTION_VERIFIED",
        isMock: true,
        isActive: true,
        infoUpdatedAt: ctx.now,
        usage: {
          accessScope: "UNKNOWN",
          feeText: null,
          feeAmount: null,
          feeUnit: null,
          durationText: null,
          utilizationRate: null,
          availability: "UNKNOWN",
          ...ctx.body.usage,
        },
        specs,
        source: { type: "INSTITUTION", url: null, file: null, page: null },
        simulation: { capability: null, presetIds: [] },
      };
      ctx.state.equipment.push(item);
      return ok(
        {
          id,
          externalId: item.externalId,
          verificationStatus: item.verificationStatus,
        },
        201,
      );
    },
  ],
  [
    "PATCH",
    "/equipment/:id",
    (ctx) => {
      const item = ctx.manageEquipment(ctx.equipment(ctx.params.id));
      for (const key of [
        "name",
        "model",
        "manufacturer",
        "category",
        "description",
        "region",
      ])
        if (ctx.body[key] !== undefined) item[key] = ctx.body[key];
      if (ctx.body.name !== undefined)
        textRequired(ctx.body.name, "장비명", 200);
      if (ctx.body.usage) {
        const u = ctx.body.usage;
        if (
          u.utilizationRate != null &&
          (!Number.isFinite(u.utilizationRate) ||
            u.utilizationRate < 0 ||
            u.utilizationRate > 100)
        )
          reject(400, "VALIDATION_FAILED", "가동률은 0~100이어야 합니다.");
        if (
          u.feeAmount != null &&
          (!Number.isInteger(u.feeAmount) || u.feeAmount < 0)
        )
          reject(400, "VALIDATION_FAILED", "이용료를 확인해주세요.");
        Object.assign(item.usage, u);
        item.feeText = item.usage.feeText;
        item.availability = item.usage.availability;
        item.utilizationRate = item.usage.utilizationRate;
      }
      if (ctx.body.testTypes !== undefined) {
        if (!Array.isArray(ctx.body.testTypes) || !ctx.body.testTypes.length || ctx.body.testTypes.some(code => !ctx.state.testTypes.some(t => t.code === code))) reject(400, "VALIDATION_FAILED", "시험유형을 확인해주세요.");
        item.testTypes = [...new Set(ctx.body.testTypes)];
      }
      if (ctx.body.availability !== undefined) {
        if (!["AVAILABLE", "BUSY", "MAINTENANCE", "UNAVAILABLE", "UNKNOWN"].includes(ctx.body.availability)) reject(400, "VALIDATION_FAILED", "가용 상태를 확인해주세요.");
        item.availability = item.usage.availability = ctx.body.availability;
        item.availabilityUpdatedAt = ctx.now;
        item.availabilityNeedsConfirmation = false;
      }
      item.infoUpdatedAt = ctx.now;
      return ok(item);
    },
  ],
  [
    "PUT",
    "/equipment/:id/specs",
    (ctx) => {
      const item = ctx.manageEquipment(ctx.equipment(ctx.params.id));
      item.specs = [
        ...validateSpecs(ctx.body.specs),
      ];
      item.infoUpdatedAt = ctx.now;
      item.verificationStatus = "INSTITUTION_VERIFIED";
      return ok(item);
    },
  ],
  [
    "POST",
    "/equipment/:id/confirm",
    (ctx) => {
      const item = ctx.manageEquipment(ctx.equipment(ctx.params.id));
      item.verificationStatus = "INSTITUTION_VERIFIED";
      item.infoUpdatedAt = ctx.now;
      return ok(item);
    },
  ],
  [
    "DELETE",
    "/equipment/:id",
    (ctx) => {
      const item = ctx.manageEquipment(ctx.equipment(ctx.params.id));
      item.isActive = false;
      return ok(null);
    },
  ],
];
