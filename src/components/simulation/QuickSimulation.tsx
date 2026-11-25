import { useMemo, useState } from "react";
import { ArrowRight, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { useWorkspace } from "../../context/AppContext";
import type { Equipment } from "../../services/equipmentService";
import { Button, Panel } from "../ui";
import ApiState from "../ui/ApiState";
import { LineChart } from "./LineChart";
import { valueText } from "../../domain/constants";

/**
 * 간이 가상 시뮬레이션 (3D 없이, 서버 없이 바로 계산)
 * 시험 조건을 넣으면 ① 선택한 장비 범위 안에 드는지 ② 시험 시간·이용료가 대략 얼마인지 계산합니다.
 * 사용한 식은 화면 아래 '계산 기준'에 그대로 적어, 결과를 검증할 수 있게 했습니다.
 */
type Kind = "VIBRATION" | "THERMAL_VACUUM" | "SHOCK" | "TEMPERATURE_HUMIDITY" | "ACOUSTIC_NOISE" | "EMC" | "ELECTRICAL_RF_ANALYSIS" | "X_RAY_INSPECTION";
/** v12: 시험 종류 8가지. 화면에는 이 중 '등록된 장비가 있는 시험'만 보여줍니다. */
const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "VIBRATION", label: "진동 (정현파 스윕)", hint: "가진력·변위·주파수" },
  { key: "THERMAL_VACUUM", label: "열진공 (열사이클)", hint: "온도 범위·시험 기간" },
  { key: "SHOCK", label: "충격 (SRS)", hint: "최대 가속도·주파수" },
  { key: "TEMPERATURE_HUMIDITY", label: "온습도 (사이클)", hint: "온도·습도 범위·기간" },
  { key: "ACOUSTIC_NOISE", label: "음향 (잔향실)", hint: "전체 음압·시험 시간" },
  { key: "EMC", label: "전자파적합성 (EMC)", hint: "주파수·전계 세기·시간" },
  { key: "ELECTRICAL_RF_ANALYSIS", label: "안테나 근접전계 측정", hint: "주파수·안테나 크기·측정점" },
  { key: "X_RAY_INSPECTION", label: "X선 CT 검사", hint: "두께·분해능·시편 수" },
];
const DEFAULTS: Record<string, string> = {
  mass: "12", fixture: "8", accel: "5", fmin: "10", fmax: "2000", rate: "2", axes: "3", setup: "2",
  hot: "70", cold: "-40", cycles: "8", ramp: "2", dwell: "2", start: "20", pump: "8",
  srs: "2000", knee: "2000", f1: "100", f2: "5000", shots: "3", smass: "5",
  thHot: "85", thCold: "-40", thRh: "80", thCycles: "10", thRamp: "3", thDwell: "1",
  acSpl: "142", acF1: "25", acF2: "10000", acDur: "60", acRuns: "3", acSetup: "4",
  emcF1: "0.15", emcF2: "6000", emcField: "20", emcDwell: "2", emcFaces: "2", emcSetup: "3",
  rfF1: "2", rfF2: "12", rfSize: "1", rfFreqs: "5", rfPols: "2", rfSetup: "4",
  xrMass: "8", xrThick: "15", xrRes: "50", xrCount: "2",
};
const G0 = 9.80665;

interface Check { label: string; need: string; limit: string; ratio: number | null; note?: string; range?: boolean }

const specOf = (item: Equipment | undefined, ...keys: string[]) => item?.specs?.find((s) => keys.includes(s.key));
const num = (value: string) => (value.trim() === "" ? NaN : Number(value));
const fmt = (v: number, digits = 1) => (Number.isFinite(v) ? v.toLocaleString("ko-KR", { maximumFractionDigits: digits }) : "—");
const won = (v: number) => (v >= 10000 ? `${fmt(v / 10000, 0)}만원` : `${fmt(v, 0)}원`);

/** 입력 항목: 쉬운 이름 · 무슨 뜻인지 · 장비 한계(있으면) */
interface FieldDef { key: string; label: string; unit: string; help: string; step?: string; limit?: (e: Equipment | undefined) => string | null }
const range = (e: Equipment | undefined, key: string, unit: string) => {
  const sp = specOf(e, key);
  return sp?.min != null && sp?.max != null ? `장비 ${fmt(sp.min)}~${fmt(sp.max)} ${unit}` : null;
};
const max = (e: Equipment | undefined, key: string, unit: string) => {
  const sp = specOf(e, key);
  return sp?.value != null ? `장비 최대 ${fmt(sp.value)} ${unit}` : null;
};
const FIELDS: Record<Kind, { group: string; fields: FieldDef[] }[]> = {
  VIBRATION: [
    { group: "시료", fields: [
      { key: "mass", label: "시료 무게", unit: "kg", help: "시험할 물체의 무게", limit: (e) => max(e, "max_payload", "kg") },
      { key: "fixture", label: "고정 지그 무게", unit: "kg", help: "시료를 진동대에 고정하는 판·브래킷 무게" },
    ] },
    { group: "진동 조건", fields: [
      { key: "accel", label: "진동 세기", unit: "g", help: "흔드는 가속도. 1g = 중력가속도" },
      { key: "fmin", label: "시작 주파수", unit: "Hz", help: "가장 느리게 흔드는 빠르기", limit: (e) => range(e, "frequency_range", "Hz") },
      { key: "fmax", label: "종료 주파수", unit: "Hz", help: "가장 빠르게 흔드는 빠르기", limit: (e) => range(e, "frequency_range", "Hz") },
      { key: "rate", label: "주파수 올리는 속도", unit: "oct/min", help: "1분에 주파수를 몇 배씩 올릴지 (보통 2)" },
    ] },
    { group: "일정", fields: [
      { key: "axes", label: "시험 방향 수", unit: "축", step: "1", help: "X·Y·Z 중 몇 방향을 시험할지" },
      { key: "setup", label: "방향당 준비 시간", unit: "시간", help: "방향을 바꿀 때 시료를 다시 고정하는 시간" },
    ] },
  ],
  THERMAL_VACUUM: [
    { group: "온도 조건", fields: [
      { key: "hot", label: "최고 온도", unit: "℃", help: "가장 뜨겁게 올릴 온도", limit: (e) => range(e, "temperature_range", "℃") },
      { key: "cold", label: "최저 온도", unit: "℃", help: "가장 차갑게 내릴 온도", limit: (e) => range(e, "temperature_range", "℃") },
      { key: "start", label: "시작 온도", unit: "℃", help: "시험을 시작할 때 온도 (보통 상온 20℃)" },
    ] },
    { group: "반복", fields: [
      { key: "cycles", label: "반복 횟수", unit: "회", step: "1", help: "고온 → 저온을 몇 번 반복할지" },
      { key: "ramp", label: "온도 바꾸는 속도", unit: "℃/분", help: "1분에 몇 ℃씩 올리거나 내릴지" },
      { key: "dwell", label: "목표 온도 유지", unit: "시간", help: "최고·최저 온도에서 머무는 시간" },
    ] },
    { group: "일정", fields: [
      { key: "pump", label: "진공 만들고 푸는 시간", unit: "시간", help: "시험 앞뒤의 배기·복압 시간 합계" },
    ] },
  ],
  SHOCK: [
    { group: "충격 조건", fields: [
      { key: "srs", label: "충격 세기 (SRS 최대값)", unit: "g", help: "규격서의 충격 응답 스펙트럼 최고값", limit: (e) => max(e, "srs_peak", "g") },
      { key: "knee", label: "꺾이는 주파수", unit: "Hz", help: "그래프가 평평해지기 시작하는 주파수" },
      { key: "f1", label: "시작 주파수", unit: "Hz", help: "규격의 가장 낮은 주파수", limit: (e) => range(e, "frequency_range", "Hz") },
      { key: "f2", label: "종료 주파수", unit: "Hz", help: "규격의 가장 높은 주파수", limit: (e) => range(e, "frequency_range", "Hz") },
    ] },
    { group: "시료·횟수", fields: [
      { key: "smass", label: "시료 무게", unit: "kg", help: "충격을 줄 물체의 무게", limit: (e) => max(e, "max_payload", "kg") },
      { key: "shots", label: "충격 횟수", unit: "회", step: "1", help: "방향별 충격을 모두 합친 횟수" },
    ] },
  ],
  TEMPERATURE_HUMIDITY: [
    { group: "온습도 조건", fields: [
      { key: "thHot", label: "최고 온도", unit: "℃", help: "가장 뜨겁게 올릴 온도", limit: (e) => range(e, "temperature_range", "℃") },
      { key: "thCold", label: "최저 온도", unit: "℃", help: "가장 차갑게 내릴 온도", limit: (e) => range(e, "temperature_range", "℃") },
      { key: "thRh", label: "최고 습도", unit: "%RH", help: "고온 구간에서 유지할 상대습도", limit: (e) => range(e, "humidity_range", "%RH") },
    ] },
    { group: "사이클", fields: [
      { key: "thCycles", label: "반복 횟수", unit: "회", step: "1", help: "고온·고습 → 저온을 몇 번 반복할지" },
      { key: "thRamp", label: "온도 바꾸는 속도", unit: "℃/분", help: "1분에 몇 ℃씩 올리거나 내릴지" },
      { key: "thDwell", label: "목표 온도 유지", unit: "시간", help: "최고·최저 온도에서 머무는 시간" },
    ] },
  ],
  ACOUSTIC_NOISE: [
    { group: "음향 조건", fields: [
      { key: "acSpl", label: "전체 음압 (OASPL)", unit: "dB", help: "규격서의 전체 음압 수준", limit: (e) => max(e, "max_spl", "dB") },
      { key: "acF1", label: "시작 주파수", unit: "Hz", help: "규격 스펙트럼의 가장 낮은 대역", limit: (e) => range(e, "frequency_range", "Hz") },
      { key: "acF2", label: "종료 주파수", unit: "Hz", help: "규격 스펙트럼의 가장 높은 대역", limit: (e) => range(e, "frequency_range", "Hz") },
    ] },
    { group: "시험 횟수", fields: [
      { key: "acDur", label: "본시험 시간", unit: "초", help: "목표 음압을 유지하는 시간 (보통 60~120초)" },
      { key: "acRuns", label: "가진 횟수", unit: "회", step: "1", help: "저준위 사전 가진을 포함한 횟수" },
      { key: "acSetup", label: "설치·계측 준비", unit: "시간", help: "시료 설치, 마이크·가속도계 배치 시간" },
    ] },
  ],
  EMC: [
    { group: "시험 조건", fields: [
      { key: "emcF1", label: "시작 주파수", unit: "MHz", help: "규격(예: MIL-STD-461)의 시작 주파수", limit: (e) => range(e, "frequency_range", "MHz") },
      { key: "emcF2", label: "종료 주파수", unit: "MHz", help: "규격의 종료 주파수", limit: (e) => range(e, "frequency_range", "MHz") },
      { key: "emcField", label: "내성 시험 전계", unit: "V/m", help: "복사 내성(RS) 시험에서 시료에 가할 전계 세기", limit: (e) => max(e, "field_strength", "V/m") },
    ] },
    { group: "측정 일정", fields: [
      { key: "emcDwell", label: "주파수당 머무는 시간", unit: "초", help: "각 주파수에서 시료 동작을 확인하는 시간" },
      { key: "emcFaces", label: "시험 면 수", unit: "면", step: "1", help: "안테나를 향하게 할 시료 면의 수 (편파 2개는 자동 포함)" },
      { key: "emcSetup", label: "설치·교정 시간", unit: "시간", help: "시료 설치와 전계 교정에 드는 시간" },
    ] },
  ],
  ELECTRICAL_RF_ANALYSIS: [
    { group: "안테나", fields: [
      { key: "rfF1", label: "최저 주파수", unit: "GHz", help: "측정할 가장 낮은 주파수", limit: (e) => range(e, "frequency_range", "GHz") },
      { key: "rfF2", label: "최고 주파수", unit: "GHz", help: "측정할 가장 높은 주파수 (측정점 간격을 정함)", limit: (e) => range(e, "frequency_range", "GHz") },
      { key: "rfSize", label: "안테나 지름", unit: "m", help: "안테나 개구면의 가장 긴 길이" },
    ] },
    { group: "측정 일정", fields: [
      { key: "rfFreqs", label: "측정 주파수 개수", unit: "개", step: "1", help: "한 번 스캔할 때 함께 재는 주파수 수" },
      { key: "rfPols", label: "편파 수", unit: "개", step: "1", help: "수직·수평 두 편파를 모두 재면 2" },
      { key: "rfSetup", label: "정렬·설치 시간", unit: "시간", help: "안테나 정렬과 프로브 교정 시간" },
    ] },
  ],
  X_RAY_INSPECTION: [
    { group: "시편", fields: [
      { key: "xrMass", label: "시편 무게", unit: "kg", help: "검사할 물체의 무게", limit: (e) => max(e, "max_payload", "kg") },
      { key: "xrThick", label: "가장 두꺼운 부분 (강철 환산)", unit: "mm", help: "X선이 통과해야 하는 두께. 알루미늄은 약 1/3로 환산" },
    ] },
    { group: "검사 조건", fields: [
      { key: "xrRes", label: "원하는 분해능", unit: "µm", help: "찾고 싶은 가장 작은 결함 크기", limit: (e) => { const sp = specOf(e, "resolution"); return sp?.value != null ? `장비 최고 ${fmt(sp.value)} µm` : null; } },
      { key: "xrCount", label: "시편 수", unit: "개", step: "1", help: "검사할 시편 개수" },
    ] },
  ],
};
const STATE_TEXT = { ok: "적합", tight: "여유 적음", over: "초과", na: "확인 필요" } as const;
const stateOf = (c: Check) => (c.ratio == null ? "na" : c.ratio > 1 ? "over" : c.ratio > 0.85 ? "tight" : "ok");

/** 0 이하도 입력할 수 있는 항목 (온도) */
const SIGNED = ["cold", "start", "hot", "thHot", "thCold"];
/** 순서 검사: 그룹별로 꼭 맞아야 하는 관계 */
function groupError(kind: Kind, group: string, v: Record<string, string>, fields: FieldDef[]) {
  const empty = fields.find((f) => !Number.isFinite(num(v[f.key])));
  if (empty) return `'${empty.label}'에 숫자를 입력하세요.`;
  const negative = fields.find((f) => !SIGNED.includes(f.key) && num(v[f.key]) <= 0);
  if (negative) return `'${negative.label}'은 0보다 커야 합니다.`;
  if (kind === "VIBRATION" && group === "진동 조건" && num(v.fmin) >= num(v.fmax)) return "종료 주파수가 시작 주파수보다 커야 합니다.";
  if (kind === "SHOCK" && group === "충격 조건" && num(v.f1) >= num(v.f2)) return "종료 주파수가 시작 주파수보다 커야 합니다.";
  if (kind === "THERMAL_VACUUM" && group === "온도 조건" && num(v.cold) >= num(v.hot)) return "최고 온도가 최저 온도보다 높아야 합니다.";
  if (kind === "TEMPERATURE_HUMIDITY" && group === "온습도 조건") {
    if (num(v.thCold) >= num(v.thHot)) return "최고 온도가 최저 온도보다 높아야 합니다.";
    if (num(v.thRh) > 100) return "습도는 100%RH를 넘을 수 없습니다.";
  }
  const pair = ({ ACOUSTIC_NOISE: ["acF1", "acF2"], EMC: ["emcF1", "emcF2"], ELECTRICAL_RF_ANALYSIS: ["rfF1", "rfF2"] } as Partial<Record<Kind, string[]>>)[kind];
  if (pair && fields.some((f) => f.key === pair[0]) && num(v[pair[0]]) >= num(v[pair[1]])) return "끝 주파수가 시작 주파수보다 커야 합니다.";
  return null;
}

const GROUP_INTRO: Record<string, string> = {
  "시료": "시험할 물체와 고정 지그의 무게를 알려 주세요.",
  "진동 조건": "규격서에 있는 진동 세기와 주파수 범위를 입력하세요.",
  "일정": "시험 시간을 계산하는 데 쓰입니다. 모르면 기본값을 그대로 두세요.",
  "온도 조건": "규격서의 최고·최저 온도를 입력하세요.",
  "반복": "열사이클을 몇 번, 어떤 속도로 반복할지 정합니다.",
  "충격 조건": "규격서의 충격 응답 스펙트럼(SRS) 값을 입력하세요.",
  "시료·횟수": "시료 무게와 충격 횟수를 입력하세요.",
  "온습도 조건": "규격서의 온도 범위와 최고 습도를 입력하세요.",
  "사이클": "온습도 사이클을 몇 번, 어떤 속도로 반복할지 정합니다.",
  "음향 조건": "규격서의 전체 음압(OASPL)과 주파수 범위를 입력하세요.",
  "시험 횟수": "본시험 시간과 사전 가진을 포함한 횟수를 입력하세요.",
  "시험 조건": "규격의 주파수 범위와 내성 시험 전계 세기를 입력하세요.",
  "측정 일정": "측정 시간을 계산하는 데 쓰입니다. 모르면 기본값을 그대로 두세요.",
  "안테나": "측정할 주파수 범위와 안테나 크기를 입력하세요.",
  "시편": "검사할 시편의 무게와 가장 두꺼운 부분을 알려 주세요.",
  "검사 조건": "찾고 싶은 결함 크기와 시편 수를 입력하세요.",
};

/**
 * 단계별 입력 (v9~v12)
 * 한 번에 한 카드만 보여주고, 이전·다음 버튼과 위 진행 막대로 오갑니다. 입력한 조건은 결과 화면에서 요약합니다.
 * ① 시험 종류 → ② 장비 → ③~ 조건 묶음 → 결과
 */
export default function QuickSimulation({ setActiveMenu }: { setActiveMenu: (menu: string) => void }) {
  const { equipmentList, simulationEquipmentId, setSelectedEquipment, setDraftRequestId, setRequirementId, setTestCondition, resolveEquipment, user } = useWorkspace();
  const initial = equipmentList.find((e) => e.id === simulationEquipmentId);
  // v12: 등록된 장비가 하나라도 있는 시험 종류만 보여줍니다.
  const kinds = useMemo(() => KINDS.filter((k) => equipmentList.some((e) => e.testTypes.includes(k.key))), [equipmentList]);
  const [picked, setKind] = useState<Kind | null>((initial?.testTypes.find((t) => KINDS.some((k) => k.key === t)) as Kind) ?? null);
  const kind: Kind = picked && kinds.some((k) => k.key === picked) ? picked : kinds[0]?.key ?? "VIBRATION";
  // v12: 장비는 예약이 많은 순(예약률 높은 순)으로 최대 3대만 추천. 장비 상세에서 넘어온 장비는 항상 포함.
  const candidates = useMemo(() => {
    const all = equipmentList.filter((e) => e.testTypes.includes(kind))
      .sort((a, b) => (b.usage?.utilizationRate ?? -1) - (a.usage?.utilizationRate ?? -1) || a.name.localeCompare(b.name, "ko"));
    const top = all.slice(0, 3);
    if (initial && initial.testTypes.includes(kind) && !top.some((e) => e.id === initial.id)) top.splice(2, 1, initial);
    return top;
  }, [equipmentList, kind, initial]);
  const ownOrg = user.organization?.id;
  const [equipmentId, setEquipmentId] = useState<number | null>(initial?.id ?? null);
  const equipment = candidates.find((e) => e.id === equipmentId) ?? candidates[0];
  const [v, setV] = useState<Record<string, string>>(DEFAULTS);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<Error | null>(null);

  const groups = FIELDS[kind];
  const steps = [
    { id: "kind", title: "무엇을 시험하나요?" },
    { id: "equipment", title: "어느 장비로 시뮬레이션할까요?" },
    ...groups.map((g) => ({ id: `group:${g.group}`, title: g.group })),
    { id: "result", title: "결과" },
  ];
  const last = steps.length - 1;
  const atResult = step === last;
  const result = useMemo(() => simulate(kind, v, equipment), [kind, v, equipment]);
  const worst = result.checks.reduce<Check | null>((m, c) => ((c.ratio ?? -1) > (m?.ratio ?? -1) ? c : m), null);
  const verdict = !equipment ? null : (worst?.ratio ?? 0) > 1 ? "over" : (worst?.ratio ?? 0) > 0.85 ? "tight" : "ok";
  const reason = !worst || worst.ratio == null ? "등록된 장비 사양이 부족해 일부 항목은 기관 확인이 필요합니다."
    : worst.range ? (verdict === "over" ? `${worst.label}가 장비 범위(${worst.limit.replace(/^장비 /, "")})를 벗어납니다.` : "모든 항목이 장비 범위 안에 있습니다.")
    : `가장 빠듯한 항목은 ${worst.label}: 필요 ${worst.need}, 장비 ${worst.limit} (${Math.round(worst.ratio * 100)}% 사용)${worst.note ? ` · ${worst.note}` : ""}`;
  const specs = (equipment?.specs ?? []).slice(0, 4);

  const go = (to: number) => { setError(null); setStep(Math.max(0, Math.min(last, to))); };
  const next = () => {
    if (step === 1 && !equipment) { setError("이 시험 종류를 할 수 있는 등록 장비가 없습니다. 다른 시험 종류를 고르세요."); return; }
    const g = groups[step - 2];
    if (g) { const e = groupError(kind, g.group, v, g.fields); if (e) { setError(e); return; } }
    go(step + 1);
  };
  const summaryOf = (i: number) => {
    if (i === 0) return KINDS.find((k) => k.key === kind)?.label;
    if (i === 1) return equipment ? `${equipment.name} · ${equipment.institutionId === ownOrg ? "우리 기관" : equipment.institution}` : "장비 없음";
    const g = groups[i - 2];
    return g?.fields.map((f) => `${f.label} ${v[f.key]}${f.unit}`).join(" · ");
  };

  const request = async () => {
    if (!equipment) return;
    setBusy(true); setRequestError(null);
    try {
      const detail = await resolveEquipment(equipment.id, new AbortController().signal);
      setDraftRequestId(null); setRequirementId(null);
      setSelectedEquipment(detail);
      setTestCondition(`[간이 시뮬레이션] ${result.summary}`);
      setActiveMenu("reservation");
    } catch (err) { setRequestError(err as Error); } finally { setBusy(false); }
  };

  return (
    <div className="sim-wizard">
      <ol className="sim-progress" aria-label="진행 단계">
        {steps.map((s, i) => (
          <li key={s.id} className={i < step ? "is-done" : i === step ? "is-current" : undefined} aria-current={i === step ? "step" : undefined}>
            <button type="button" disabled={i > step} onClick={() => go(i)}>
              <span>{i === last ? "✓" : i + 1}</span><em>{i === 0 ? "시험 종류" : i === 1 ? "장비" : s.title}</em>
            </button>
          </li>
        ))}
      </ol>

      {!atResult ? (
        <section key={steps[step].id} className="sim-card" aria-labelledby="sim-card-title">
          <header className="sim-card__head">
            <span className="sim-card__num" aria-label={`${last}단계 중 ${step + 1}단계`}>{step + 1}</span>
            <div>
              <h2 id="sim-card-title">{step === 0 ? "무엇을 시험하나요?" : step === 1 ? "어느 장비로 시뮬레이션할까요?" : steps[step].title}</h2>
              <p>{step === 0 ? "가상으로 돌려 볼 시험 종류를 고르세요." : step === 1 ? "예약이 많은 장비 순으로 최대 3대를 추천해요. 하나를 고르면 그 장비의 사양으로 시험을 가상으로 돌려 봅니다." : GROUP_INTRO[steps[step].title] ?? ""}</p>
            </div>
          </header>

          {step === 0 && (
            <div className="sim-kinds" role="radiogroup" aria-label="시험 종류">
              {kinds.map((k) => (
                <button type="button" role="radio" key={k.key} aria-checked={kind === k.key}
                  onClick={() => { setKind(k.key); setEquipmentId(null); }} onDoubleClick={() => { setKind(k.key); go(1); }}>
                  <strong>{k.label}</strong><small>{k.hint}</small>
                </button>
              ))}
              <p className="sim-note">찾는 시험이 없나요? 목록에 없는 시험은 현재 ASTRA에 등록된 시험 장비가 없어 시뮬레이션할 수 없습니다.</p>
            </div>
          )}

          {step === 1 && (
            <div className="sim-equip">
              {candidates.length ? (
                <ul className="sim-equip__list" role="radiogroup" aria-label="시뮬레이션할 장비">
                  {candidates.map((e, i) => (
                    <li key={e.id}>
                      <button type="button" role="radio" aria-checked={equipment?.id === e.id} onClick={() => setEquipmentId(e.id)}>
                        <span className="sim-equip__rank" aria-label={`추천 ${i + 1}순위`}>{i + 1}</span>
                        <span className="sim-equip__name"><strong>{e.name}</strong><small>{e.institutionId === ownOrg ? "우리 기관 장비" : e.institution}{e.region ? ` · ${e.region}` : ""}</small></span>
                        <span className="sim-equip__specs">
                          {(e.specs ?? []).slice(0, 2).map((sp) => <span key={sp.key}><small>{sp.label ?? sp.key}</small>{valueText(sp)}</span>)}
                          {e.usage?.utilizationRate != null && <span className="sim-equip__busy"><small>예약률</small>{e.usage.utilizationRate}%</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="sim-empty">이 시험 종류를 할 수 있는 등록 장비가 없습니다.</p>}
              {specs.length > 0 && <p className="sim-hint">선택한 장비: {specs.map((sp) => `${sp.label ?? sp.key} ${valueText(sp)}`).join(" · ")}</p>}
            </div>
          )}

          {step >= 2 && groups[step - 2] && (
            <div className="sim-fields">
              {groups[step - 2].fields.map((f) => {
                const limit = f.limit?.(equipment);
                return (
                  <label className="sim-field" key={f.key}>
                    <span className="sim-field__label"><b>{f.label}</b><small>{f.help}</small></span>
                    <span className="sim-field__control">
                      <span className="sim-field__input">
                        <input type="number" inputMode="decimal" step={f.step ?? "any"} value={v[f.key]}
                          onChange={(e) => { setV({ ...v, [f.key]: e.target.value }); setError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }} />
                        <small>{f.unit}</small>
                      </span>
                      {limit && <span className="sim-field__limit">{limit}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {error && <p className="sim-error" role="alert">{error}</p>}
          <footer className="sim-card__actions">
            {step > 0 ? <Button variant="secondary" onClick={() => go(step - 1)}>이전</Button> : <span />}
            <Button icon={ArrowRight} onClick={next}>{step === last - 1 ? "결과 보기" : "다음"}</Button>
          </footer>
        </section>
      ) : (
        <section className="sim-result" aria-labelledby="sim-result-title">
          <h2 id="sim-result-title" className="sr-only">시뮬레이션 결과</h2>
          <div className={`qs-verdict qs-verdict--${verdict}`} aria-live="polite">
            <span className="qs-verdict__icon" aria-hidden="true">{verdict === "ok" ? <CircleCheck size={26} /> : verdict === "tight" ? <TriangleAlert size={26} /> : <CircleAlert size={26} />}</span>
            <div className="qs-verdict__text">
              <span className="qs-verdict__label">결과 · {equipment?.name}</span>
              <strong>{verdict === "ok" ? "이 장비로 시험할 수 있습니다" : verdict === "tight" ? "가능하지만 장비 한계에 가깝습니다" : "이 조건은 장비 범위를 벗어납니다"}</strong>
              <p>{reason}</p>
            </div>
            {equipment?.institutionId === ownOrg
              ? <span className="qs-verdict__own">우리 기관 장비라 의뢰서는 만들 수 없어요</span>
              : <Button icon={ArrowRight} disabled={busy} onClick={request}>{busy ? "확인 중…" : "이 조건으로 의뢰서 작성"}</Button>}
          </div>
          <dl className="sim-recap" aria-label="입력한 조건">
            {steps.slice(0, last).map((st, i) => (
              <div key={st.id}>
                <dt>{i === 0 ? "시험 종류" : i === 1 ? "장비" : st.title}</dt>
                <dd>{summaryOf(i)}</dd>
              </div>
            ))}
          </dl>
          {requestError && <ApiState error={requestError} />}
          <div className="qs-kpis">
            {result.facts.map((f) => <div key={f.label} className="qs-kpi"><span>{f.label}</span><strong>{f.value}</strong></div>)}
          </div>
          <Panel className="qs-checks" title="장비 범위 점검" description="내 조건이 장비 한계의 몇 %를 쓰는지 보여줍니다. 85%를 넘으면 여유 적음, 100%를 넘으면 초과입니다.">
            <table>
              <thead><tr><th>항목</th><th>내 조건</th><th>장비 한계</th><th>사용률</th><th className="is-center">판정</th></tr></thead>
              <tbody>
                {result.checks.map((c) => {
                  const st = stateOf(c);
                  return (
                    <tr key={c.label} className={`is-${st}`}>
                      <th scope="row">{c.label}{c.note && <small>{c.note}</small>}</th>
                      <td className="is-num">{c.need}</td>
                      <td className="is-num">{c.limit}</td>
                      <td>{c.range || c.ratio == null ? <span className="qs-dash">{c.range ? "범위 확인" : "—"}</span> : (
                        <span className="qs-use"><span className="qs-use__bar"><i style={{ width: `${Math.min(100, c.ratio * 100)}%` }} /><b style={{ left: "85%" }} aria-hidden="true" /></span><em>{Math.round(c.ratio * 100)}%</em></span>
                      )}</td>
                      <td className="is-center"><span className={`qs-state qs-state--${st}`}>{STATE_TEXT[st]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <Panel className="qs-chart" title={result.chart.title} description={result.chart.caption}>
            <LineChart {...result.chart} />
          </Panel>
          <details className="qs-basis">
            <summary>계산 방법 보기</summary>
            <ul>{result.basis.map((b) => <li key={b}>{b}</li>)}<li>등록된 장비 사양으로 계산한 추정치이며, 최종 가능 여부와 비용은 기관 검토로 확정됩니다.</li></ul>
          </details>
          <div className="sim-result__again">
            <Button variant="secondary" onClick={() => go(2)}>조건 고치기</Button>
            <Button variant="ghost" onClick={() => go(0)}>처음부터 다시</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function feeFor(item: Equipment, hours: number, shots = 0) {
  const amount = item.usage?.feeAmount, unit = item.usage?.feeUnit;
  if (!amount || !unit) return null;
  const minDays = Number(/최소\s*(\d+)\s*일/.exec(item.usage?.durationText ?? "")?.[1] ?? 0);
  if (unit === "HOUR") return { cost: Math.ceil(hours) * amount, text: `${Math.ceil(hours)}시간 × ${won(amount)}` };
  if (unit === "DAY") { const days = Math.max(Math.ceil(hours / 24), minDays); return { cost: days * amount, text: `${days}일 × ${won(amount)}${minDays && days === minDays ? " (최소 일수)" : ""}` }; }
  if (unit === "SHOT") return { cost: Math.max(1, shots) * amount, text: `${Math.max(1, shots)}회 × ${won(amount)}` };
  return null;
}

function simulate(kind: Kind, v: Record<string, string>, item: Equipment | undefined) {
  const checks: Check[] = [];
  const facts: { label: string; value: string }[] = [];
  const basis: string[] = [];
  if (kind === "VIBRATION") {
    const mass = num(v.mass), fixture = num(v.fixture), a = num(v.accel), fmin = Math.max(0.5, num(v.fmin)), fmax = num(v.fmax);
    const force = ((mass + fixture) * a * G0) / 1000; // kN
    const dispAt = (f: number) => (2 * a * G0) / (2 * Math.PI * f) ** 2 * 1000; // mm p-p
    const maxForce = specOf(item, "max_force")?.value, payload = specOf(item, "max_payload")?.value;
    const range = specOf(item, "frequency_range"), stroke = specOf(item, "max_displacement")?.value;
    checks.push({ label: "가진력", need: `${fmt(force, 2)} kN`, limit: maxForce ? `${fmt(maxForce)} kN` : "미등록", ratio: maxForce ? force / maxForce : null });
    checks.push({ label: "시편 질량 (치구 포함)", need: `${fmt(mass + fixture)} kg`, limit: payload ? `${fmt(payload)} kg` : "미등록", ratio: payload ? (mass + fixture) / payload : null });
    if (range?.min != null && range?.max != null)
      checks.push({ label: "주파수 범위", need: `${fmt(fmin)}~${fmt(fmax)} Hz`, limit: `${fmt(range.min)}~${fmt(range.max)} Hz`,
        ratio: fmin < range.min || fmax > range.max ? 1.2 : 0, range: true });
    const lowDisp = dispAt(fmin);
    checks.push({ label: "변위 (시작 주파수에서)", need: `${fmt(lowDisp)} mm p-p`, limit: stroke ? `${fmt(stroke)} mm` : "미등록", ratio: stroke ? lowDisp / stroke : null,
      note: stroke && lowDisp > stroke ? `${fmt(Math.sqrt((2 * a * G0) / (stroke / 1000)) / (2 * Math.PI))} Hz 이하는 목표 가속도 불가` : undefined });
    const octaves = Math.log2(fmax / fmin), rate = num(v.rate), axes = Math.max(1, Math.round(num(v.axes)));
    const sweepMin = (octaves / rate) * axes;
    const hours = sweepMin / 60 + axes * num(v.setup);
    const fee = item ? feeFor(item, hours) : null;
    facts.push({ label: "필요 가진력", value: `${fmt(force, 2)} kN` }, { label: "예상 시험 시간", value: `${fmt(hours)}시간` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" });
    const pts = Array.from({ length: 60 }, (_, i) => fmin * (fmax / fmin) ** (i / 59)).map((f) => ({ x: f, y: dispAt(f) }));
    basis.push("가진력 F = (시료 + 치구 질량) × 가속도 × 9.81 (가진기 아마추어 질량은 장비마다 달라 제외)",
      "정현파 변위(p-p) = 2 × a / (2πf)² — 낮은 주파수일수록 큰 변위가 필요",
      `스윕 시간 = log₂(종료/시작) ÷ 스윕 속도 × 축 수 = ${fmt(sweepMin)}분, 여기에 축당 준비 시간을 더함`,
      fee ? `이용료 = ${fee.text}` : "이용료 단가가 등록되지 않아 계산하지 않음");
    return {
      checks, facts, basis,
      summary: `정현파 진동 ${fmt(fmin)}~${fmt(fmax)} Hz, ${fmt(a)} g, 시료 ${fmt(mass)} kg + 치구 ${fmt(fixture)} kg, ${axes}축 (필요 가진력 ${fmt(force, 2)} kN)`,
      chart: {
        title: "주파수별 필요 변위", points: pts, xLog: true, yLog: true, xLabel: "주파수 (Hz)", yLabel: "변위 mm p-p",
        format: (y: number) => (y >= 1 ? fmt(y, 0) : String(+y.toPrecision(1))), ariaLabel: "주파수에 따른 필요 변위 그래프",
        limits: stroke ? [{ y: stroke, label: `장비 최대 변위 ${fmt(stroke)} mm` }] : [],
        caption: stroke && lowDisp > stroke ? "점선 위로 올라간 구간은 장비 변위 한계 때문에 목표 가속도를 낼 수 없습니다." : "선 전체가 점선 아래에 있으면 변위 한계 안에서 시험할 수 있습니다.",
      },
    };
  }
  if (kind === "THERMAL_VACUUM") {
    const hot = num(v.hot), cold = num(v.cold), cycles = Math.max(1, Math.round(num(v.cycles))), ramp = Math.max(0.1, num(v.ramp)), dwell = num(v.dwell), start = num(v.start), pump = num(v.pump);
    const range = specOf(item, "temperature_range");
    const pts: { x: number; y: number }[] = [{ x: 0, y: start }];
    let t = pump / 2; pts.push({ x: t, y: start });
    const go = (to: number) => { const last = pts[pts.length - 1].y; t += Math.abs(to - last) / ramp / 60; pts.push({ x: t, y: to }); };
    for (let c = 0; c < cycles; c += 1) { go(hot); t += dwell; pts.push({ x: t, y: hot }); go(cold); t += dwell; pts.push({ x: t, y: cold }); }
    go(start); t += pump / 2; pts.push({ x: t, y: start });
    const hours = t;
    if (range?.min != null && range?.max != null) {
      checks.push({ label: "고온 목표", need: `${fmt(hot)} ℃`, limit: `최대 ${fmt(range.max)} ℃`, ratio: hot <= range.max ? Math.max(0, (hot - start) / Math.max(1, range.max - start)) : 1.2 });
      checks.push({ label: "저온 목표", need: `${fmt(cold)} ℃`, limit: `최저 ${fmt(range.min)} ℃`, ratio: cold >= range.min ? Math.max(0, (start - cold) / Math.max(1, start - range.min)) : 1.2 });
    } else checks.push({ label: "온도 범위", need: `${fmt(cold)}~${fmt(hot)} ℃`, limit: "미등록", ratio: null });
    const fee = item ? feeFor(item, hours) : null;
    checks.push({ label: "시험 기간", need: `${fmt(hours / 24)}일`, limit: item?.usage?.durationText ?? "미등록", ratio: null, note: "장비 일정과 맞춰 협의" });
    facts.push({ label: "총 시험 시간", value: `${fmt(hours)}시간 (${fmt(hours / 24)}일)` }, { label: "사이클", value: `${cycles}회` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" });
    basis.push("온도 변화 시간 = 온도 차 ÷ 승·냉각 속도, 사이클마다 고온·저온에서 유지 시간을 더함",
      "배기·복압 시간은 시험 앞뒤로 절반씩 배분", "시료 열용량·복사 열교환은 반영하지 않은 장비 쪽 일정 추정입니다",
      fee ? `이용료 = ${fee.text}` : "이용료 단가가 등록되지 않아 계산하지 않음");
    return {
      checks, facts, basis,
      summary: `열진공 열사이클 ${fmt(cold)}~${fmt(hot)} ℃, ${cycles}회, 유지 ${fmt(dwell)}시간, 승·냉각 ${fmt(ramp)} ℃/분 (총 약 ${fmt(hours / 24)}일)`,
      chart: {
        title: "시간에 따른 온도 프로파일", points: pts, xLabel: "경과 시간 (시간)", yLabel: "온도 ℃",
        format: (y: number) => `${fmt(y, 0)}℃`, xFormat: (x: number) => `${fmt(x, 0)}h`, ariaLabel: "열사이클 온도 프로파일 그래프",
        limits: range?.min != null && range?.max != null ? [{ y: range.max, label: `장비 최고 ${fmt(range.max)}℃` }, { y: range.min, label: `장비 최저 ${fmt(range.min)}℃` }] : [],
        caption: "점선은 장비가 낼 수 있는 온도 한계입니다. 선이 점선 사이에 있으면 범위 안입니다.",
      },
    };
  }
  if (kind === "TEMPERATURE_HUMIDITY") return simulateHumidity(v, item);
  if (kind === "ACOUSTIC_NOISE") return simulateAcoustic(v, item);
  if (kind === "EMC") return simulateEmc(v, item);
  if (kind === "ELECTRICAL_RF_ANALYSIS") return simulateNearField(v, item);
  if (kind === "X_RAY_INSPECTION") return simulateXray(v, item);
  // SHOCK
  const peak = num(v.srs), knee = num(v.knee), f1 = num(v.f1), f2 = num(v.f2), smass = num(v.smass), shots = Math.max(1, Math.round(num(v.shots)));
  const maxSrs = specOf(item, "srs_peak")?.value, payload = specOf(item, "max_payload")?.value, range = specOf(item, "frequency_range");
  checks.push({ label: "SRS 최대값", need: `${fmt(peak, 0)} g`, limit: maxSrs ? `${fmt(maxSrs, 0)} g` : "미등록", ratio: maxSrs ? peak / maxSrs : null });
  checks.push({ label: "시편 질량", need: `${fmt(smass)} kg`, limit: payload ? `${fmt(payload)} kg` : "미등록", ratio: payload ? smass / payload : null });
  if (range?.min != null && range?.max != null)
    checks.push({ label: "주파수 범위", need: `${fmt(f1)}~${fmt(f2)} Hz`, limit: `${fmt(range.min)}~${fmt(range.max)} Hz`,
      ratio: f1 < range.min || f2 > range.max ? 1.2 : 0, range: true });
  const fee = item ? feeFor(item, 4, shots) : null;
  facts.push({ label: "요구 SRS", value: `${fmt(peak, 0)} g` }, { label: "충격 횟수", value: `${shots}회` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" });
  const pts = Array.from({ length: 50 }, (_, i) => f1 * (f2 / f1) ** (i / 49)).map((f) => ({ x: f, y: f < knee ? peak * (f / knee) ** 1.5 : peak }));
  basis.push("요구 SRS = 꺾임 주파수까지 +9 dB/oct 로 상승 후 일정 (일반적인 분리 충격 규격 형태)", fee ? `이용료 = ${fee.text}` : "이용료 단가가 등록되지 않아 계산하지 않음");
  return {
    checks, facts, basis,
    summary: `충격 SRS ${fmt(peak, 0)} g (꺾임 ${fmt(knee, 0)} Hz, ${fmt(f1, 0)}~${fmt(f2, 0)} Hz), 시편 ${fmt(smass)} kg, ${shots}회`,
    chart: {
      title: "요구 충격 응답 스펙트럼 (SRS)", points: pts, xLog: true, yLog: true, xLabel: "주파수 (Hz)", yLabel: "가속도 g",
      format: (y: number) => fmt(y, 0), ariaLabel: "요구 충격 응답 스펙트럼 그래프",
      limits: maxSrs ? [{ y: maxSrs, label: `장비 최대 ${fmt(maxSrs, 0)} g` }] : [],
      caption: "선이 점선 아래에 있으면 장비가 요구 충격 수준을 낼 수 있습니다.",
    },
  };
}

const feeLine = (fee: { text: string } | null) => (fee ? `이용료 = ${fee.text}` : "이용료 단가가 등록되지 않아 계산하지 않음");
/** 범위 안 위치를 '사용률'로: 시작값에서 한계까지 얼마나 썼는지 (한계 밖이면 1.2 = 초과) */
const upTo = (need: number, from: number, limit: number) => (need <= limit ? Math.max(0, (need - from) / Math.max(1e-9, limit - from)) : 1.2);
const downTo = (need: number, from: number, limit: number) => (need >= limit ? Math.max(0, (from - need) / Math.max(1e-9, from - limit)) : 1.2);
const rangeCheck = (label: string, lo: number, hi: number, unit: string, sp: ReturnType<typeof specOf>, digits = 1): Check | null =>
  sp?.min != null && sp?.max != null
    ? { label, need: `${fmt(lo, digits)}~${fmt(hi, digits)} ${unit}`, limit: `${fmt(sp.min, digits)}~${fmt(sp.max, digits)} ${unit}`, ratio: lo < sp.min || hi > sp.max ? 1.2 : 0, range: true }
    : null;
const firstNumber = (text?: string | null) => { const m = /[\d.]+/.exec((text ?? "").replace(/,/g, "")); return m ? Number(m[0]) : NaN; };

/** 온습도: 열진공과 같은 온도 프로파일(배기 없음) + 습도 범위 */
function simulateHumidity(v: Record<string, string>, item: Equipment | undefined) {
  const hot = num(v.thHot), cold = num(v.thCold), rh = num(v.thRh), cycles = Math.max(1, Math.round(num(v.thCycles))), ramp = Math.max(0.1, num(v.thRamp)), dwell = num(v.thDwell), start = 25;
  const checks: Check[] = [];
  const temp = specOf(item, "temperature_range"), hum = specOf(item, "humidity_range");
  const pts: { x: number; y: number }[] = [{ x: 0, y: start }];
  let t = 0;
  const go = (to: number) => { t += Math.abs(to - pts[pts.length - 1].y) / ramp / 60; pts.push({ x: t, y: to }); };
  for (let c = 0; c < cycles; c += 1) { go(hot); t += dwell; pts.push({ x: t, y: hot }); go(cold); t += dwell; pts.push({ x: t, y: cold }); }
  go(start);
  if (temp?.min != null && temp?.max != null) {
    checks.push({ label: "고온 목표", need: `${fmt(hot)} ℃`, limit: `최대 ${fmt(temp.max)} ℃`, ratio: upTo(hot, start, temp.max) });
    checks.push({ label: "저온 목표", need: `${fmt(cold)} ℃`, limit: `최저 ${fmt(temp.min)} ℃`, ratio: downTo(cold, start, temp.min) });
  } else checks.push({ label: "온도 범위", need: `${fmt(cold)}~${fmt(hot)} ℃`, limit: "미등록", ratio: null });
  checks.push(hum?.max != null
    ? { label: "최고 습도", need: `${fmt(rh, 0)} %RH`, limit: `최대 ${fmt(hum.max, 0)} %RH`, ratio: rh / hum.max }
    : { label: "최고 습도", need: `${fmt(rh, 0)} %RH`, limit: "미등록", ratio: null });
  const fee = item ? feeFor(item, t) : null;
  return {
    checks, basis: ["온도 변화 시간 = 온도 차 ÷ 승·냉각 속도, 사이클마다 최고·최저 온도 유지 시간을 더함 (상온 25℃에서 시작)", "습도는 고온 구간에서 유지한다고 보고 장비 습도 상한과 비교", feeLine(fee)],
    facts: [{ label: "총 시험 시간", value: `${fmt(t)}시간 (${fmt(t / 24)}일)` }, { label: "사이클", value: `${cycles}회` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" }],
    summary: `온습도 사이클 ${fmt(cold)}~${fmt(hot)} ℃, 최고 ${fmt(rh, 0)} %RH, ${cycles}회, 유지 ${fmt(dwell)}시간 (총 약 ${fmt(t)}시간)`,
    chart: {
      title: "시간에 따른 온도 프로파일", points: pts, xLabel: "경과 시간 (시간)", yLabel: "온도 ℃",
      format: (y: number) => `${fmt(y, 0)}℃`, xFormat: (x: number) => `${fmt(x, 0)}h`, ariaLabel: "온습도 사이클 온도 프로파일 그래프",
      limits: temp?.min != null && temp?.max != null ? [{ y: temp.max, label: `장비 최고 ${fmt(temp.max)}℃` }, { y: temp.min, label: `장비 최저 ${fmt(temp.min)}℃` }] : [],
      caption: "점선은 장비가 낼 수 있는 온도 한계입니다. 선이 점선 사이에 있으면 범위 안입니다.",
    },
  };
}

/** 음향: 전체 음압을 음압(파스칼) 비율로 비교 — 1.4 dB 여유 미만이면 '여유 적음' */
function simulateAcoustic(v: Record<string, string>, item: Equipment | undefined) {
  const spl = num(v.acSpl), f1 = num(v.acF1), f2 = num(v.acF2), dur = num(v.acDur), runs = Math.max(1, Math.round(num(v.acRuns))), setup = num(v.acSetup);
  const maxSpl = specOf(item, "max_spl")?.value;
  const checks: Check[] = [{ label: "전체 음압 (OASPL)", need: `${fmt(spl)} dB`, limit: maxSpl ? `${fmt(maxSpl)} dB (여유 ${fmt(maxSpl - spl)} dB)` : "미등록", ratio: maxSpl ? 10 ** ((spl - maxSpl) / 20) : null }];
  const fr = rangeCheck("주파수 범위", f1, f2, "Hz", specOf(item, "frequency_range"), 0); if (fr) checks.push(fr);
  // 1/3 옥타브 대역: 250 Hz 부근이 가장 큰 일반적인 페어링 스펙트럼 모양을 가정하고, 대역 합이 OASPL이 되도록 맞춤
  const bands: number[] = []; for (let f = 25; f <= 10000 * 1.01; f *= 2 ** (1 / 3)) if (f >= f1 / 1.12 && f <= f2 * 1.12) bands.push(f);
  const shape = bands.map((f) => -1.6 * Math.log2(f / 250) ** 2);
  const offset = spl - 10 * Math.log10(shape.reduce((a, d) => a + 10 ** (d / 10), 0) || 1);
  const pts = bands.map((f, i) => ({ x: f, y: offset + shape[i] }));
  const hours = setup + (runs * (dur + 300)) / 3600; // 가진마다 안정화·확인 5분
  const fee = item ? feeFor(item, hours) : null;
  return {
    checks, basis: ["음압 비교: (필요 음압 ÷ 장비 최대 음압) = 10^((필요 dB − 장비 dB) ÷ 20)", "스펙트럼은 250 Hz 부근이 가장 큰 일반 형태로 가정하고 대역 합이 전체 음압이 되도록 맞춘 추정치", `시험 시간 = 준비 ${fmt(setup)}시간 + 가진 ${runs}회 × (본시험 ${fmt(dur, 0)}초 + 안정화 5분)`, feeLine(fee)],
    facts: [{ label: "전체 음압", value: `${fmt(spl)} dB` }, { label: "예상 시험 시간", value: `${fmt(hours)}시간` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" }],
    summary: `음향 시험 OASPL ${fmt(spl)} dB, ${fmt(f1, 0)}~${fmt(f2, 0)} Hz, 본시험 ${fmt(dur, 0)}초 × ${runs}회`,
    chart: {
      title: "대역별 음압 (1/3 옥타브 추정)", points: pts, xLog: true, xLabel: "주파수 (Hz)", yLabel: "음압 dB",
      format: (y: number) => fmt(y, 0), ariaLabel: "1/3 옥타브 대역별 음압 그래프",
      limits: maxSpl ? [{ y: maxSpl, label: `장비 최대 전체 음압 ${fmt(maxSpl)} dB` }] : [],
      caption: "대역별 음압을 모두 합친 값이 전체 음압(OASPL)입니다. 점선은 장비가 낼 수 있는 전체 음압입니다.",
    },
  };
}

/** EMC: 1% 간격 주파수 스캔 기준 측정 시간 + 내성 전계 세기 */
function simulateEmc(v: Record<string, string>, item: Equipment | undefined) {
  const f1 = num(v.emcF1), f2 = num(v.emcF2), field = num(v.emcField), dwell = num(v.emcDwell), faces = Math.max(1, Math.round(num(v.emcFaces))), setup = num(v.emcSetup);
  const checks: Check[] = [];
  const fr = rangeCheck("주파수 범위", f1, f2, "MHz", specOf(item, "frequency_range"), 2); if (fr) checks.push(fr);
  const maxField = specOf(item, "field_strength")?.value;
  checks.push({ label: "내성 시험 전계", need: `${fmt(field)} V/m`, limit: maxField ? `${fmt(maxField)} V/m` : "미등록", ratio: maxField ? field / maxField : null, note: maxField ? undefined : "기관에 전계 발생 능력 확인 필요" });
  const step = Math.log(1.01), count = Math.ceil(Math.log(f2 / f1) / step) + 1;
  const scanHours = (count * dwell * faces * 2) / 3600, hours = setup + scanHours;
  const pts = Array.from({ length: 40 }, (_, i) => { const f = f1 * (f2 / f1) ** (i / 39); return { x: f, y: setup + ((Math.log(f / f1) / step) * dwell * faces * 2) / 3600 }; });
  const fee = item ? feeFor(item, hours) : null;
  return {
    checks, basis: [`측정 주파수 = 시작~끝을 1%씩 올린 ${fmt(count, 0)}개 (내성 시험 일반 간격)`, `스캔 시간 = 주파수 수 × ${fmt(dwell)}초 × ${faces}면 × 편파 2개 = ${fmt(scanHours)}시간, 여기에 설치·교정 시간을 더함`, feeLine(fee)],
    facts: [{ label: "측정 주파수", value: `${fmt(count, 0)}개` }, { label: "예상 시험 시간", value: `${fmt(hours)}시간` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" }],
    summary: `EMC 복사 내성 ${fmt(f1, 2)}~${fmt(f2, 0)} MHz, ${fmt(field)} V/m, ${faces}면 × 편파 2 (약 ${fmt(hours)}시간)`,
    chart: {
      title: "주파수에 따른 누적 시험 시간", points: pts, xLog: true, xLabel: "주파수 (MHz)", yLabel: "누적 시간 (시간)",
      format: (y: number) => `${fmt(y)}h`, ariaLabel: "주파수에 따른 누적 시험 시간 그래프", limits: [],
      caption: "낮은 주파수부터 1%씩 올리며 측정합니다. 선의 끝이 전체 시험 시간입니다.",
    },
  };
}

/** 안테나 근접전계: 최고 주파수의 반파장 간격으로 스캔 → 측정점 수와 시간 */
function simulateNearField(v: Record<string, string>, item: Equipment | undefined) {
  const f1 = num(v.rfF1), f2 = num(v.rfF2), size = num(v.rfSize), freqs = Math.max(1, Math.round(num(v.rfFreqs))), pols = Math.max(1, Math.round(num(v.rfPols))), setup = num(v.rfSetup);
  const checks: Check[] = [];
  const fr = rangeCheck("주파수 범위", f1, f2, "GHz", specOf(item, "frequency_range"), 2); if (fr) checks.push(fr);
  const scan = size * 1.5, area = firstNumber(specOf(item, "scan_area")?.valueText);
  checks.push({ label: "필요 스캔 크기", need: `${fmt(scan, 2)} m`, limit: Number.isFinite(area) ? `${fmt(area)} m` : "미등록", ratio: Number.isFinite(area) ? scan / area : null });
  const pointsAt = (f: number) => (scan / (0.3 / f / 2)) ** 2;
  const points = pointsAt(f2), hours = setup + (points * (0.05 + 0.005 * freqs * pols)) / 3600;
  const pts = Array.from({ length: 30 }, (_, i) => { const f = f1 * (f2 / f1) ** (i / 29); return { x: f, y: pointsAt(f) }; });
  const fee = item ? feeFor(item, hours) : null;
  return {
    checks, basis: ["측정점 간격 = 최고 주파수 파장의 절반 (λ/2), 스캔 크기 = 안테나 지름 × 1.5", `측정점 = (스캔 크기 ÷ 간격)² = 약 ${fmt(points, 0)}점, 점당 이동 0.05초 + 주파수·편파당 0.005초`, feeLine(fee)],
    facts: [{ label: "측정점", value: `${fmt(points, 0)}점` }, { label: "예상 시험 시간", value: `${fmt(hours)}시간` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" }],
    summary: `안테나 근접전계 ${fmt(f1, 1)}~${fmt(f2, 1)} GHz, 지름 ${fmt(size, 2)} m, ${freqs}개 주파수 × 편파 ${pols}`,
    chart: {
      title: "최고 주파수에 따른 필요 측정점 수", points: pts, xLog: true, yLog: true, xLabel: "주파수 (GHz)", yLabel: "측정점 수",
      format: (y: number) => (y >= 1000 ? `${fmt(y / 1000, 0)}k` : fmt(y, 0)), xFormat: (x: number) => fmt(x, 1), ariaLabel: "주파수에 따른 측정점 수 그래프", limits: [],
      caption: "주파수가 높을수록 촘촘히 재야 해서 측정점과 시간이 빠르게 늘어납니다.",
    },
  };
}

/** X선 CT: 투과 두께로 필요한 관전압 추정 + 분해능·무게 비교 */
function simulateXray(v: Record<string, string>, item: Equipment | undefined) {
  const mass = num(v.xrMass), thick = num(v.xrThick), res = num(v.xrRes), count = Math.max(1, Math.round(num(v.xrCount)));
  const kvFor = (t: number) => 120 + 7.5 * t;
  const kv = kvFor(thick);
  const maxKv = specOf(item, "max_voltage")?.value, best = specOf(item, "resolution")?.value, payload = specOf(item, "max_payload")?.value;
  const checks: Check[] = [
    { label: "필요 관전압", need: `${fmt(kv, 0)} kV`, limit: maxKv ? `${fmt(maxKv, 0)} kV` : "미등록", ratio: maxKv ? kv / maxKv : null },
    { label: "분해능", need: `${fmt(res)} µm`, limit: best ? `최고 ${fmt(best)} µm` : "미등록", ratio: best ? best / res : null, note: best && best > res ? "장비가 이만큼 작은 결함은 보기 어려움" : undefined },
    { label: "시편 무게", need: `${fmt(mass)} kg`, limit: payload ? `${fmt(payload)} kg` : "미등록", ratio: payload ? mass / payload : null },
  ];
  const per = res < 50 ? 3 : 2, hours = count * per;
  const top = Math.max(thick * 1.6, maxKv ? (maxKv - 120) / 7.5 * 1.1 : thick * 1.6);
  const pts = Array.from({ length: 30 }, (_, i) => { const t = (top * i) / 29; return { x: t, y: kvFor(t) }; });
  const fee = item ? feeFor(item, hours) : null;
  return {
    checks, basis: ["필요 관전압 ≈ 120 kV + 강철 환산 두께(mm) × 7.5 kV (산업용 CT 경험식, 재질·필터에 따라 달라짐)", `검사 시간 = 시편 ${count}개 × ${per}시간 (분해능 50 µm 미만은 3시간)`, feeLine(fee)],
    facts: [{ label: "필요 관전압", value: `${fmt(kv, 0)} kV` }, { label: "예상 검사 시간", value: `${fmt(hours)}시간` }, { label: "예상 이용료", value: fee ? won(fee.cost) : "기관 문의" }],
    summary: `X선 CT 검사 강철 환산 ${fmt(thick)} mm, 분해능 ${fmt(res)} µm, 시편 ${count}개 (${fmt(mass)} kg)`,
    chart: {
      title: "두께에 따른 필요 관전압", points: pts, xLabel: "강철 환산 두께 (mm)", yLabel: "관전압 kV",
      format: (y: number) => fmt(y, 0), xFormat: (x: number) => fmt(x, 0), ariaLabel: "두께에 따른 필요 관전압 그래프",
      limits: maxKv ? [{ y: maxKv, label: `장비 최대 ${fmt(maxKv, 0)} kV` }] : [],
      caption: "내 시편 두께에서 선이 점선 아래에 있으면 장비로 투과할 수 있습니다.",
    },
  };
}
