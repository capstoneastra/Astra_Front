import catalog from "./data/catalog.json" with { type: "json" };
import { apiConfig } from "../api/config";

export const MOCK_STORAGE_KEY = "astra.mock.database.v3";
export const DEMO_WARNING =
  "가상 시연 모델입니다. 실제 장비 성능·시험 적합성을 의미하지 않습니다.";
const clone = (value) => structuredClone(value);

export function seedDatabase() {
  const t = clone(catalog.tables);
  const organizations = t.organizations.map((o) => ({
    id: o.id,
    orgType: [5, 7].includes(o.id) ? "UNIVERSITY" : o.org_type,
    name: o.name,
    region: o.region,
    isVerified: true,
    createdAt: null,
  }));
  organizations.push(
    ...[
      [10, "COMPANY", "가상 A기업", true],
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
  };
}
let storage;
try {
  if (typeof window !== "undefined" && !apiConfig.isPreview) storage = window.localStorage;
} catch {
  /* Optional. */
}
export const mockDatabase = createMockDatabase(storage);
