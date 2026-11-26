/**
 * 가상 시뮬레이션 → 시험 의뢰서 미리 채우기
 *
 * 시뮬레이션은 화면 계산용 입력(시료 무게, 주파수, 온도 등)을 쓰고, 의뢰서의 조건 칸은 시험 종류마다
 * 서버가 주는 conditionRules(GET /test-types/{code})로 만들어집니다. 명세에 조건 키가 나온 시험은 진동뿐이라
 * 키를 하드코딩하지 않고, 시뮬레이션 값마다 '후보 키 · 이름 낱말 · 단위'를 붙여 실제 규칙과 맞춥니다.
 *   1) 규칙의 conditionKey 가 후보 키에 있으면 그 값
 *   2) 아니면 규칙 이름(label)에 낱말이 들어 있는 값 중 가장 긴 낱말이 맞은 값 ('고정구 질량'은 '질량'보다 '고정구')
 *   3) 값 모양(단일값·범위·글)이 맞고 단위를 바꿀 수 있어야 함 (Hz↔kHz↔MHz↔GHz, g↔kg, mm↔m↔µm, 초↔분↔시간)
 * 맞는 규칙이 없는 값은 버리지 않고 '세부 시험조건' 메모(요약)에 그대로 남습니다.
 */
import type { ConditionRule, RequirementCondition } from "../services/contracts";

export interface SimFact {
  label: string;
  /** 서버 conditionKey 후보 (명세에 나온 키를 앞에) */
  keys: string[];
  /** 규칙 이름에 들어 있으면 같은 항목으로 보는 낱말 (공백 없이) */
  words: string[];
  unit: string | null;
  value?: number;
  min?: number;
  max?: number;
  valueText?: string;
}

export interface SimulationPrefill {
  /** 시뮬레이션한 시험 종류 코드 (의뢰서 test.testTypeCode) */
  testTypeCode: string;
  equipmentId: number;
  facts: SimFact[];
  /** 세부 시험조건 메모에 넣을 글 (요약 · 판정 · 예상 시간·이용료) */
  notes: string;
  sampleQuantity?: number;
}

const UNIT_GROUPS: Record<string, number>[] = [
  { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9 },
  { g: 1e-3, kg: 1, t: 1e3 },
  { µm: 1e-6, um: 1e-6, mm: 1e-3, cm: 1e-2, m: 1 },
  { 초: 1, s: 1, sec: 1, 분: 60, min: 60, 시간: 3600, h: 3600, hr: 3600 },
];
const norm = (unit?: string | null) => (unit ?? "").replace(/\s+/g, "").replace("°C", "℃").toLowerCase();

/** from 단위의 값을 to 단위로. 같은 단위면 그대로, 바꿀 수 없으면 null */
function convert(value: number, from: string | null, to?: string | null) {
  const a = norm(from), b = norm(to);
  if (!b || a === b) return value;
  const group = UNIT_GROUPS.find((g) => a in g && b in g);
  return group ? (value * group[a]) / group[b] : null;
}
const round = (v: number) => Number(v.toPrecision(10));

/** 규칙 하나에 맞는 값을 조건으로. 맞지 않으면 null */
function toCondition(rule: ConditionRule, fact: SimFact): RequirementCondition | null {
  const base = { key: rule.conditionKey, label: rule.label, unit: rule.unit ?? fact.unit, status: "CONFIRMED", source: "USER" };
  const type = rule.valueType.toUpperCase();
  if (type === "RANGE") {
    if (fact.min == null || fact.max == null) return null;
    const min = convert(fact.min, fact.unit, rule.unit), max = convert(fact.max, fact.unit, rule.unit);
    return min == null || max == null ? null : { ...base, min: round(min), max: round(max) };
  }
  if (type === "NUMBER") {
    if (fact.value == null) return null;
    const value = convert(fact.value, fact.unit, rule.unit);
    return value == null ? null : { ...base, value: round(value) };
  }
  // TEXT: 글 값이 있으면 그대로, 숫자면 '값 단위'로
  const text = fact.valueText ?? (fact.value != null ? `${fact.value} ${fact.unit ?? ""}`.trim()
    : fact.min != null && fact.max != null ? `${fact.min}~${fact.max} ${fact.unit ?? ""}`.trim() : "");
  return text ? { ...base, unit: rule.unit ?? null, valueText: text } : null;
}

/** conditionRules 에 시뮬레이션 값을 맞춰 조건 목록을 만듭니다. 값 하나는 규칙 하나에만 씁니다. */
export function conditionsFromSimulation(rules: ConditionRule[], facts: SimFact[]) {
  const used = new Set<SimFact>();
  const conditions: RequirementCondition[] = [];
  for (const rule of rules) {
    const label = rule.label.replace(/\s+/g, "").toLowerCase();
    const candidates = facts.filter((f) => !used.has(f));
    const byKey = candidates.find((f) => f.keys.includes(rule.conditionKey));
    const byWord = candidates
      .map((f) => ({ f, score: Math.max(0, ...f.words.filter((w) => label.includes(w.toLowerCase())).map((w) => w.length)) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score);
    for (const fact of [byKey, ...byWord.map((x) => x.f)].filter((f): f is SimFact => !!f)) {
      const condition = toCondition(rule, fact);
      if (condition) { conditions.push(condition); used.add(fact); break; }
    }
  }
  return { conditions, unused: facts.filter((f) => !used.has(f)) };
}
