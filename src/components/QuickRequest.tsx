import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import {
  ArrowRight, Check, CircleAlert, CircleCheck, CircleHelp, ClipboardList, FileText, Info, Paperclip, RotateCcw, Send, Sparkles, Upload, X,
} from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { catalogService } from "../services/catalogService";
import type { SearchResult } from "../services/catalogService";
import type { RequirementAnalysis } from "../services/requirementService";
import { requirementService } from "../services/requirementService";
import { requestService } from "../services/requestService";
import type { ConditionRule, MatchRun, RequirementCondition } from "../services/contracts";
import { takeQuickPrefill } from "../domain/quickPrefill";
import { Button, PageHeader } from "./ui";
import ApiState from "./ui/ApiState";

/**
 * AI 간편 의뢰 (v16)
 * 가상 시뮬레이션처럼 위쪽 진행 막대 + 한 번에 한 카드: ① 조건 정하기 → ② 장비 고르기 → ③ 의뢰서 쓰기
 * - ① 문장을 쓰거나 파일을 끌어다 놓으면 GET /search 가 시험유형·조건·지역을 해석해 칸을 채움. 칸은 GET /test-types/{code} 의 conditionRules 로 만듦
 *     글 파일(txt·csv·md·json·tsv)은 내용을 함께 읽고, 명세 §5 첨부 허용 파일은 ③에서 의뢰서 첨부로 올림
 * - ② POST /requirements → POST /requirements/{id}/match-runs 결과(조건별 충족 여부)로 장비 비교·선택
 * - ③ POST /test-requests/ai-draft 로 초안을 만들고 PUT .../draft 로 기간·담당자를 채운 뒤 POST .../attachments → POST .../submit
 * 오른쪽 '지금까지 정한 것'은 단계와 상관없이 항상 보입니다.
 */

type Values = Record<string, { value?: string; min?: string; max?: string; valueText?: string; ai?: boolean }>;
type Form = {
  purpose: string; sampleName: string; quantity: string; readyDate: string; start: string; end: string;
  userName: string; userContact: string; accName: string; accContact: string; notes: string;
};
/** 넣은 파일. file 은 이 화면에서 직접 넣은 경우에만 있음(대시보드에서 넘어온 파일은 이름·글 내용만) */
interface QrFile { name: string; size: number; text?: string; file?: File; uploaded?: boolean }

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
/** AI가 내용을 읽는 글 파일 */
const READABLE = /\.(txt|csv|md|json|tsv)$/i;
const READ_MAX = 200_000;
/** 명세 §5 첨부 허용: pdf·이미지·xlsx/xls/csv·docx/doc·hwp/hwpx·pptx·txt·zip, 파일당 20MB */
const ATTACHABLE = /\.(pdf|png|jpe?g|gif|webp|bmp|xlsx|xls|csv|docx|doc|hwp|hwpx|pptx|txt|zip)$/i;
const ATTACH_MAX = 20 * 1024 * 1024;
const ACCEPT = ".txt,.csv,.md,.json,.tsv,.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.xlsx,.xls,.docx,.doc,.hwp,.hwpx,.pptx,.zip";
const MAX_FILES = 5;
const canRead = (f: { name: string; size: number }) => READABLE.test(f.name) && f.size <= READ_MAX;
const canAttach = (f: { name: string; size: number }) => ATTACHABLE.test(f.name) && f.size <= ATTACH_MAX;
const size = (n: number) => (n < 1024 ? `${n}B` : n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);
/** 제출 400 missingItems 경로 → 화면 이름 */
const MISSING: Record<string, string> = {
  "schedule.desiredStartDate": "희망 시작일", "schedule.desiredEndDate": "희망 종료일",
  "actualUser.name": "실사용자 이름", "actualUser.contact": "실사용자 연락처",
  "accounting.name": "회계 담당자 이름", "accounting.contact": "회계 담당자 연락처",
};

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

/** 파일 한 개 칩 — AI가 읽었는지, 의뢰서에 첨부되는지 */
function FileChip({ f, onRemove }: { f: QrFile; onRemove?: () => void }) {
  const read = !!f.text;
  const attach = !!f.file && canAttach(f);
  return (
    <li className="qr-file">
      <FileText size={14} aria-hidden="true" />
      <span className="qr-file__name" title={f.name}>{f.name}</span>
      <small className="qr-file__size">{size(f.size)}</small>
      {read && <span className="qr-file__tag is-ai">AI가 읽음</span>}
      {attach && <span className={`qr-file__tag${f.uploaded ? " is-done" : ""}`}>{f.uploaded ? "첨부됨" : "첨부"}</span>}
      {!read && !attach && <span className="qr-file__tag is-muted" title="대시보드에서 넘어온 파일은 이 칸에 다시 넣어야 의뢰서에 첨부돼요">이름만</span>}
      {onRemove && !f.uploaded && (
        <button type="button" className="qr-file__remove" aria-label={`${f.name} 빼기`} onClick={onRemove}><X size={12} /></button>
      )}
    </li>
  );
}

/** 검색창 아래 파일 끌어다 놓기 칸 (눌러서 고를 수도 있음) */
function DropZone({ count, busy, onAdd }: { count: number; busy: boolean; onAdd: (list: FileList | null) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const full = count >= MAX_FILES;
  // 칸 밖에 파일을 잘못 떨어뜨려도 브라우저가 파일을 열면서 작성 중인 내용이 사라지지 않게
  useEffect(() => {
    const stop = (e: globalThis.DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => { window.removeEventListener("dragover", stop); window.removeEventListener("drop", stop); };
  }, []);
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  return (
    <>
      <button
        type="button"
        className={`qr-drop${over ? " is-over" : ""}`}
        disabled={full}
        onClick={() => picker.current?.click()}
        onDragEnter={(e) => { if (!hasFiles(e) || full) return; e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { if (!hasFiles(e) || full) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!full) onAdd(e.dataTransfer.files); }}
      >
        <span className="qr-drop__icon" aria-hidden="true"><Upload size={18} /></span>
        <span className="qr-drop__text">
          <strong>{full ? `파일은 최대 ${MAX_FILES}개까지 넣을 수 있어요` : over ? "여기에 놓으면 추가돼요" : <>규격서·요구서 파일을 끌어다 놓거나 <u>눌러서 고르세요</u></>}</strong>
          <small>txt·csv·md·json은 AI가 내용을 읽어 조건을 채우고, PDF·한글·워드·엑셀·이미지는 의뢰서에 첨부돼요 · 최대 {MAX_FILES}개, 파일당 20MB</small>
        </span>
        {busy && <span className="qr-drop__busy">읽는 중…</span>}
      </button>
      <input ref={picker} type="file" hidden multiple accept={ACCEPT} onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
    </>
  );
}

export default function QuickRequest({ setActiveMenu }: { setActiveMenu: (menu: string) => void }) {
  const { user } = useWorkspace();
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<QrFile[]>([]);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const fileText = files.map((f) => f.text ?? "").filter(Boolean).join("\n");
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({});
  const [read, setRead] = useState<{ found: string[]; regions: string[]; interpreter?: string; noType?: boolean } | null>(null);
  const [showInstitutions, setShowInstitutions] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requirement, setRequirement] = useState<{ id: number; key: string; type: string } | null>(null);
  const [run, setRun] = useState<MatchRun | null>(null);
  // 매칭 전에 빠진 조건 안내 (POST /requirements/{id}/analyze). 사용자가 '그래도 찾기'를 누르면 그대로 매칭
  const [gap, setGap] = useState<{ key: string; missing: RequirementAnalysis["missing"]; unconfirmed: RequirementAnalysis["unconfirmed"] } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [form, setForm] = useState<Form>({
    purpose: "", sampleName: "", quantity: "1", readyDate: "", start: "", end: "",
    userName: user.name ?? "", userContact: user.phone || user.email || "", accName: "", accContact: "", notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  /** 의뢰서 칸 고치기 — 고치기 시작하면 안내를 지움 */
  const editForm = (patch: Partial<Form>) => { setForm((f) => ({ ...f, ...patch })); setFormError(null); };
  const [draft, setDraft] = useState<{ id: number; no?: string; notes?: string[] } | null>(null);
  const [done, setDone] = useState<{ submitted: boolean; no?: string; attached: number } | null>(null);
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
  const attachments = files.filter((f) => f.file && canAttach(f));
  const aiPickedType = read && !read.noType ? typeCode : null;

  /** 문장(+글 파일 내용) → GET /search 해석 → 시험 종류·조건 칸 채우기 */
  const fillByAi = (sentence = text, extra = fileText) => {
    const q = [sentence.trim(), extra.trim()].filter(Boolean).join("\n");
    if (!q) { setFieldError("시험하고 싶은 내용을 한두 문장으로 적거나 글 파일을 넣어 주세요."); return; }
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
      if (!form.purpose && sentence.trim()) setForm((f) => ({ ...f, purpose: sentence.trim().slice(0, 120) }));
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
      setFiles(prefill.files.slice(0, MAX_FILES));
      if (prefill.text || extra) fillByAi(prefill.text, extra);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 끌어다 놓거나 골라 넣은 파일.
   * 글 파일은 내용을 읽고, 첨부 허용 파일은 ③에서 올립니다. 시험 종류를 아직 못 정했고 읽은 글이 있으면 바로 AI로 해석합니다.
   */
  const addFiles = async (list: FileList | null) => {
    const all = [...(list ?? [])];
    if (!all.length) return;
    const usable = all.filter((f) => canRead(f) || canAttach(f));
    const fresh = usable.filter((f) => !files.some((x) => x.name === f.name));
    const room = Math.max(0, MAX_FILES - files.length);
    const picked = fresh.slice(0, room);
    const notes: string[] = [];
    if (usable.length < all.length) notes.push(`넣을 수 없는 파일 ${all.length - usable.length}개는 뺐어요. (허용: txt·csv·md·json·PDF·한글·워드·엑셀·파워포인트·이미지·zip, 파일당 20MB)`);
    if (fresh.length < usable.length) notes.push("이미 넣은 파일은 다시 넣지 않았어요.");
    if (fresh.length > room) notes.push(`파일은 최대 ${MAX_FILES}개까지 넣을 수 있어요.`);
    setFileNote(notes.join(" ") || null);
    if (!picked.length) return;
    const added: QrFile[] = await Promise.all(picked.map(async (f) => ({
      name: f.name, size: f.size, file: f, text: canRead(f) ? (await f.text()).slice(0, 4000) : undefined,
    })));
    const next = [...files, ...added].slice(0, MAX_FILES);
    setFiles(next);
    if (!typeCode && !ai.busy && added.some((f) => f.text)) fillByAi(text, next.map((f) => f.text ?? "").filter(Boolean).join("\n"));
  };
  const removeFile = (name: string) => { setFiles((list) => list.filter((f) => f.name !== name)); setFileNote(null); };

  const setValue = (key: string, patch: Partial<Values[string]>) => {
    setValues((v) => ({ ...v, [key]: { ...v[key], ...patch, ai: false } }));
    setFieldError(null); setRun(null); setPicked(null);
  };
  const pickType = (code: string) => {
    if (code === typeCode) return;
    setTypeCode(code); setValues({}); setRead(null); setRequirement(null); setRun(null); setPicked(null); setShowInstitutions(false);
  };
  const resetAll = () => {
    setText(""); setFiles([]); setFileNote(null); setTypeCode(null); setValues({}); setRead(null); setRequirement(null); setRun(null);
    setPicked(null); setDraft(null); setDone(null); setStep(0); setFieldError(null); setFormError(null);
  };

  const conditions = (): RequirementCondition[] => rules.filter((r) => filled(r, values[r.conditionKey])).map((r) => {
    const v = values[r.conditionKey];
    const base = { key: r.conditionKey, label: r.label, unit: r.unit ?? null, status: "CONFIRMED", source: v.ai ? "AI_EXTRACTED" : "USER" };
    return r.valueType === "RANGE" ? { ...base, min: Number(v.min), max: Number(v.max) }
      : r.valueType === "NUMBER" ? { ...base, value: Number(v.value) } : { ...base, valueText: v.valueText?.trim() };
  });

  /** ① → ② : 시험조건 저장 후 매칭 실행 */
  const findEquipment = (force = false) => {
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
      setRequirement({ id, key: "", type: typeCode });
      // 매칭 전에 빠진 필수 조건부터 안내한다. 비워 둔 채 매칭하면 모든 장비가 '확인 필요'로만 나오기 때문
      if (!force) {
        const analysis = await requirementService.analyze(id, signal);
        if (!analysis.readyForMatching && (analysis.missing.length || analysis.unconfirmed.length)) {
          setGap({ key, missing: analysis.missing, unconfirmed: analysis.unconfirmed });
          return;
        }
      }
      setGap(null);
      const result = await requirementService.match(id, { limit: 5, ...(read?.regions?.[0] ? { region: read.regions[0] } : {}) }, signal);
      setRequirement({ id, key, type: typeCode }); setRun(result);
      const first = result.results.find((r) => r.verdict !== "UNSUITABLE") ?? result.results[0];
      setPicked(first?.id ?? null); setStep(1);
    });
  };

  const reqFields: [keyof Form, string][] = [["start", "희망 시작일"], ["end", "희망 종료일"], ["userName", "실사용자 이름"], ["userContact", "실사용자 연락처"], ["accName", "회계 담당자 이름"], ["accContact", "회계 담당자 연락처"]];
  const formDone = reqFields.filter(([k]) => form[k].trim()).length;

  /** ③ 저장/제출: AI 초안(한 번만) → 내용 채워 저장 → 첨부 올리기(아직 안 올린 것만) → (제출) */
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
      // 명세 §5: 공인성적서 필요 여부는 serviceRequirements.accreditedRequired(boolean/null)로도 맞춰 둠
      const accredited = values.accredited_required?.valueText;
      const content = {
        ...base,
        actualUser: { name: form.userName.trim(), ...contact(form.userContact) },
        accounting: { name: form.accName.trim(), ...contact(form.accContact) },
        test: { ...(base.test as object), testTypeCode: typeCode, purpose: form.purpose.trim() },
        sample: { ...(base.sample as object), name: form.sampleName.trim(), quantity: Number(form.quantity) || 1, readyDate: form.readyDate || null },
        conditions: conditions(),
        schedule: { desiredStartDate: form.start || null, desiredEndDate: form.end || null },
        serviceRequirements: {
          ...(base.serviceRequirements as object),
          accreditedRequired: accredited === "필요" ? true : accredited === "불필요" ? false : null,
        },
        notes: form.notes.trim(),
      };
      const saved = await requestService.save(id, current.version, content, signal);
      let attached = 0;
      for (const f of files) {
        if (!f.file || !canAttach(f) || f.uploaded) continue;
        await requestService.attach(id, f.file, "GENERAL", signal);
        attached += 1;
        setFiles((list) => list.map((x) => (x.name === f.name ? { ...x, uploaded: true } : x)));
      }
      if (submit) await requestService.submit(id, saved.version ?? current.version + 1, signal);
      setDone({ submitted: submit, no: no ?? current.requestNo, attached: attached + files.filter((f) => f.uploaded).length });
    });
  };
  const missing = writer.error?.details?.missingItems?.map((k) => MISSING[k] ?? k);

  // 단계가 바뀌면 진행 막대가 보이도록 (아래로 스크롤한 채 다음 단계로 넘어가는 경우)
  const top = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);
  useEffect(() => {
    if (firstPaint.current) { firstPaint.current = false; return; }
    top.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [step, done]);

  const goStep = (to: number) => {
    if (to === 1 && !run) return;
    if (to === 2 && !chosen) return;
    setStep(to);
  };
  const nextTodo = done ? (done.submitted ? "시험기관이 검토를 시작하면 알림으로 알려 드려요." : "시험 의뢰 관리에서 이어서 쓰고 제출하세요.")
    : step === 0 ? (typeCode ? "조건을 넣고 '맞는 장비 찾기'를 누르세요." : "하고 싶은 시험을 문장으로 적거나 규격서 파일을 넣어 주세요.")
    : step === 1 ? "조건 충족 여부를 비교해 장비를 하나 고르세요." : "희망 기간과 담당자를 적고 제출하세요.";

  return (
    <div className="content-page page-enter quick-request-page">
      <PageHeader title="AI 간편 의뢰" />
      <div className="qr-layout">
        <div className="qr-main" ref={top}>
          {/* 위쪽 진행 막대 (가상 시뮬레이션과 같은 모양) */}
          <ol className="qr-progress" aria-label="진행 단계">
            {STEPS.map((s, i) => {
              const state = done || i < step ? "is-done" : i === step ? "is-current" : "";
              const sub = i === 0 ? (typeName ?? s.hint) : i === 1 ? (chosen?.equipment.name ?? s.hint) : s.hint;
              return (
                <li key={s.title} className={state || undefined} aria-current={i === step && !done ? "step" : undefined}>
                  <button type="button" disabled={!!done || (i === 1 && !run) || (i === 2 && !chosen)} onClick={() => goStep(i)}>
                    <span className="qr-progress__label">
                      <span className="qr-progress__num">{state === "is-done" ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>
                      {s.title}
                    </span>
                    <small>{sub}</small>
                  </button>
                </li>
              );
            })}
          </ol>

          {done ? (
            <section className="sim-card qr-done" aria-live="polite">
              <span className={`qr-done__icon${done.submitted ? "" : " is-saved"}`}>{done.submitted ? <Send size={26} /> : <FileText size={26} />}</span>
              <h2>{done.submitted ? "의뢰서를 제출했어요" : "의뢰서를 임시 저장했어요"}</h2>
              <p>{done.no && <><b>{done.no}</b> · </>}{chosen?.equipment.name} · {chosen?.equipment.institutionName}</p>
              {done.attached > 0 && <p className="qr-done__sub"><Paperclip size={13} aria-hidden="true" /> 첨부 파일 {done.attached}개를 함께 올렸어요.</p>}
              <p className="qr-done__sub">{nextTodo}</p>
              <div className="qr-done__actions">
                <Button icon={ClipboardList} onClick={() => setActiveMenu("reservationCheck")}>시험 의뢰 관리에서 보기</Button>
                <Button variant="secondary" icon={RotateCcw} onClick={resetAll}>새 AI 간편 의뢰</Button>
              </div>
            </section>
          ) : step === 0 ? (
            <section key="s0" className="sim-card qr-card" aria-labelledby="qr-ai-title">
              <header className="sim-card__head">
                <span className="sim-card__num" aria-label="3단계 중 1단계">1</span>
                <div>
                  <h2 id="qr-ai-title">어떤 시험이 필요하세요?</h2>
                  <p>하고 싶은 시험을 문장으로 적거나 규격서 파일을 넣으면 AI가 시험 종류와 조건을 채워 드려요. 시험 종류를 직접 골라도 됩니다.</p>
                </div>
              </header>

              <div className="qr-block">
                <form className="qr-ask" onSubmit={(e) => { e.preventDefault(); fillByAi(); }}>
                  <Sparkles size={17} className="qr-ask__icon" aria-hidden="true" />
                  <label htmlFor="qr-text" className="sr-only">시험 설명</label>
                  <input id="qr-text" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder={`예: ${EXAMPLES[0]}`} />
                  <button type="submit" className="qr-ask__go" disabled={ai.busy}>{ai.busy ? "읽는 중…" : "AI로 채우기"}</button>
                </form>
                <DropZone count={files.length} busy={ai.busy && files.some((f) => f.text)} onAdd={(l) => void addFiles(l)} />
                {files.length > 0 && (
                  <ul className="qr-files" aria-label="넣은 파일">
                    {files.map((f) => <FileChip key={f.name} f={f} onRemove={() => removeFile(f.name)} />)}
                  </ul>
                )}
                {fileNote && <p className="qr-note"><CircleAlert size={13} aria-hidden="true" />{fileNote}</p>}
                {!text && !read && !files.length && (
                  <div className="qr-examples" aria-label="예시 문장">
                    <span>이렇게 적어 보세요</span>
                    {EXAMPLES.map((e) => <button type="button" key={e} onClick={() => { setText(e); fillByAi(e, ""); }}>{e}</button>)}
                  </div>
                )}
                {ai.error && <ApiState error={ai.error} />}
                {read && !ai.busy && (
                  <p className={`qr-read${read.noType ? " is-warn" : ""}`} role="status">
                    {read.noType ? <><CircleAlert size={14} aria-hidden="true" />시험 종류를 알아내지 못했어요. 아래에서 직접 골라 주세요.</>
                      : <><CircleCheck size={14} aria-hidden="true" />{read.found.length ? `${read.found.join(", ")}${josa(read.found[read.found.length - 1])} 읽었어요.` : "시험 종류를 찾았어요. 조건은 직접 넣어 주세요."}{read.regions.length ? ` 지역 ${read.regions.join("·")} 기준으로 장비를 찾을게요.` : ""}</>}
                  </p>
                )}
              </div>

              <div className="qr-divider"><span>정리된 조건</span></div>

              <div className="qr-block">
                <div className="qr-sub">
                  <h3>시험 종류</h3>
                  <small>등록된 장비가 있는 시험만 보여요</small>
                  {(typeCode || text || files.length > 0) && <button type="button" className="qr-reset" onClick={resetAll}><RotateCcw size={14} aria-hidden="true" />다시 쓰기</button>}
                </div>
                {types.loading ? <ApiState loading /> : types.error ? <ApiState error={types.error} onRetry={types.reload} /> : (
                  <div className="qr-types" role="radiogroup" aria-label="시험 종류">
                    {available.map((t) => {
                      const on = t.code === typeCode;
                      return (
                        <button type="button" role="radio" key={t.code} aria-checked={on} onClick={() => pickType(t.code)} title={t.description ?? undefined}>
                          <span className="qr-type__name">{t.nameKo}</span>
                          <small>{t.code === aiPickedType ? <b>AI 추천</b> : null}장비 {t.equipmentCount}대</small>
                          {on && <span className="qr-type__check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {typeCode && (detail.loading ? <ApiState loading /> : detail.error ? <ApiState error={detail.error} onRetry={detail.reload} /> : (
                <div className="qr-block">
                  <div className="qr-sub">
                    <h3>{typeName} 조건</h3>
                    <small>필수 {requiredDone}/{required.length} 입력 · 비워 둔 조건은 시험기관이 확인해요</small>
                  </div>
                  <div className="qr-info">
                    <Info size={15} aria-hidden="true" />
                    <span>시험기관 {institutions.length}곳, 장비 {detail.data?.equipmentCount ?? institutions.reduce((n, i) => n + i.equipmentCount, 0)}대
                      {estimate.cost != null && <>, 예상 비용 {won(estimate.cost)}부터</>}{estimate.days != null && <>, 최소 {estimate.days}일</>}</span>
                    <button type="button" className="text-link" aria-expanded={showInstitutions} onClick={() => setShowInstitutions((v) => !v)}>{showInstitutions ? "접기" : "기관 보기"}</button>
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
                        <div key={r.conditionKey} className={`qr-field${v.ai && filled(r, v) ? " is-ai" : ""}${r.valueType === "RANGE" ? " is-range" : ""}${gap?.missing.some((m) => m.key === r.conditionKey) && !filled(r, v) ? " is-missing" : ""}`}>
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
                </div>
              ))}
              {fieldError && <p className="sim-error" role="alert">{fieldError}</p>}
              {gap && (
                <div className="qr-gap" role="alert">
                  <strong>장비를 찾기 전에 이 조건을 채워 주세요</strong>
                  <ul>
                    {gap.missing.map((m) => <li key={`m-${m.key ?? m.label}`}>{m.question ?? `${m.label}을(를) 알려 주세요.`}</li>)}
                    {gap.unconfirmed.map((u) => <li key={`u-${u.key ?? u.label}`} className="is-unconfirmed">{u.label}: {u.reason ?? "확인이 필요해요."}</li>)}
                  </ul>
                  <p>비워 둔 채로 찾으면 그 조건은 모든 장비에서 '확인 필요'로 나와요.</p>
                  <Button variant="secondary" disabled={finder.busy} onClick={() => findEquipment(true)}>그래도 장비 찾기</Button>
                </div>
              )}
              {finder.error && <ApiState error={finder.error} />}
              <footer className="sim-card__actions qr-foot">
                <span className="qr-foot__hint">{typeCode ? (required.length > requiredDone ? "필수 조건을 비워 두면 '기관 확인'으로 비교해요." : "조건이 준비됐어요.") : "시험 종류를 고르면 입력할 조건이 나타나요."}</span>
                <Button icon={ArrowRight} disabled={!typeCode || finder.busy || detail.loading} onClick={() => findEquipment()}>{finder.busy ? "찾는 중…" : "맞는 장비 찾기"}</Button>
              </footer>
            </section>
          ) : step === 1 && run ? (
            <section key="s1" className="sim-card qr-card" aria-labelledby="qr-match-title">
              <header className="sim-card__head">
                <span className="sim-card__num" aria-label="3단계 중 2단계">2</span>
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
                                  <span key={c.conditionKey} className={`qr-check qr-check--${tone}`}
                                    title={[`요구 ${c.requiredText ?? "미정"} / 장비 ${c.equipmentText ?? "정보 없음"}`, c.note].filter(Boolean).join("\n")}>
                                    {tone === "ok" ? <CircleCheck size={12} aria-hidden="true" /> : tone === "bad" ? <CircleAlert size={12} aria-hidden="true" /> : <CircleHelp size={12} aria-hidden="true" />}
                                    {c.label ?? rules.find((x) => x.conditionKey === c.conditionKey)?.label ?? c.conditionKey}
                                    <em>{c.requiredText === "미정" ? (c.resultText ?? label) : `${c.requiredText} → ${c.equipmentText}`}</em>
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
              <footer className="sim-card__actions qr-foot">
                <Button variant="secondary" onClick={() => setStep(0)}>이전</Button>
                <Button icon={ArrowRight} disabled={!chosen} onClick={() => setStep(2)}>이 장비로 의뢰서 쓰기</Button>
              </footer>
            </section>
          ) : (
            <section key="s2" className="sim-card qr-card" aria-labelledby="qr-write-title">
              <header className="sim-card__head">
                <span className="sim-card__num" aria-label="3단계 중 3단계">3</span>
                <div>
                  <h2 id="qr-write-title">의뢰서 쓰기</h2>
                  <p>조건과 장비는 자동으로 들어가요. 희망 기간과 담당자만 적으면 제출할 수 있어요.</p>
                </div>
              </header>
              {draft?.notes?.length ? <ul className="qr-ainotes">{draft.notes.map((n) => <li key={n}><Sparkles size={12} aria-hidden="true" />{n}</li>)}</ul> : null}
              <div className="qr-form">
                <fieldset>
                  <legend>시험·시료</legend>
                  <label className="qr-input qr-input--wide"><span>시험 목적</span><input value={form.purpose} onChange={(e) => editForm({ purpose: e.target.value })} placeholder="예: 발사 환경 진동 내구성 확인" /></label>
                  <label className="qr-input"><span>시료 이름</span><input value={form.sampleName} onChange={(e) => editForm({ sampleName: e.target.value })} placeholder="예: 위성 탑재 전장품" /></label>
                  <label className="qr-input qr-input--sm"><span>수량</span><input inputMode="numeric" value={form.quantity} onChange={(e) => editForm({ quantity: e.target.value })} /></label>
                  <label className="qr-input qr-input--sm"><span>시료 준비일</span><input type="date" value={form.readyDate} onChange={(e) => editForm({ readyDate: e.target.value })} /></label>
                </fieldset>
                <fieldset>
                  <legend>이용 희망 기간 <i>*</i></legend>
                  <label className="qr-input"><span>시작일</span><input type="date" value={form.start} onChange={(e) => editForm({ start: e.target.value })} /></label>
                  <label className="qr-input"><span>종료일</span><input type="date" value={form.end} min={form.start || undefined} onChange={(e) => editForm({ end: e.target.value })} /></label>
                </fieldset>
                <fieldset>
                  <legend>담당자 <i>*</i><small>연락처는 전화번호나 이메일</small></legend>
                  <label className="qr-input"><span>실사용자 이름</span><input value={form.userName} onChange={(e) => editForm({ userName: e.target.value })} /></label>
                  <label className="qr-input"><span>실사용자 연락처</span><input value={form.userContact} onChange={(e) => editForm({ userContact: e.target.value })} /></label>
                  <label className="qr-input"><span>회계 담당자 이름</span><input value={form.accName} onChange={(e) => editForm({ accName: e.target.value })} /></label>
                  <label className="qr-input"><span>회계 담당자 연락처</span><input value={form.accContact} onChange={(e) => editForm({ accContact: e.target.value })} placeholder="02-000-0000 또는 이메일" /></label>
                </fieldset>
                <fieldset>
                  <legend>첨부 파일<small>{attachments.length ? "저장하거나 제출할 때 함께 올라가요" : "1단계 파일 칸에 PDF·한글·워드 등을 넣으면 여기에 첨부돼요"}</small></legend>
                  {attachments.length > 0 ? (
                    <ul className="qr-files qr-input--wide">{attachments.map((f) => <FileChip key={f.name} f={f} onRemove={() => removeFile(f.name)} />)}</ul>
                  ) : <p className="qr-input--wide qr-empty">첨부할 파일이 없어요.</p>}
                </fieldset>
                <label className="qr-input qr-input--wide"><span>메모 (선택)</span><textarea rows={2} value={form.notes} onChange={(e) => editForm({ notes: e.target.value })} placeholder="시험기관에 전할 내용" /></label>
              </div>
              {formError && <p className="sim-error" role="alert">{formError}</p>}
              {missing?.length ? <p className="sim-error" role="alert">제출에 꼭 필요한 항목이 빠졌어요: {missing.join(", ")}</p>
                : writer.error && <ApiState error={writer.error} />}
              <footer className="sim-card__actions qr-foot qr-write-actions">
                <Button variant="secondary" onClick={() => setStep(1)}>이전</Button>
                <span className="qr-write-actions__count">제출 필수 <b>{formDone}/{reqFields.length}</b></span>
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
            {files.length > 0 && <div><dt>파일</dt><dd>{files.length}개<small>AI가 읽음 {files.filter((f) => f.text).length} · 첨부 {attachments.length}</small></dd></div>}
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
