import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight, CircleAlert, CircleCheck, CircleHelp, ClipboardList, FileText, Info, RotateCcw, Send, Sparkles,
} from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { catalogService } from "../services/catalogService";
import type { SearchResult } from "../services/catalogService";
import { requirementService } from "../services/requirementService";
import { requestService } from "../services/requestService";
import type { ConditionRule, MatchRun, RequirementCondition } from "../services/contracts";
import { takeQuickPrefill } from "../domain/quickPrefill";
import { Button, PageHeader } from "./ui";
import ApiState from "./ui/ApiState";
import "../styles/quick-sim.css";
import "../styles/quick-request.css";

/**
 * AI 간편 의뢰 (v15)
 * 가상 시뮬레이션처럼 한 번에 한 단계씩: ① 조건 정하기 → ② 장비 고르기 → ③ 의뢰서 쓰기
 * - ① 문장을 쓰면 GET /search 가 시험유형·조건·지역을 해석해 칸을 채움. 칸은 GET /test-types/{code} 의 conditionRules 로 만듦
 * - ② POST /requirements → POST /requirements/{id}/match-runs 결과(조건별 충족 여부)로 장비 비교·선택
 * - ③ POST /test-requests/ai-draft 로 초안을 만들고 PUT .../draft 로 기간·담당자를 채운 뒤 POST .../submit
 * 오른쪽 '지금까지 정한 것'은 단계와 상관없이 항상 보입니다.
 */

type Values = Record<string, { value?: string; min?: string; max?: string; valueText?: string; ai?: boolean }>;
type Form = {
  purpose: string; sampleName: string; quantity: string; readyDate: string; start: string; end: string;
  userName: string; userContact: string; accName: string; accContact: string; notes: string;
};
const STEPS = [
  { title: "조건 정하기", hint: "시험 종류·조건" },
  { title: "장비 고르기", hint: "조건에 맞는 장비 비교" },
  { title: "의뢰서 쓰기", hint: "기간·담당자 쓰고 제출" },
];
const EXAMPLES = [
  "15kg 위성 전장품을 20~2000Hz로 진동시험 하고 싶어요",
  "큐브위성 부품 -40~70℃ 열진공 시험, 8회 사이클",
  "S-band 송신기 EMC 복사 내성 30~1000MHz, 20V/m",
];
const VERDICT: Record<string, [string, string]> = { SUITABLE: ["모두 충족", "ok"], PARTIAL: ["일부 기관 확인", "warn"], UNSUITABLE: ["조건 벗어남", "bad"] };
const RESULT: Record<string, [string, string]> = { MET: ["충족", "ok"], NOT_MET: ["벗어남", "bad"], UNKNOWN: ["기관 확인", "warn"] };
const won = (v?: number | null) => (v == null ? null : `${v.toLocaleString("ko-KR")}원`);
const isNum = (v?: string) => v != null && v.trim() !== "" && Number.isFinite(Number(v));
const filled = (rule: ConditionRule, v?: Values[string]) =>
  !!v && (rule.valueType === "RANGE" ? isNum(v.min) && isNum(v.max) : rule.valueType === "NUMBER" ? isNum(v.value) : !!v.valueText?.trim());
const showValue = (rule: ConditionRule, v?: Values[string]) =>
  !v ? "" : rule.valueType === "RANGE" ? `${Number(v.min).toLocaleString("ko-KR")}~${Number(v.max).toLocaleString("ko-KR")} ${rule.unit ?? ""}`
    : rule.valueType === "NUMBER" ? `${Number(v.value).toLocaleString("ko-KR")} ${rule.unit ?? ""}` : v.valueText ?? "";
const TIPS: Record<string, string> = {
  VIBRATION: "시료를 고정하는 방법(지그·고정구)",
  SHOCK: "충격 방향과 횟수(축별)",
  THERMAL_VACUUM: "시료 크기와 발열량",
  TEMPERATURE_HUMIDITY: "사이클 횟수와 유지 시간",
  ACOUSTIC_NOISE: "음향 스펙트럼 규격서",
  EMC: "적용 규격(예: MIL-STD-461)과 동작 모드",
  ELECTRICAL_RF_ANALYSIS: "안테나 크기와 측정 주파수",
  X_RAY_INSPECTION: "재질과 가장 두꺼운 부분",
};

/** 받침 유무로 '을/를'을 고릅니다. (한글이 아니면 '을(를)') */
function josa(word: string) {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 ? "을" : "를";
}

export default function QuickRequest({ setActiveMenu }: { setActiveMenu: (menu: string) => void }) {
  const { user } = useWorkspace();
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [fileText, setFileText] = useState<{ names: string[]; text: string }>({ names: [], text: "" });
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({});
  const [read, setRead] = useState<{ found: string[]; regions: string[]; interpreter?: string; noType?: boolean } | null>(null);
  const [showInstitutions, setShowInstitutions] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<{ id: number; key: string; type: string } | null>(null);
  const [run, setRun] = useState<MatchRun | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [form, setForm] = useState<Form>({
    purpose: "", sampleName: "", quantity: "1", readyDate: "", start: "", end: "",
    userName: user.name ?? "", userContact: user.phone || user.email || "", accName: "", accContact: "", notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => { setFormError(null); }, [form]); // 고치기 시작하면 안내를 지움
  const [draft, setDraft] = useState<{ id: number; no?: string; notes?: string[] } | null>(null);
  const [done, setDone] = useState<{ submitted: boolean; no?: string } | null>(null);
  const ai = useAction();
  const finder = useAction();
  const writer = useAction();

  const types = useApiQuery((signal) => catalogService.testTypes(signal), "test-types");
  const available = (types.data ?? []).filter((t) => (t.equipmentCount ?? 0) > 0);
  const detail = useApiQuery((signal) => catalogService.testType(typeCode as string, signal), `test-type:${typeCode}`, Boolean(typeCode));
  const rules = detail.data?.conditionRules ?? [];
  const typeName = types.data?.find((t) => t.code === typeCode)?.nameKo ?? detail.data?.nameKo;
  const required = rules.filter((r) => r.isRequired);
  const requiredDone = required.filter((r) => filled(r, values[r.conditionKey])).length;
  const institutions = detail.data?.institutions ?? [];
  const minCost = institutions.map((i) => i.estCostMin).filter((v): v is number => typeof v === "number");
  const minDays = institutions.map((i) => i.estDurationDays).filter((v): v is number => typeof v === "number");
  const estimate = { cost: minCost.length ? Math.min(...minCost) : null, days: minDays.length ? Math.min(...minDays) : null };
  const chosen = run?.results.find((r) => r.id === picked) ?? null;

  /** 문장 → GET /search 해석 → 시험 종류·조건 칸 채우기 */
  const fillByAi = (sentence = text, extra = fileText.text) => {
    const q = [sentence.trim(), extra.trim()].filter(Boolean).join("\n");
    if (!q) { setFieldError("시험하고 싶은 내용을 한두 문장으로 적어 주세요."); return; }
    setFieldError(null);
    void ai.run(async (signal) => {
      const r: SearchResult = await catalogService.search(q.slice(0, 1000), signal);
      const code = r.interpreted.testTypes[0] ?? null;
      if (code) { setTypeCode(code); setRequirement(null); setRun(null); setPicked(null); }
      const next: Values = {};
      for (const c of r.interpreted.conditions ?? []) {
        next[c.key] = { ai: true, value: c.value != null ? String(c.value) : undefined, min: c.min != null ? String(c.min) : undefined,
          max: c.max != null ? String(c.max) : undefined, valueText: c.valueText ?? undefined };
      }
      if (code) setValues(next); else setValues((v) => ({ ...v, ...next }));
      setRead({ found: (r.interpreted.conditions ?? []).map((c) => c.label ?? c.key), regions: r.interpreted.regions ?? [], interpreter: r.interpreted.interpreter, noType: !code });
      if (!form.purpose) setForm((f) => ({ ...f, purpose: sentence.trim().slice(0, 120) }));
    });
  };

  // 대시보드 'AI 간편 의뢰'에서 적어 둔 글(·파일)을 받아 바로 해석.
  // 개발 모드(StrictMode)의 '마운트 → 해제 → 다시 마운트'에서 첫 요청이 취소되지 않도록 다음 틱에 한 번만 실행합니다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const prefill = takeQuickPrefill();
      if (!prefill) return;
      const extra = prefill.files.map((f) => f.text ?? "").filter(Boolean).join("\n");
      setText(prefill.text);
      setFileText({ names: prefill.files.map((f) => f.name), text: extra });
      if (prefill.text || extra) fillByAi(prefill.text, extra);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (key: string, patch: Partial<Values[string]>) => {
    setValues((v) => ({ ...v, [key]: { ...v[key], ...patch, ai: false } }));
    setFieldError(null); setRun(null); setPicked(null);
  };
  const pickType = (code: string) => {
    if (code === typeCode) return;
    setTypeCode(code); setValues({}); setRead(null); setRequirement(null); setRun(null); setPicked(null); setShowInstitutions(false);
  };
  const resetAll = () => {
    setText(""); setFileText({ names: [], text: "" }); setTypeCode(null); setValues({}); setRead(null); setRequirement(null); setRun(null);
    setPicked(null); setDraft(null); setDone(null); setStep(0); setFieldError(null); setFormError(null);
  };

  const conditions = (): RequirementCondition[] => rules.filter((r) => filled(r, values[r.conditionKey])).map((r) => {
    const v = values[r.conditionKey];
    const base = { key: r.conditionKey, label: r.label, unit: r.unit ?? null, status: "CONFIRMED", source: v.ai ? "AI_EXTRACTED" : "USER" };
    return r.valueType === "RANGE" ? { ...base, min: Number(v.min), max: Number(v.max) }
      : r.valueType === "NUMBER" ? { ...base, value: Number(v.value) } : { ...base, valueText: v.valueText?.trim() };
  });

  /** ① → ② : 시험조건 저장 후 매칭 실행 */
  const findEquipment = () => {
    if (!typeCode) { setFieldError("시험 종류를 먼저 골라 주세요."); return; }
    const bad = rules.find((r) => r.valueType === "RANGE" && isNum(values[r.conditionKey]?.min) && isNum(values[r.conditionKey]?.max)
      && Number(values[r.conditionKey].min) > Number(values[r.conditionKey].max));
    if (bad) { setFieldError(`'${bad.label}'의 끝 값이 시작 값보다 커야 합니다.`); return; }
    const conds = conditions();
    const key = JSON.stringify([typeCode, conds]);
    if (run && requirement?.key === key) { setStep(1); return; }
    void finder.run(async (signal) => {
      const title = `${typeName ?? "시험"} 의뢰${form.sampleName ? ` · ${form.sampleName}` : ""}`;
      // 같은 시험 종류면 기존 시험조건의 조건만 바꾸고(PUT), 종류가 바뀌었으면 새로 만듦(POST)
      let id = requirement?.type === typeCode ? requirement.id : undefined;
      if (id) await requirementService.conditions(id, conds, signal);
      else id = (await requirementService.create({ testTypeCode: typeCode, title, purpose: form.purpose, sampleName: form.sampleName, conditions: conds }, signal)).id;
      const result = await requirementService.match(id, { limit: 5, ...(read?.regions?.[0] ? { region: read.regions[0] } : {}) }, signal);
      setRequirement({ id, key, type: typeCode }); setRun(result);
      const first = result.results.find((r) => r.verdict !== "UNSUITABLE") ?? result.results[0];
      setPicked(first?.id ?? null); setStep(1);
    });
  };

  const reqFields: [keyof Form, string][] = [["start", "희망 시작일"], ["end", "희망 종료일"], ["userName", "실사용자 이름"], ["userContact", "실사용자 연락처"], ["accName", "회계 담당자 이름"], ["accContact", "회계 담당자 연락처"]];
  const formDone = reqFields.filter(([k]) => form[k].trim()).length;

  /** ③ 저장/제출: AI 초안(한 번만) → 내용 채워 저장 → (제출) */
  const write = (submit: boolean) => {
    if (!chosen || !requirement) return;
    if (submit) {
      const miss = reqFields.find(([k]) => !form[k].trim());
      if (miss) { setFormError(`'${miss[1]}'${josa(miss[1])} 입력해 주세요. 제출에 꼭 필요한 항목입니다.`); return; }
      if (form.end < form.start) { setFormError("희망 종료일이 시작일보다 빠릅니다."); return; }
    }
    setFormError(null);
    void writer.run(async (signal) => {
      let id = draft?.id;
      let no = draft?.no;
      if (!id) {
        const made = await requestService.aiDraft({ requirementId: requirement.id, equipmentId: chosen.equipment.id, matchResultId: chosen.id }, signal);
        id = made.requestId; no = made.requestNo;
        setDraft({ id, no, notes: made.aiNotes });
      }
      const current = await requestService.get(id, signal);
      const base = (current.revision?.content ?? {}) as Record<string, unknown>;
      const contact = (v: string) => (v.includes("@") ? { email: v.trim() } : { phone: v.trim() });
      const content = {
        ...base,
        actualUser: { name: form.userName.trim(), ...contact(form.userContact) },
        accounting: { name: form.accName.trim(), ...contact(form.accContact) },
        test: { ...(base.test as object), testTypeCode: typeCode, purpose: form.purpose.trim() },
        sample: { ...(base.sample as object), name: form.sampleName.trim(), quantity: Number(form.quantity) || 1, readyDate: form.readyDate || null },
        conditions: conditions(),
        schedule: { desiredStartDate: form.start || null, desiredEndDate: form.end || null },
        notes: form.notes.trim(),
      };
      const saved = await requestService.save(id, current.version, content, signal);
      if (submit) await requestService.submit(id, saved.version ?? current.version + 1, signal);
      setDone({ submitted: submit, no: no ?? current.requestNo });
    });
  };

  const goStep = (to: number) => {
    if (to === 1 && !run) return;
    if (to === 2 && !chosen) return;
    setStep(to);
  };
  const nextTodo = done ? (done.submitted ? "시험기관이 검토를 시작하면 알림으로 알려 드려요." : "시험 의뢰 관리에서 이어서 쓰고 제출하세요.")
    : step === 0 ? (typeCode ? "조건을 넣고 '맞는 장비 찾기'를 누르세요." : "하고 싶은 시험을 문장으로 적고 'AI로 채우기'를 누르세요.")
    : step === 1 ? "조건 충족 여부를 비교해 장비를 하나 고르세요." : "희망 기간과 담당자를 적고 제출하세요.";

  return (
    <div className="content-page page-enter quick-request-page">
      <PageHeader title="AI 간편 의뢰" />
      <div className="qr-layout">
        {/* 왼쪽: 단계 */}
        <ol className="qr-steps" aria-label="진행 단계">
          {STEPS.map((s, i) => {
            const state = done ? "is-done" : i < step ? "is-done" : i === step ? "is-current" : "";
            const sub = i === 0 ? (typeName ?? s.hint) : i === 1 ? (chosen?.equipment.name ?? s.hint) : s.hint;
            return (
              <li key={s.title} className={state} aria-current={i === step && !done ? "step" : undefined}>
                <button type="button" disabled={!!done || (i === 1 && !run) || (i === 2 && !chosen)} onClick={() => goStep(i)}>
                  <span className="qr-steps__num">{state === "is-done" ? <CircleCheck size={15} aria-hidden="true" /> : i + 1}</span>
                  <span className="qr-steps__text"><strong>{s.title}</strong><small>{sub}</small></span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* 가운데: 현재 단계 */}
        <div className="qr-main">
          {done ? (
            <section className="sim-card qr-done" aria-live="polite">
              <span className={`qr-done__icon${done.submitted ? "" : " is-saved"}`}>{done.submitted ? <Send size={26} /> : <FileText size={26} />}</span>
              <h2>{done.submitted ? "의뢰서를 제출했어요" : "의뢰서를 임시 저장했어요"}</h2>
              <p>{done.no && <><b>{done.no}</b> · </>}{chosen?.equipment.name} · {chosen?.equipment.institutionName}</p>
              <p className="qr-done__sub">{nextTodo}</p>
              <div className="qr-done__actions">
                <Button icon={ClipboardList} onClick={() => setActiveMenu("reservationCheck")}>시험 의뢰 관리에서 보기</Button>
                <Button variant="secondary" icon={RotateCcw} onClick={resetAll}>새 AI 간편 의뢰</Button>
              </div>
            </section>
          ) : step === 0 ? (
            <section key="s0" className="sim-card qr-card" aria-labelledby="qr-ai-title">
              <h2 id="qr-ai-title" className="qr-card__title"><Sparkles size={17} aria-hidden="true" />말로 설명하면 AI가 조건을 채워 드려요</h2>
              <form className="qr-ask" onSubmit={(e) => { e.preventDefault(); fillByAi(); }}>
                <label htmlFor="qr-text" className="sr-only">시험 설명</label>
                <input id="qr-text" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder={`예: ${EXAMPLES[0]}`} />
                <button type="submit" className="qr-ask__go" disabled={ai.busy}>{ai.busy ? "읽는 중…" : "AI로 채우기"}</button>
              </form>
              {!text && !read && (
                <div className="qr-examples" aria-label="예시 문장">
                  {EXAMPLES.map((e) => <button type="button" key={e} onClick={() => { setText(e); fillByAi(e, ""); }}>{e}</button>)}
                </div>
              )}
              {fileText.names.length > 0 && <p className="qr-files"><FileText size={13} aria-hidden="true" />함께 읽은 파일: {fileText.names.join(", ")}</p>}
              {ai.error && <ApiState error={ai.error} />}
              {read && !ai.busy && (
                <p className={`qr-read${read.noType ? " is-warn" : ""}`} role="status">
                  {read.noType ? <><CircleAlert size={14} aria-hidden="true" />시험 종류를 알아내지 못했어요. 아래에서 직접 골라 주세요.</>
                    : <><CircleCheck size={14} aria-hidden="true" />{read.found.length ? `${read.found.join(", ")}${josa(read.found[read.found.length - 1])} 읽었어요.` : "시험 종류를 찾았어요. 조건은 직접 넣어 주세요."}{read.regions.length ? ` 지역 ${read.regions.join("·")} 기준으로 장비를 찾을게요.` : ""}</>}
                </p>
              )}

              <div className="qr-divider"><span>정리된 조건</span></div>
              <div className="qr-types">
                <div className="qr-types__list" role="radiogroup" aria-label="시험 종류">
                  {(typeCode ? [...available].sort((a, b) => (a.code === typeCode ? -1 : b.code === typeCode ? 1 : 0)) : available).map((t) => (
                    <button type="button" role="radio" key={t.code} aria-checked={t.code === typeCode} onClick={() => pickType(t.code)}>{t.nameKo}</button>
                  ))}
                </div>
                {(typeCode || text) && <button type="button" className="qr-reset" onClick={resetAll}><RotateCcw size={14} aria-hidden="true" />다시 쓰기</button>}
              </div>

              {typeCode && (detail.loading ? <ApiState loading /> : detail.error ? <ApiState error={detail.error} onRetry={detail.reload} /> : (
                <>
                  <div className="qr-info">
                    <Info size={15} aria-hidden="true" />
                    <span><b>{typeName}</b> 시험기관 {institutions.length}곳, 장비 {detail.data?.equipmentCount ?? institutions.reduce((n, i) => n + i.equipmentCount, 0)}대
                      {estimate.cost != null && <>, 예상 비용 {won(estimate.cost)}부터</>}{estimate.days != null && <>, 최소 {estimate.days}일</>}</span>
                    <button type="button" className="text-link" aria-expanded={showInstitutions} onClick={() => setShowInstitutions((v) => !v)}>{showInstitutions ? "접기" : "자세히"}</button>
                  </div>
                  {showInstitutions && (
                    <table className="qr-inst">
                      <thead><tr><th>시험기관</th><th>지역</th><th className="is-num">장비</th><th className="is-num">예상 비용</th><th className="is-num">최소 기간</th></tr></thead>
                      <tbody>{institutions.map((i) => (
                        <tr key={i.id}><td>{i.name}</td><td>{i.region ?? "—"}</td><td className="is-num">{i.equipmentCount}대</td>
                          <td className="is-num">{i.estCostMin == null ? "협의" : i.estCostMax && i.estCostMax !== i.estCostMin ? `${won(i.estCostMin)}~${won(i.estCostMax)}` : won(i.estCostMin)}</td>
                          <td className="is-num">{i.estDurationDays != null ? `${i.estDurationDays}일` : "—"}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                  <div className="qr-fields">
                    {rules.map((r) => {
                      const v = values[r.conditionKey] ?? {};
                      const id = `qr-${r.conditionKey}`;
                      return (
                        <div key={r.conditionKey} className={`qr-field${v.ai && filled(r, v) ? " is-ai" : ""}${r.valueType === "RANGE" ? " is-range" : ""}`}>
                          <label htmlFor={id} className="qr-field__label">
                            <b>{r.label}{r.isRequired && <i aria-label="필수"> *</i>}</b>
                            {!r.isRequired && <small>시험기관이 확인</small>}
                            {v.ai && filled(r, v) && <small className="qr-field__ai">AI가 채움</small>}
                          </label>
                          <span className="qr-field__control">
                            {r.conditionKey === "accredited_required" ? (
                              <select id={id} value={v.valueText ?? ""} onChange={(e) => setValue(r.conditionKey, { valueText: e.target.value })}>
                                <option value="">아직 모름</option><option value="필요">필요</option><option value="불필요">불필요</option>
                              </select>
                            ) : r.valueType === "RANGE" ? (
                              <>
                                <input id={id} inputMode="decimal" value={v.min ?? ""} aria-label={`${r.label} 시작`} onChange={(e) => setValue(r.conditionKey, { min: e.target.value })} />
                                <span className="qr-field__tilde">~</span>
                                <input inputMode="decimal" value={v.max ?? ""} aria-label={`${r.label} 끝`} onChange={(e) => setValue(r.conditionKey, { max: e.target.value })} />
                              </>
                            ) : r.valueType === "NUMBER" ? (
                              <input id={id} inputMode="decimal" value={v.value ?? ""} onChange={(e) => setValue(r.conditionKey, { value: e.target.value })} />
                            ) : (
                              <input id={id} value={v.valueText ?? ""} placeholder={r.conditionKey === "excitation_axis" ? "예: X·Y·Z 3축" : ""} onChange={(e) => setValue(r.conditionKey, { valueText: e.target.value })} />
                            )}
                            <small className="qr-field__unit">{r.unit ?? ""}</small>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ))}
              {fieldError && <p className="sim-error" role="alert">{fieldError}</p>}
              {finder.error && <ApiState error={finder.error} />}
              <footer className="qr-card__foot">
                <span>{typeCode ? <>필수 조건 <b>{requiredDone}/{required.length}</b>개 입력{required.length > requiredDone ? " · 비워 두면 '기관 확인'으로 비교해요" : ""}, 비워 둔 조건은 시험기관이 확인합니다.</> : "시험 종류를 고르면 입력할 조건이 나타나요."}</span>
                <Button icon={ArrowRight} disabled={!typeCode || finder.busy || detail.loading} onClick={findEquipment}>{finder.busy ? "찾는 중…" : "맞는 장비 찾기"}</Button>
              </footer>
            </section>
          ) : step === 1 && run ? (
            <section key="s1" className="sim-card qr-card" aria-labelledby="qr-match-title">
              <header className="sim-card__head">
                <span className="sim-card__num">2</span>
                <div>
                  <h2 id="qr-match-title">조건에 맞는 장비 {run.results.length}대</h2>
                  <p>입력한 조건을 장비 사양과 하나씩 비교했어요. 하나를 고르면 그 장비로 의뢰서를 씁니다.</p>
                </div>
              </header>
              {run.results.length ? (
                <ul className="qr-matches" role="radiogroup" aria-label="장비 선택">
                  {run.results.map((r, i) => {
                    const [vLabel, vTone] = VERDICT[r.verdict] ?? [r.verdict, "warn"];
                    return (
                      <li key={r.id} style={{ "--i": i } as CSSProperties}>
                        <button type="button" role="radio" aria-checked={picked === r.id} className={`qr-match qr-match--${vTone}`} onClick={() => setPicked(r.id)}>
                          <span className="qr-match__rank">{r.rank}</span>
                          <span className="qr-match__body">
                            <span className="qr-match__head">
                              <strong>{r.equipment.name}</strong>
                              <span className={`qr-verdict qr-verdict--${vTone}`}>{vLabel}</span>
                              {r.usedMockData && <span className="qr-demo" title="시연용 사양이 포함된 비교입니다">DEMO</span>}
                            </span>
                            <small>{r.equipment.institutionName}{r.equipment.region ? ` · ${r.equipment.region}` : ""}{r.equipment.feeText ? ` · ${r.equipment.feeText}` : ""}</small>
                            <span className="qr-checks">
                              {r.checks.map((c) => {
                                const [label, tone] = RESULT[c.result] ?? [c.result, "warn"];
                                return (
                                  <span key={c.conditionKey} className={`qr-check qr-check--${tone}`} title={`요구 ${c.requiredText ?? "미정"} / 장비 ${c.equipmentText ?? "정보 없음"}`}>
                                    {tone === "ok" ? <CircleCheck size={12} aria-hidden="true" /> : tone === "bad" ? <CircleAlert size={12} aria-hidden="true" /> : <CircleHelp size={12} aria-hidden="true" />}
                                    {c.label ?? rules.find((x) => x.conditionKey === c.conditionKey)?.label ?? c.conditionKey}
                                    <em>{c.requiredText === "미정" ? label : `${c.requiredText} → ${c.equipmentText}`}</em>
                                  </span>
                                );
                              })}
                            </span>
                            <small className="qr-match__reason">{r.reason}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="sim-empty">조건에 맞는 장비를 찾지 못했어요. 조건을 바꾸거나 시험장비 검색에서 찾아보세요.</p>}
              <p className="qr-disclaimer">{run.disclaimer}</p>
              <footer className="sim-card__actions">
                <Button variant="secondary" onClick={() => setStep(0)}>이전</Button>
                <Button icon={ArrowRight} disabled={!chosen} onClick={() => setStep(2)}>이 장비로 의뢰서 쓰기</Button>
              </footer>
            </section>
          ) : (
            <section key="s2" className="sim-card qr-card" aria-labelledby="qr-write-title">
              <header className="sim-card__head">
                <span className="sim-card__num">3</span>
                <div>
                  <h2 id="qr-write-title">의뢰서 쓰기</h2>
                  <p>조건과 장비는 자동으로 들어가요. 희망 기간과 담당자만 적으면 제출할 수 있어요.</p>
                </div>
              </header>
              {draft?.notes?.length ? <ul className="qr-ainotes">{draft.notes.map((n) => <li key={n}><Sparkles size={12} aria-hidden="true" />{n}</li>)}</ul> : null}
              <div className="qr-form">
                <fieldset>
                  <legend>시험·시료</legend>
                  <label className="qr-input qr-input--wide"><span>시험 목적</span><input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="예: 발사 환경 진동 내구성 확인" /></label>
                  <label className="qr-input"><span>시료 이름</span><input value={form.sampleName} onChange={(e) => setForm({ ...form, sampleName: e.target.value })} placeholder="예: 위성 탑재 전장품" /></label>
                  <label className="qr-input qr-input--sm"><span>수량</span><input inputMode="numeric" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
                  <label className="qr-input qr-input--sm"><span>시료 준비일</span><input type="date" value={form.readyDate} onChange={(e) => setForm({ ...form, readyDate: e.target.value })} /></label>
                </fieldset>
                <fieldset>
                  <legend>이용 희망 기간 <i>*</i></legend>
                  <label className="qr-input"><span>시작일</span><input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
                  <label className="qr-input"><span>종료일</span><input type="date" value={form.end} min={form.start || undefined} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
                </fieldset>
                <fieldset>
                  <legend>담당자 <i>*</i><small>연락처는 전화번호나 이메일</small></legend>
                  <label className="qr-input"><span>실사용자 이름</span><input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} /></label>
                  <label className="qr-input"><span>실사용자 연락처</span><input value={form.userContact} onChange={(e) => setForm({ ...form, userContact: e.target.value })} /></label>
                  <label className="qr-input"><span>회계 담당자 이름</span><input value={form.accName} onChange={(e) => setForm({ ...form, accName: e.target.value })} /></label>
                  <label className="qr-input"><span>회계 담당자 연락처</span><input value={form.accContact} onChange={(e) => setForm({ ...form, accContact: e.target.value })} placeholder="02-000-0000 또는 이메일" /></label>
                </fieldset>
                <label className="qr-input qr-input--wide"><span>메모 (선택)</span><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="시험기관에 전할 내용" /></label>
              </div>
              {formError && <p className="sim-error" role="alert">{formError}</p>}
              {writer.error && <ApiState error={writer.error} />}
              <footer className="sim-card__actions qr-write-actions">
                <Button variant="secondary" onClick={() => setStep(1)}>이전</Button>
                <span className="qr-write-actions__count">제출 필수 <b>{formDone}/{reqFields.length}</b></span>
                <Button variant="secondary" disabled={writer.busy} onClick={() => write(false)}>임시 저장</Button>
                <Button icon={Send} disabled={writer.busy} onClick={() => write(true)}>{writer.busy ? "처리 중…" : "제출하기"}</Button>
              </footer>
            </section>
          )}
        </div>

        {/* 오른쪽: 지금까지 정한 것 */}
        <aside className="qr-summary" aria-label="지금까지 정한 것">
          <h2>지금까지 정한 것</h2>
          <dl>
            <div><dt>시험</dt><dd>{typeName ?? <span className="is-empty">아직 정하지 않음</span>}</dd></div>
            <div><dt>조건</dt><dd>{rules.some((r) => filled(r, values[r.conditionKey]))
              ? <ul>{rules.filter((r) => filled(r, values[r.conditionKey])).map((r) => <li key={r.conditionKey}>{r.label} <b>{showValue(r, values[r.conditionKey])}</b></li>)}</ul>
              : <span className="is-empty">아직 없음</span>}</dd></div>
            <div><dt>장비</dt><dd>{chosen ? <>{chosen.equipment.name}<small>{chosen.equipment.institutionName}</small></> : <span className="is-empty">아직 고르지 않음</span>}</dd></div>
            <div><dt>예상</dt><dd>{chosen?.equipment.feeText ? <>{chosen.equipment.feeText}<small>장비 이용료 기준 · 최종 금액은 기관이 안내</small></>
              : estimate.cost != null ? <>{won(estimate.cost)}부터{estimate.days != null && <small>최소 {estimate.days}일</small>}</>
              : <span className="is-empty">{typeCode ? "기관 협의" : "—"}</span>}</dd></div>
          </dl>
          <div className="qr-todo"><strong>다음 할 일</strong><p>{nextTodo}</p></div>
          <div className="qr-tips">
            <strong><ClipboardList size={14} aria-hidden="true" />미리 알아 두면 좋아요</strong>
            <ul>
              <li>시료 크기와 무게</li>
              <li>{(typeCode && TIPS[typeCode]) ?? "시료를 고정하는 방법(지그·고정구)"}</li>
              <li>공인성적서가 필요한지</li>
              <li>원하는 시험 날짜</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

