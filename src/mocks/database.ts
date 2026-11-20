import catalog from "./data/catalog.json" with { type: "json" };

export const MOCK_PASSWORD = "AstraDemo!2026";
export const MOCK_STORAGE_KEY = "astra.mock.database.v3";
export const DEMO_WARNING =
  "가상 시연 모델입니다. 실제 장비 성능·시험 적합성을 의미하지 않습니다.";
const clone = (value) => structuredClone(value);
export const mockAccounts = [
  {
    id: 2,
    email: "company@astra.demo",
    name: "홍길동",
    role: "COMPANY_USER",
    status: "ACTIVE",
    organizationId: 10,
    label: "기업",
  },
  {
    id: 3,
    email: "manager1@astra.demo",
    name: "김담당",
    role: "INSTITUTION_MANAGER",
    status: "ACTIVE",
    organizationId: 2,
    label: "기관 · 장비 48",
  },
  {
    id: 4,
    email: "manager2@astra.demo",
    name: "박담당",
    role: "INSTITUTION_MANAGER",
    status: "ACTIVE",
    organizationId: 6,
    label: "다른 기관 · 장비 44",
  },
  {
    id: 1,
    email: "admin@astra.demo",
    name: "플랫폼 관리자",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: null,
    label: "관리자",
  },
  {
    id: 5,
    email: "pending@astra.demo",
    name: "승인 대기 시연",
    role: "INSTITUTION_MANAGER",
    status: "PENDING",
    organizationId: 11,
    label: "승인 대기",
  },
  {
    id: 6,
    email: "rejected@astra.demo",
    name: "가입 거절 시연",
    role: "COMPANY_USER",
    status: "REJECTED",
    organizationId: 12,
    label: "거절",
  },
  {
    id: 7,
    email: "suspended@astra.demo",
    name: "계정 정지 시연",
    role: "COMPANY_USER",
    status: "SUSPENDED",
    organizationId: 13,
    label: "정지",
  },
  {
    id: 8,
    email: "other@astra.demo",
    name: "다른 기업 시연",
    role: "COMPANY_USER",
    status: "ACTIVE",
    organizationId: 14,
    label: "다른 기업",
  },
];

export function seedDatabase() {
  const t = clone(catalog.tables);
  const organizations = t.organizations.map((o) => ({
    id: o.id,
    orgType: "INSTITUTION",
    name: o.name,
    region: o.region,
    isVerified: true,
    createdAt: null,
  }));
  organizations.push(
    ...[
      [10, "COMPANY", "가상 A기업", true],
      [11, "INSTITUTION", "DEMO 승인 대기 기관", false],
      [12, "COMPANY", "DEMO 가입 거절 기업", false],
      [13, "COMPANY", "DEMO 이용 정지 기업", true],
      [14, "COMPANY", "DEMO 다른 기업", true],
    ].map(([id, orgType, name, isVerified]) => ({
      id,
      orgType,
      name,
      isVerified,
      region: null,
      createdAt: null,
    })),
  );
  const equipment = t.equipment.map((e) => ({
    id: e.id,
    externalId: e.external_id,
    name: e.name,
    model: e.model,
    institution: {
      id: e.institution_id,
      name: organizations.find((o) => o.id === e.institution_id).name,
    },
    manufacturer: e.manufacturer,
    category: e.category,
    description: null,
    region: e.region,
    equipmentType: e.equipment_type,
    testTypes: t.equipment_test_types
      .filter((v) => v.equipment_id === e.id)
      .map((v) => v.test_type_code),
    availability: e.availability,
    utilizationRate: e.utilization_rate,
    feeText: e.fee_text,
    verificationStatus: e.verification_status,
    isMock: e.is_mock,
    infoUpdatedAt: null,
    isActive: true,
    usage: {
      accessScope: e.access_scope,
      feeText: e.fee_text,
      feeAmount: e.fee_amount,
      feeUnit: e.fee_unit,
      durationText: e.duration_text,
      utilizationRate: e.utilization_rate,
      availability: e.availability,
    },
    specs: t.equipment_specs
      .filter((s) => s.equipment_id === e.id)
      .map((s) => ({
        key: s.spec_key,
        label: s.label,
        value: s.value_num,
        min: s.min_num,
        max: s.max_num,
        unit: s.unit,
        sourceType: s.source_type,
        verificationStatus: s.verification_status,
        usageScope: s.usage_scope,
      })),
    source: {
      type: e.source_type,
      url: e.source_url,
      file: e.source_file,
      page: e.source_page,
    },
    simulation: {
      capability: e.simulation_capability,
      presetIds: t.simulation_presets
        .filter((p) => p.equipment_id === e.id)
        .map((p) => p.preset_id),
    },
  }));
  return {
    schemaVersion: 3,
    sequence: 1000,
    organizations,
    equipment,
    testTypes: t.test_types,
    rules: t.test_condition_rules,
    models: t.simulation_models,
    presets: t.simulation_presets,
    equipmentTestTypes: t.equipment_test_types,
    users: mockAccounts.map(({ label: _label, ...user }) => ({
      ...user,
      phone: null,
      createdAt: null,
      lastLoginAt: null,
      rejectReason: user.status === "REJECTED" ? "DEMO 소속 확인 불가" : null,
    })),
    sessions: [],
    chats: [],
    requirements: [],
    matchRuns: [],
    requests: [],
    reservations: [],
    supplements: [],
    simulations: [],
    autoRuns: [],
    notifications: [],
    changeLogs: [],
  };
}

export function createMockDatabase(storage) {
  let state = seedDatabase();
  return {
    read() {
      try {
        const saved = JSON.parse(storage?.getItem(MOCK_STORAGE_KEY) ?? "null");
        if (
          saved?.schemaVersion === 3 &&
          [
            "requests",
            "equipment",
            "users",
            "sessions",
            "organizations",
            "rules",
            "requirements",
            "matchRuns",
            "chats",
            "autoRuns",
            "notifications",
            "reservations",
            "supplements",
            "models",
            "presets",
            "simulations",
            "equipmentTestTypes",
          ].every((key) => Array.isArray(saved[key]))
        )
          state = saved;
      } catch {
        /* Corrupt/blocked storage falls back to memory. */
      }
      return clone(state);
    },
    write(next) {
      state = clone(next);
      try {
        storage?.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* Memory-only Mock session. */
      }
    },
    reset() {
      state = seedDatabase();
      try {
        storage?.removeItem(MOCK_STORAGE_KEY);
      } catch {
        /* Already reset in memory. */
      }
    },
  };
}
let storage;
try {
  if (typeof window !== "undefined") storage = window.localStorage;
} catch {
  /* Optional. */
}
export const mockDatabase = createMockDatabase(storage);
