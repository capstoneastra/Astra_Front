import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, PencilLine, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useWorkspace } from "../../context/AppContext";
import { useAction } from "../../hooks/useAction";
import { useApiQuery } from "../../hooks/useApiQuery";
import { catalogService } from "../../services/catalogService";
import { equipmentService, testTypeLabel } from "../../services/equipmentService";
import type { SpecDefinition } from "../../services/equipmentService";
import { similarEquipment } from "../../domain/equipmentDraft";
import type { DraftSpec, EquipmentDraft } from "../../domain/equipmentDraft";
import { Button, FormField } from "../ui/index";
import { Feedback } from "../workflow/Feedback";

/**
 * 장비 등록 창 (v19 — 대시보드 장비 등록 칸에서 열림)
 * 사양서 파일을 넣고 [→]로 열면 읽어낸 항목을 미리 채우고([수동 등록]이면 빈 양식), 담당자가 확인·수정한 뒤 등록합니다.
 * 등록 전에 비슷한 장비가 이미 있으면 알려줍니다(별도 '중복 장비' 화면 대신).
 *
 * v20: 한 화면 스크롤 대신 위쪽 진행 막대 + [다음]으로 한 단계씩 (AI 간편 의뢰·가상 시뮬레이션과 같은 흐름). 단계마다 그 단계 칸만 검사.
 * 명세(docs/api-spec.md 2-1·2-2)에 맞춘 입력 칸:
 *  1 장비·시험   name*, model, manufacturer, equipmentType*, region(비우면 소속 기관 지역), description
 *                + testTypes (시험·측정 장비는 1개 이상 필수) + 시험별 예상 비용·소요 일수·공인 정보(isAccredited·인정번호·유효일)
 *  2 이용·운영   usage.accessScope·operationMode·feeAmount/feeUnit/vatIncluded(서버가 feeText 생성)·durationText
 *                + usage.availability·leadTimeDays·utilizationRate·availabilityNote
 *  3 주요 사양   GET /equipment/spec-definitions 사전의 키만 (임의 키 금지). NUMBER=value, RANGE=min·max, TEXT=valueText
 * 등록 순서: POST /equipment → PUT /equipment/{id}/specs → PUT /equipment/{id}/test-types(시험별 정보가 있을 때)
 * 중간 단계가 실패하면 이미 만든 장비 ID를 기억해 다시 눌러도 장비를 또 만들지 않습니다.
 */
const EQUIPMENT_TYPES: [string, string][] = [
  ["TEST", "시험 장비"], ["MEASUREMENT", "측정·분석 장비"], ["MANUFACTURING", "가공·제작 장비"], ["SOFTWARE", "소프트웨어"], ["SUPPORT", "지원 장비"],
];
const ACCESS: [string, string][] = [["UNKNOWN", "확인 필요"], ["EXTERNAL_ALLOWED", "외부 이용 가능 (공동활용)"], ["INTERNAL_ONLY", "기관 내부 전용 (단독활용)"]];
const OPERATION: [string, string][] = [
  ["UNKNOWN", "확인 필요"], ["INSTITUTION_OPERATED", "기관 전담 운영"], ["SUPERVISED_SELF_SERVICE", "입회 후 직접 사용"], ["SELF_SERVICE", "직접 사용"],
];
const AVAILABILITY: [string, string][] = [
  ["UNKNOWN", "확인 필요"], ["AVAILABLE", "운영 가능"], ["BUSY", "사용 중 · 일정 협의"], ["MAINTENANCE", "정비 중"], ["UNAVAILABLE", "제공 중단"],
];
const FEE_UNITS: [string, string][] = [["NEGOTIABLE", "협의"], ["HOUR", "시간당"], ["DAY", "일당"], ["SAMPLE", "시료당"], ["CASE", "건당"]];
/** 시험 종류가 꼭 있어야 하는 분류 (명세: 활성 TEST/MEASUREMENT 장비는 시험유형 1개 이상) */
const NEEDS_TYPES = ["TEST", "MEASUREMENT"];
const STEPS = [
  { title: "장비·시험", hint: "기본 정보 · 시험 종류" },
  { title: "이용·운영", hint: "이용 조건·요금 · 운영 상태" },
  { title: "주요 사양", hint: "사양 확인 후 등록" },
];

type TypeInfo = { costMin: string; costMax: string; days: string; accredited: "" | "true" | "false"; accreditationNo: string; validUntil: string };
const EMPTY_TYPE_INFO: TypeInfo = { costMin: "", costMax: "", days: "", accredited: "", accreditationNo: "", validUntil: "" };
type SpecRow = { id: string; key: string; unit: string; value: string; min: string; max: string; valueText: string; source?: string };

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const defType = (def?: SpecDefinition) => (def?.valueType ?? "NUMBER").toUpperCase();

/** 읽어낸 사양 → 사전 항목: 같은 키 → '_range' 뺀 키 → 같은 한글 이름 순으로 맞춤. 못 맞추면 key 를 비워 담당자가 고르게 */
function matchDefinition(spec: DraftSpec, defs: SpecDefinition[]) {
  const label = spec.label.replace(/\s+/g, "");
  return defs.find((d) => d.specKey === spec.key)
    ?? defs.find((d) => d.specKey === spec.key.replace(/_range$/, ""))
    ?? defs.find((d) => (d.nameKo ?? "").replace(/\s+/g, "") === label);
}
function toRow(spec: DraftSpec, defs: SpecDefinition[], i: number): SpecRow {
  const def = matchDefinition(spec, defs);
  const s = (v?: number | null) => (v == null ? "" : String(v));
  return {
    id: `draft-${i}`, key: def?.specKey ?? "", unit: spec.unit ?? def?.baseUnit ?? "",
    value: s(spec.value), min: s(spec.min), max: s(spec.max), valueText: spec.valueText ?? "",
    source: def ? undefined : `${spec.label} ${spec.min != null ? `${spec.min}~${spec.max}` : spec.value ?? spec.valueText ?? ""} ${spec.unit ?? ""}`.trim(),
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="reg-section">
      <h3>{title}{hint && <small>{hint}</small>}</h3>
      {children}
    </section>
  );
}

export default function EquipmentRegisterDialog({ draft, testTypes, onClose, onDone }: {
  draft: EquipmentDraft;
  testTypes: { code: string; nameKo: string }[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { equipmentList, user, catalogQuery } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const action = useAction();
  const defsQuery = useApiQuery((signal) => equipmentService.specDefinitions(signal), "spec-definitions");
  const defs = useMemo(() => (Array.isArray(defsQuery.data) ? defsQuery.data : []), [defsQuery.data]);
  const defOf = (key: string) => defs.find((d) => d.specKey === key);

  const [step, setStep] = useState(0);
  // 1단계: 기본 정보 · 시험 종류
  const [form, setForm] = useState({ name: draft.name, model: draft.model, manufacturer: draft.manufacturer, description: draft.description, testTypes: draft.testTypes });
  const [equipmentType, setEquipmentType] = useState("TEST");
  const [region, setRegion] = useState("");
  const [typeInfo, setTypeInfo] = useState<Record<string, TypeInfo>>({});
  const info = (code: string) => typeInfo[code] ?? EMPTY_TYPE_INFO;
  const setInfo = (code: string, patch: Partial<TypeInfo>) => setTypeInfo((all) => ({ ...all, [code]: { ...info(code), ...patch } }));
  // 2단계: 이용 조건 · 운영 상태
  const [usage, setUsage] = useState({
    accessScope: "UNKNOWN", operationMode: "UNKNOWN", feeUnit: "NEGOTIABLE", feeAmount: "", vatIncluded: "false", durationText: "",
    availability: "UNKNOWN", leadTimeDays: "", utilizationRate: "", availabilityNote: "",
  });
  const patchUsage = (patch: Partial<typeof usage>) => setUsage((u) => ({ ...u, ...patch }));
  // 3단계: 주요 사양 — 사전이 늦게 와도 읽어낸 사양을 맞출 수 있게, 담당자가 손대기 전까지는 draft 에서 다시 만듦
  const [specEdits, setSpecEdits] = useState<SpecRow[] | null>(null);
  const specs = specEdits ?? draft.specs.map((s, i) => toRow(s, defs, i));
  const editSpecs = (next: SpecRow[]) => setSpecEdits(next);
  const setSpec = (id: string, patch: Partial<SpecRow>) => editSpecs(specs.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const pickSpecKey = (id: string, key: string) => {
    const def = defOf(key);
    setSpec(id, { key, unit: def?.baseUnit ?? "", source: undefined });
  };

  const [createdId, setCreatedId] = useState<number | null>(null);
  /** 단계별로 [다음]·[등록]을 한 번 누른 뒤부터 그 단계의 안내를 보여줌 */
  const [tried, setTried] = useState([false, false, false]);
  const similar = useMemo(() => similarEquipment(form, equipmentList, user.organization?.id), [form, equipmentList, user.organization?.id]);
  const needsTypes = NEEDS_TYPES.includes(equipmentType);
  const usedKeys = specs.map((s) => s.key).filter(Boolean);

  // 명세의 입력 규칙 — 서버 400 전에 화면에서 먼저 알려줌. 단계별로 나눠 [다음]에서 그 단계만 검사
  const problems: string[][] = [[], [], []];
  if (!form.name.trim()) problems[0].push("장비명을 입력해 주세요.");
  if (needsTypes && !form.testTypes.length) problems[0].push("시험·측정 장비는 시험 종류를 하나 이상 골라야 합니다.");
  for (const code of form.testTypes) {
    const t = info(code), name = testTypeLabel(code);
    if ((t.costMin && !isNum(t.costMin)) || (t.costMax && !isNum(t.costMax)) || Number(t.costMin) < 0 || Number(t.costMax) < 0) problems[0].push(`${name}: 예상 비용은 0 이상의 숫자로 입력해 주세요.`);
    else if (isNum(t.costMin) && isNum(t.costMax) && Number(t.costMin) > Number(t.costMax)) problems[0].push(`${name}: 예상 비용 최대가 최소보다 작습니다.`);
    if (t.days && (!Number.isInteger(Number(t.days)) || Number(t.days) < 0)) problems[0].push(`${name}: 소요 일수는 0 이상의 정수로 입력해 주세요.`);
    if (t.accredited === "true" && (!t.accreditationNo.trim() || !t.validUntil)) problems[0].push(`${name}: 공인성적서 발급 가능이면 인정번호와 유효일이 필요합니다.`);
    if (t.accreditationNo.length > 100) problems[0].push(`${name}: 인정번호는 100자 이하로 입력해 주세요.`);
  }
  if (usage.feeUnit !== "NEGOTIABLE" && !(isNum(usage.feeAmount) && Number(usage.feeAmount) >= 0)) problems[1].push("이용료 금액을 0 이상의 숫자로 입력하거나 단위를 '협의'로 두세요.");
  if (usage.leadTimeDays && (!Number.isInteger(Number(usage.leadTimeDays)) || Number(usage.leadTimeDays) < 0)) problems[1].push("대기 일수는 0 이상의 정수로 입력해 주세요.");
  if (usage.utilizationRate && (!isNum(usage.utilizationRate) || Number(usage.utilizationRate) < 0 || Number(usage.utilizationRate) > 100)) problems[1].push("가동률은 0~100 사이로 입력해 주세요.");
  if (usage.availabilityNote.length > 500) problems[1].push("상태 메모는 500자 이하로 입력해 주세요.");
  specs.forEach((s, i) => {
    const def = defOf(s.key), label = def?.nameKo ?? `사양 ${i + 1}`;
    if (!s.key) { problems[2].push(`사양 ${i + 1}: 사양 사전에서 항목을 골라 주세요.`); return; }
    if (specs.findIndex((x) => x.key === s.key) !== i) problems[2].push(`${label}: 같은 사양이 두 번 들어 있습니다.`);
    const type = defType(def);
    if (type === "RANGE" && !(isNum(s.min) && isNum(s.max))) problems[2].push(`${label}: 최소·최대를 모두 입력해 주세요.`);
    else if (type === "RANGE" && Number(s.min) > Number(s.max)) problems[2].push(`${label}: 최소가 최대보다 큽니다.`);
    if (type === "NUMBER" && !isNum(s.value)) problems[2].push(`${label}: 값을 숫자로 입력해 주세요.`);
    if (type === "TEXT" && !s.valueText.trim()) problems[2].push(`${label}: 값을 입력해 주세요.`);
  });

  const markTried = (i: number) => setTried((all) => all.map((v, k) => v || k === i));
  /** [다음]: 지금 단계 칸만 검사하고 넘어감 */
  const next = () => {
    markTried(step);
    if (!problems[step].length) setStep(step + 1);
  };
  /** 진행 막대: 지난 단계로는 언제든, 앞 단계로는 그 사이 단계가 모두 맞을 때만 */
  const goStep = (to: number) => {
    if (to <= step) { setStep(to); return; }
    const blocked = problems.findIndex((list, k) => k >= step && k < to && list.length > 0);
    if (blocked >= 0) { markTried(blocked); setStep(blocked); return; }
    setStep(to);
  };
  const submit = () => {
    // 앞 단계에 고칠 곳이 남아 있으면 그 단계로 돌아가 안내
    const blocked = problems.findIndex((list) => list.length > 0);
    if (blocked >= 0) { markTried(blocked); setStep(blocked); return; }
    void action.run(async (signal) => {
      let id = createdId;
      if (!id) {
        const created = await catalogService.createEquipment({
          name: form.name.trim(), model: form.model.trim() || null, manufacturer: form.manufacturer.trim() || null,
          description: form.description.trim() || null, equipmentType,
          ...(region.trim() ? { region: region.trim() } : {}),
          usage: {
            accessScope: usage.accessScope, operationMode: usage.operationMode, availability: usage.availability,
            // 이용료: 금액·단위·부가세만 보내면 서버가 "12,000원/시간 (부가세 별도)" 형식의 feeText 를 만듦 (협의면 "협의")
            feeUnit: usage.feeUnit,
            ...(usage.feeUnit !== "NEGOTIABLE" ? { feeAmount: Number(usage.feeAmount), vatIncluded: usage.vatIncluded === "true" } : {}),
            ...(usage.durationText.trim() ? { durationText: usage.durationText.trim() } : {}),
            ...(usage.leadTimeDays ? { leadTimeDays: Number(usage.leadTimeDays) } : {}),
            ...(usage.utilizationRate ? { utilizationRate: Number(usage.utilizationRate) } : {}),
            ...(usage.availabilityNote.trim() ? { availabilityNote: usage.availabilityNote.trim() } : {}),
          },
          testTypes: form.testTypes.map((code) => ({ code })),
        }, signal) as { id?: number } | undefined;
        if (!created?.id) throw new Error("장비는 등록됐지만 새 장비 번호를 받지 못했습니다. 보유 장비 관리에서 확인해 주세요.");
        id = created.id;
        setCreatedId(id);
      }
      if (specs.length) {
        await catalogService.saveSpecs(id, specs.map((s) => {
          const def = defOf(s.key), type = defType(def);
          const base = { key: s.key, label: def?.nameKo ?? s.key, unit: s.unit.trim() || def?.baseUnit || null };
          return type === "RANGE" ? { ...base, min: Number(s.min), max: Number(s.max) }
            : type === "TEXT" ? { ...base, valueText: s.valueText.trim() } : { ...base, value: Number(s.value) };
        }) as never, signal);
      }
      const detailed = form.testTypes.filter((code) => Object.values(info(code)).some((v) => v !== ""));
      if (detailed.length) {
        await catalogService.saveTestTypes(id, form.testTypes.map((code) => {
          const t = info(code);
          return {
            code,
            ...(isNum(t.costMin) ? { estCostMin: Number(t.costMin) } : {}),
            ...(isNum(t.costMax) ? { estCostMax: Number(t.costMax) } : {}),
            ...(isNum(t.days) ? { estDurationDays: Number(t.days) } : {}),
            isAccredited: t.accredited === "" ? null : t.accredited === "true",
            ...(t.accredited === "true" ? { accreditationNo: t.accreditationNo.trim(), accreditationValidUntil: t.validUntil } : {}),
          };
        }), signal);
      }
      catalogQuery.reload();
      onDone?.();
      dialog.current?.close();
    }, "장비를 등록했습니다.");
  };

  const regionHint = user.organization?.region ? `비우면 소속 기관 지역(${user.organization.region})` : "비우면 소속 기관 지역";

  return (
    <dialog ref={dialog} className="dialog equipment-dialog register-dialog" aria-labelledby="register-title" onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
      <div className="dialog__heading">
        {draft.source === "manual"
          ? <span className="register-dialog__badge is-manual"><PencilLine size={14} aria-hidden="true" />수동 등록</span>
          : <span className="register-dialog__badge"><Sparkles size={14} aria-hidden="true" />AI가 채운 양식</span>}
        <button type="button" className="icon-button" aria-label="장비 등록 닫기" onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      <h2 id="register-title">새 장비 등록</h2>
      {/* 위쪽 진행 막대 (AI 간편 의뢰와 같은 모양) */}
      <ol className="reg-progress" aria-label="등록 단계">
        {STEPS.map((st, i) => {
          const state = i < step ? "is-done" : i === step ? "is-current" : "";
          return (
            <li key={st.title} className={state || undefined} aria-current={i === step ? "step" : undefined}>
              <button type="button" onClick={() => goStep(i)} disabled={action.busy}>
                <span className="reg-progress__label">
                  <span className="reg-progress__num">{i < step ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>
                  {st.title}
                </span>
                <small>{st.hint}</small>
              </button>
            </li>
          );
        })}
      </ol>
      {step === 0 && (draft.found.length > 0
        ? <p className="register-dialog__found"><b>이렇게 읽었어요</b> {draft.found.join(" · ")}<br /><small>틀린 곳이 있으면 고친 뒤 등록하세요.</small></p>
        : <p className="register-dialog__found"><small>{draft.source === "file" && "사양서에서 장비 정보를 찾지 못했어요. "}* 표시만 채우면 등록할 수 있고, 나머지는 아는 것만 넣으세요. 모르는 항목은 '확인 필요'로 두면 나중에 보유 장비 관리에서 채울 수 있습니다.</small></p>)}

      {step === 0 && similar.length > 0 && (
        <div className="register-dialog__similar" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>비슷한 장비가 이미 있어요</strong>
            <ul>
              {similar.map(({ item, sameModel, own }) => (
                <li key={item.id}>{item.name} · {item.institution}{sameModel ? " (같은 모델)" : ""}{own ? " — 우리 기관 장비" : ""}</li>
              ))}
            </ul>
            <small>같은 장비라면 새로 등록하지 말고 보유 장비 관리에서 정보를 갱신하세요.</small>
          </div>
        </div>
      )}


      <form className="register-dialog__form" onSubmit={(e) => { e.preventDefault(); if (step < STEPS.length - 1) next(); else submit(); }} noValidate>
        <div key={step} className="reg-step">
        {step === 0 && <>
          <Section title="기본 정보">
            <div className="reg-grid">
              <FormField id="reg-name" label="장비명 *" className="reg-grid__wide"><input id="reg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 대형 전기역학 진동시험기" /></FormField>
              <FormField id="reg-model" label="모델"><input id="reg-model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></FormField>
              <FormField id="reg-maker" label="제조사"><input id="reg-maker" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></FormField>
              <FormField id="reg-type" label="장비 분류 *">
                <select id="reg-type" value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)}>
                  {EQUIPMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
              <FormField id="reg-region" label="지역" hint={regionHint}><input id="reg-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder={user.organization?.region ?? "예: 대전"} /></FormField>
              <FormField id="reg-desc" label="장비 설명" className="reg-grid__wide">
                <textarea id="reg-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="용도, 특징, 시료 반입 조건 등" />
              </FormField>
            </div>
          </Section>

          <Section title={`시험 종류${needsTypes ? " *" : ""}`} hint="여러 개 고를 수 있어요 · 고른 시험마다 예상 비용·기간·공인 정보를 넣을 수 있어요">
            <div className="register-dialog__types" role="group" aria-label="시험 종류">
              {testTypes.map((t) => (
                <button type="button" key={t.code} className="chip" aria-pressed={form.testTypes.includes(t.code)}
                  onClick={() => setForm({ ...form, testTypes: form.testTypes.includes(t.code) ? form.testTypes.filter((c) => c !== t.code) : [...form.testTypes, t.code] })}>
                  {t.nameKo || testTypeLabel(t.code)}
                </button>
              ))}
            </div>
            {form.testTypes.length > 0 && (
              <ul className="reg-types">
                {form.testTypes.map((code) => {
                  const t = info(code);
                  return (
                    <li key={code}>
                      <strong>{testTypeLabel(code)}</strong>
                      <div className="reg-types__fields">
                        <label className="reg-mini reg-mini--cost"><span>예상 비용 (원)</span>
                          <span className="reg-range">
                            <input type="number" min={0} inputMode="numeric" aria-label={`${testTypeLabel(code)} 예상 비용 최소`} value={t.costMin} onChange={(e) => setInfo(code, { costMin: e.target.value })} placeholder="최소" />
                            <span aria-hidden="true">~</span>
                            <input type="number" min={0} inputMode="numeric" aria-label={`${testTypeLabel(code)} 예상 비용 최대`} value={t.costMax} onChange={(e) => setInfo(code, { costMax: e.target.value })} placeholder="최대" />
                          </span>
                        </label>
                        <label className="reg-mini"><span>소요 일수</span>
                          <input type="number" min={0} step={1} inputMode="numeric" value={t.days} onChange={(e) => setInfo(code, { days: e.target.value })} placeholder="일" />
                        </label>
                        <label className="reg-mini"><span>공인성적서</span>
                          <select value={t.accredited} onChange={(e) => setInfo(code, { accredited: e.target.value as TypeInfo["accredited"] })}>
                            <option value="">확인 필요</option><option value="true">발급 가능</option><option value="false">발급 불가</option>
                          </select>
                        </label>
                        {t.accredited === "true" && <>
                          <label className="reg-mini"><span>인정번호 *</span>
                            <input value={t.accreditationNo} maxLength={100} onChange={(e) => setInfo(code, { accreditationNo: e.target.value })} placeholder="예: KT-123" />
                          </label>
                          <label className="reg-mini"><span>유효일 *</span>
                            <input type="date" value={t.validUntil} onChange={(e) => setInfo(code, { validUntil: e.target.value })} />
                          </label>
                        </>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

        </>}
        {step === 1 && <>
          <Section title="이용 조건·요금">
            <div className="reg-grid">
              <FormField id="reg-access" label="이용 범위">
                <select id="reg-access" value={usage.accessScope} onChange={(e) => patchUsage({ accessScope: e.target.value })}>
                  {ACCESS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
              <FormField id="reg-operation" label="운영 방식">
                <select id="reg-operation" value={usage.operationMode} onChange={(e) => patchUsage({ operationMode: e.target.value })}>
                  {OPERATION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
              <FormField id="reg-fee-unit" label="이용료" className="reg-grid__wide" hint="금액·단위·부가세를 넣으면 '12,000원/시간 (부가세 별도)' 형식으로 표시돼요">
                <span className="reg-fee">
                  <select id="reg-fee-unit" aria-label="이용료 단위" value={usage.feeUnit} onChange={(e) => patchUsage({ feeUnit: e.target.value })}>
                    {FEE_UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="number" min={0} inputMode="numeric" aria-label="이용료 금액(원)" value={usage.feeAmount} disabled={usage.feeUnit === "NEGOTIABLE"}
                    onChange={(e) => patchUsage({ feeAmount: e.target.value })} placeholder={usage.feeUnit === "NEGOTIABLE" ? "협의" : "금액 (원)"} />
                  <select aria-label="부가세" value={usage.vatIncluded} disabled={usage.feeUnit === "NEGOTIABLE"} onChange={(e) => patchUsage({ vatIncluded: e.target.value })}>
                    <option value="false">부가세 별도</option><option value="true">부가세 포함</option>
                  </select>
                </span>
              </FormField>
              <FormField id="reg-duration" label="소요 기간 안내" className="reg-grid__wide">
                <input id="reg-duration" value={usage.durationText} onChange={(e) => patchUsage({ durationText: e.target.value })} placeholder="예: 최소 2일, 시료 준비 포함 1주" />
              </FormField>
            </div>
          </Section>

          <Section title="운영 상태">
            <div className="reg-grid">
              <FormField id="reg-availability" label="가용 상태">
                <select id="reg-availability" value={usage.availability} onChange={(e) => patchUsage({ availability: e.target.value })}>
                  {AVAILABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
              <FormField id="reg-lead" label="대기 일수" hint="지금 의뢰하면 시작까지 걸리는 날">
                <input id="reg-lead" type="number" min={0} step={1} inputMode="numeric" value={usage.leadTimeDays} onChange={(e) => patchUsage({ leadTimeDays: e.target.value })} placeholder="일" />
              </FormField>
              <FormField id="reg-util" label="가동률 (%)">
                <input id="reg-util" type="number" min={0} max={100} step="any" value={usage.utilizationRate} onChange={(e) => patchUsage({ utilizationRate: e.target.value })} placeholder="0~100" />
              </FormField>
              <FormField id="reg-note" label="상태 메모" className="reg-grid__wide" hint={`판단 근거 · ${usage.availabilityNote.length}/500자`}>
                <input id="reg-note" value={usage.availabilityNote} maxLength={500} onChange={(e) => patchUsage({ availabilityNote: e.target.value })} placeholder="예: 12월 둘째 주 정기 점검 예정" />
              </FormField>
            </div>
          </Section>

        </>}
        {step === 2 && <>
          <Section title="주요 사양" hint="사양 사전의 항목만 등록할 수 있어요 · 기관이 확인한 실제 값만 넣으세요">
            {defsQuery.error && <p className="register-dialog__empty">사양 사전을 불러오지 못했습니다. <button type="button" className="text-link" onClick={defsQuery.reload}>다시 불러오기</button></p>}
            {specs.length === 0 && <p className="register-dialog__empty">{draft.source === "file" ? "읽어낸 사양이 없습니다." : "등록할 사양이 없습니다."} 필요하면 추가하세요.</p>}
            {specs.map((spec) => {
              const def = defOf(spec.key), type = defType(def);
              return (
                <div className="spec-row" key={spec.id}>
                  <select aria-label="사양 항목" value={spec.key} onChange={(e) => pickSpecKey(spec.id, e.target.value)} className={!spec.key ? "is-missing" : undefined}>
                    <option value="">{defsQuery.loading ? "사양 사전 불러오는 중…" : "사양 고르기"}</option>
                    {defs.map((d) => <option key={d.specKey} value={d.specKey} disabled={d.specKey !== spec.key && usedKeys.includes(d.specKey)}>{d.nameKo ?? d.specKey}</option>)}
                  </select>
                  {type === "RANGE" ? (
                    <span className="spec-row__range">
                      <input aria-label={`${def?.nameKo ?? "사양"} 최소`} type="number" step="any" value={spec.min} onChange={(e) => setSpec(spec.id, { min: e.target.value })} placeholder="최소" />
                      <span aria-hidden="true">~</span>
                      <input aria-label={`${def?.nameKo ?? "사양"} 최대`} type="number" step="any" value={spec.max} onChange={(e) => setSpec(spec.id, { max: e.target.value })} placeholder="최대" />
                    </span>
                  ) : type === "TEXT" ? (
                    <input aria-label={`${def?.nameKo ?? "사양"} 값`} value={spec.valueText} onChange={(e) => setSpec(spec.id, { valueText: e.target.value })} placeholder="값" />
                  ) : (
                    <input aria-label={`${def?.nameKo ?? "사양"} 값`} type="number" step="any" value={spec.value} onChange={(e) => setSpec(spec.id, { value: e.target.value })} placeholder="값" />
                  )}
                  <input aria-label="단위" className="spec-row__unit" value={spec.unit} onChange={(e) => setSpec(spec.id, { unit: e.target.value })} placeholder={def?.baseUnit ?? "단위"} />
                  <button type="button" className="icon-button" aria-label={`${def?.nameKo ?? "사양"} 삭제`} onClick={() => editSpecs(specs.filter((s) => s.id !== spec.id))}><Trash2 size={15} /></button>
                  {spec.source && <small className="spec-row__source">읽은 값: {spec.source} — 사전에서 맞는 항목을 골라 주세요</small>}
                </div>
              );
            })}
            <button type="button" className="text-link reg-add" disabled={!defs.length || usedKeys.length >= defs.length}
              onClick={() => editSpecs([...specs, { id: `new-${Date.now()}`, key: "", unit: "", value: "", min: "", max: "", valueText: "" }])}>
              <Plus size={13} aria-hidden="true" />사양 추가
            </button>
          </Section>

        </>}
        </div>

        {tried[step] && problems[step].length > 0 && (
          <div className="reg-problems" role="alert">
            <strong>{step < STEPS.length - 1 ? "다음으로 가기 전에 확인해 주세요" : "등록 전에 확인해 주세요"}</strong>
            <ul>{problems[step].slice(0, 6).map((p) => <li key={p}>{p}</li>)}{problems[step].length > 6 && <li>외 {problems[step].length - 6}건</li>}</ul>
          </div>
        )}
        {step === STEPS.length - 1 && similar.length > 0 && (
          <p className="reg-similar-note"><AlertTriangle size={14} aria-hidden="true" />비슷한 장비 {similar.length}대가 이미 있어요{similar.some((x) => x.sameModel) ? " (같은 모델 포함)" : ""}. 같은 장비라면 보유 장비 관리에서 갱신하세요.</p>
        )}
        {createdId && action.error && <p className="register-dialog__empty">장비는 이미 만들어졌어요. 다시 누르면 남은 사양·시험 정보만 저장합니다.</p>}
        <Feedback action={action} />
        <div className="dialog__actions reg-actions">
          {step > 0
            ? <Button type="button" variant="secondary" disabled={action.busy} onClick={() => setStep(step - 1)}>이전</Button>
            : <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>취소</Button>}
          <span className="reg-actions__count">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1
            ? <Button type="submit" icon={ArrowRight}>다음</Button>
            : <Button type="submit" disabled={action.busy}>{action.busy ? "등록 중…" : createdId ? "남은 정보 저장" : similar.some((x) => x.sameModel) ? "그래도 등록" : "장비 등록"}</Button>}
        </div>
      </form>
    </dialog>
  );
}
