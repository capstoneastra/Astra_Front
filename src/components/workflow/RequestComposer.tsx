import { useRef, useState } from "react";
import { ArrowRight, Check, FileCheck2, Pencil, Sparkles } from "lucide-react";
import { useWorkspace } from "../../context/AppContext";
import { Badge, Button, FormField, PageHeader, Panel } from "../ui";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useAction } from "../../hooks/useAction";
import { requestService } from "../../services/requestService";
import { chatService } from "../../services/chatService";
import { catalogService } from "../../services/catalogService";
import type { RequestContent } from "../../services/contracts";
import { apiConfig } from "../../api/config";
import { changeContent, composerGroups, contentValue, fieldId, hydrateRequest, missingRequestFields } from "../../domain/requestComposer";
import ConditionEditor from "./ConditionEditor";
import { Feedback } from "./Feedback";
import ApiState from "../ui/ApiState";
import RequestSteps from "./RequestSteps";

export default function RequestComposer({ setActiveMenu }) {
  const { user, testCondition, setTestCondition, selectedEquipment, setSelectedEquipment,
    equipmentList, requirementId, setRequirementId, chatSessionId, setChatSessionId,
    draftRequestId, setDraftRequestId } = useWorkspace();
  const action = useAction();
  const [brief, setBrief] = useState("");
  const [stage, setStage] = useState("");
  const [allFields, setAllFields] = useState(false);
  const [touchedPaths, setTouchedPaths] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState(false);
  const [edited, setEdited] = useState<{ id: number; content: RequestContent } | null>(null);
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const progress = useRef<{ text?: string; sessionId?: number; sent?: boolean; requirementId?: number }>({});
  const savedVersion = useRef<{ id: number; version: number } | null>(null);
  const query = useApiQuery(signal => requestService.get(draftRequestId, signal), `request:${draftRequestId}`, Boolean(draftRequestId));
  const draft = query.data;
  const content = draft ? edited?.id === draft.id ? edited.content : hydrateRequest(draft.revision.content, user, testCondition) : null;
  const rules = useApiQuery(signal => catalogService.testType(content.test.testTypeCode, signal), `test-type:${content?.test.testTypeCode}`, Boolean(content?.test.testTypeCode));
  const missing = content ? missingRequestFields(content) : [];
  const missingPaths = new Set(missing.map(f => f.path));
  const unknownConditions = content?.conditions.filter(c => c.status !== "CONFIRMED").length ?? 0;
  const canEdit = draft?.status === "DRAFT" && !action.busy;
  const options = (selectedEquipment && !equipmentList.some(e => e.id === selectedEquipment.id) ? [selectedEquipment, ...equipmentList] : equipmentList).filter(e => e.institutionId !== user.organization?.id);
  const update = (next: RequestContent) => { setEdited({ id: draft.id, content: next }); setReviewed(false); action.clearFeedback(); };
  const focusField = (path: string) => {
    const input = document.getElementById(fieldId(path));
    input?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    input?.focus({ preventScroll: true });
  };
  const generate = (useAi: boolean) => action.run(async signal => {
    let conditionId = requirementId;
    if (useAi && brief.trim()) {
      const text = brief.trim();
      if (progress.current.text !== text) progress.current = { text };
      const p = progress.current;
      setStage("상담 내용 정리 중");
      // Keep successful stages on retry; never send the same description twice.
      if (!p.sessionId) {
        p.sessionId = (await chatService.create("의뢰서 자동 작성", signal)).id;
        setChatSessionId(p.sessionId);
      }
      if (!p.sent) { await chatService.send(p.sessionId, text, signal); p.sent = true; }
      if (!p.requirementId) { p.requirementId = (await chatService.requirement(p.sessionId, signal)).id; }
      conditionId = p.requirementId;
      setRequirementId(conditionId);
      setTestCondition(text);
    } else if (useAi && !conditionId && chatSessionId) {
      setStage("기존 상담 조건 가져오는 중");
      conditionId = (await chatService.requirement(chatSessionId, signal)).id;
      setRequirementId(conditionId);
    }
    setStage(useAi ? "의뢰서 자동 작성 중" : "장비·신청자 정보 가져오는 중");
    const body = { equipmentId: selectedEquipment.id, ...(conditionId ? { requirementId: conditionId } : {}) };
    const result = useAi ? await requestService.aiDraft(body, signal) : await requestService.create(body, signal);
    setAiNotes(result.aiNotes ?? []);
    setDraftRequestId(result.requestId ?? result.id);
    setReviewed(false);
  });
  const submit = () => {
    if (!content || !draft || !reviewed || action.busy) return;
    if (missing.length) { focusField(missing[0].path); return; }
    action.run(async signal => {
      const version = savedVersion.current?.id === draft.id ? savedVersion.current.version : draft.version;
      const saved = await requestService.save(draft.id, version, content, signal);
      // Submit can fail after saving. Preserve the new version for a safe retry.
      savedVersion.current = { id: draft.id, version: saved.version };
      await requestService.submit(draft.id, saved.version, signal);
      setDraftRequestId(null); setSelectedEquipment(null); setTestCondition("");
      setActiveMenu("reservationCheck");
    });
  };
  return <div className="content-page page-enter request-composer">
    <PageHeader eyebrow={null} title="시험 의뢰하기">
      <Badge tone="cyan">{draft ? "내용 확인·제출" : "장비 선택·자동 작성"}</Badge>
      {apiConfig.isMock && <Badge tone="amber">DEMO</Badge>}
    </PageHeader>
    <RequestSteps current={!draft ? 0 : action.busy && reviewed ? 3 : missing.length ? 1 : 2} />
    {!draftRequestId && <Panel className="form-panel request-start">
      <div className="request-composer__intro"><span><Sparkles size={23} /></span><div><h2>설명은 한 번, 의뢰서는 자동으로.</h2><p>상담 내용과 계정 정보를 가져옵니다. 빠진 내용만 채우고 수정하세요.</p></div></div>
      <FormField id="request-equipment" label="의뢰할 시험장비">
        <select id="request-equipment" value={selectedEquipment?.id ?? ""} disabled={action.busy} onChange={e => setSelectedEquipment(options.find(item => item.id === Number(e.target.value)) ?? null)}>
          <option value="">장비 선택</option>{options.map(e => <option key={e.id} value={e.id}>{e.name} · {e.institution}</option>)}
        </select>
      </FormField>
      {selectedEquipment && <p className="field-hint">수행기관 · {selectedEquipment.institution}</p>}
      <FormField id="request-brief" label={requirementId || chatSessionId ? "이미 상담한 내용이 있어요. 바로 가져오거나 새 내용을 적어주세요." : "어떤 시험이 필요한가요?"}>
        <textarea id="request-brief" rows={3} value={brief} maxLength={10000} disabled={action.busy}
          onChange={e => setBrief(e.target.value)} placeholder="시료와 시험 목적, 알고 있는 조건을 편하게 적어주세요." />
      </FormField>
      <div className="form-actions">
        <Button icon={Sparkles} disabled={!selectedEquipment || action.busy || (!brief.trim() && !requirementId && !chatSessionId)} onClick={() => generate(true)}>
          {action.busy ? stage : requirementId || chatSessionId ? "상담 내용으로 자동 채우기" : "설명으로 의뢰서 채우기"}
        </Button>
        <Button variant="secondary" disabled={!selectedEquipment || action.busy} onClick={() => generate(false)}>직접 작성</Button>
      </div>
      <p className="field-hint">{apiConfig.isMock ? "DEMO · 시연용 조건 추출이며 실제 Gemini 분석이 아닙니다." : "AI가 모르는 항목은 비워둡니다. 자동 제출되지 않습니다."}</p>
    </Panel>}
    {draftRequestId && (query.loading || query.error) && <Panel><ApiState loading={query.loading} error={query.error} onRetry={query.reload} /></Panel>}
    {draft && content && <form noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
      <Panel className="form-panel request-review">
        <div className="request-review__heading"><div><h2>{draft.equipment?.name ?? "시험 의뢰 신청서"}</h2><p>{draft.institution?.name} · {draft.requestNo}</p></div><Badge tone={missing.length ? "amber" : "cyan"}>{missing.length ? `${missing.length}항목 확인 필요` : "필수 정보 입력 완료"}</Badge></div>
        <div className="request-review__toolbar"><span>채워진 정보는 요약으로 확인하고, 수정할 때 펼치세요.</span><Button variant="secondary" icon={Pencil} onClick={() => { if (allFields) setTouchedPaths(new Set()); setAllFields(!allFields); }}>{allFields ? "누락 항목만 보기" : "전체 항목 수정"}</Button></div>
        {missing.length > 0 && <div className="request-missing" role="status">{missing.map((f, i) => <button key={`${f.path}:${i}`} type="button" onClick={() => focusField(f.path)}>{f.label}<ArrowRight size={12} /></button>)}</div>}
        {aiNotes.length > 0 && <details className="request-ai-notes"><summary>AI 확인 메모 {aiNotes.length}건</summary>{aiNotes.map((note, i) => <p key={i}>{note}</p>)}</details>}
        {composerGroups.map(group => {
          const filled = group.fields.filter(f => String(contentValue(content, f.path)).trim());
          return <section className="request-field-group" key={group.id}>
            <header><h3>{group.title}</h3>{group.id === "test" && content.schedule.desiredStartDate && <Button variant="secondary" disabled={!canEdit} onClick={() => update(changeContent(content, "schedule.desiredEndDate", content.schedule.desiredStartDate))}>당일 시험</Button>}{["actualUser", "accounting"].includes(group.id) && <Button variant="secondary" disabled={!canEdit} onClick={() => update({ ...content, [group.id]: { name: content.applicant.contactName, phone: content.applicant.phone, email: content.applicant.email } })}>신청자와 동일</Button>}</header>
            {!allFields && filled.length > 0 && <dl className="request-filled-summary">{filled.filter(f => !missingPaths.has(f.path) && !touchedPaths.has(f.path)).map(f => <div key={f.path}><dt>{f.label}</dt><dd>{contentValue(content, f.path)}</dd></div>)}</dl>}
            <div className="form-grid">{group.fields.filter(f => allFields || missingPaths.has(f.path) || touchedPaths.has(f.path)).map(f => {
              const id = fieldId(f.path), value = contentValue(content, f.path);
              const props = { id, value, disabled: !canEdit, "aria-invalid": missingPaths.has(f.path) || undefined,
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                  setTouchedPaths(previous => new Set(previous).add(f.path));
                  update(changeContent(content, f.path, f.type === "number" ? e.target.value === "" ? null : Number(e.target.value) : e.target.value));
                } };
              return <FormField key={f.path} id={id} label={`${f.label}${f.required ? " *" : ""}`} className={f.type === "textarea" ? "form-field--full" : ""} hint={f.path.endsWith(".phone") && group.id !== "applicant" ? "전화 또는 이메일 중 하나를 입력해주세요." : undefined}>
                {f.type === "textarea" ? <textarea {...props} rows={3} /> : <input {...props} type={f.type ?? "text"} min={f.type === "number" ? 1 : undefined} step={f.type === "number" ? 1 : undefined} />}
              </FormField>;
            })}</div>
            {!allFields && !group.fields.some(f => missingPaths.has(f.path) || touchedPaths.has(f.path)) && <button className="request-group-edit" type="button" onClick={() => setAllFields(true)}><Check size={13} />입력됨 · 수정하기</button>}
          </section>;
        })}
        <details className="request-condition-review"><summary>성적서·청구·시료 처리 정보 (선택)</summary><div className="form-grid">
          {[{ path: "report.type", label: "필요한 성적서 종류" }, { path: "billing.method", label: "희망 청구 방법" }, { path: "sample.disposal", label: "시험 후 시료 처리" }, { path: "responsible.name", label: "책임자" }].map(f => <FormField key={f.path} id={fieldId(f.path)} label={f.label}><input id={fieldId(f.path)} value={contentValue(content, f.path)} disabled={!canEdit} onChange={e => update(changeContent(content, f.path, e.target.value))} /></FormField>)}
        </div></details>
        <details className="request-condition-review"><summary>시험조건 확인·수정 <Badge tone={unknownConditions ? "amber" : "cyan"}>{unknownConditions ? `미확인 ${unknownConditions}건` : `${content.conditions.length}개 조건`}</Badge></summary>
          {rules.data && <ConditionEditor rules={rules.data.conditionRules} conditions={content.conditions} disabled={!canEdit} onChange={conditions => update({ ...content, conditions })} />}
          {(rules.loading || rules.error) && <ApiState loading={rules.loading} error={rules.error} onRetry={rules.reload} />}
          {!rules.loading && !rules.error && !rules.data && <p className="field-hint">시험조건은 기관 확인이 필요합니다.</p>}
        </details>
        <div className="request-submit-review"><FileCheck2 size={20} /><div><strong>제출 전 최종 확인</strong><p>희망 일정은 예약 확정이 아닙니다. 시험조건·담당자 정보를 확인해주세요.</p></div></div>
        <label className="request-review-consent"><input id="request-reviewed" type="checkbox" checked={reviewed} disabled={!canEdit} onChange={e => setReviewed(e.target.checked)} />의뢰 내용과 미확인 조건을 확인했으며 직접 제출합니다.</label>
        <div className="form-actions"><span className="field-hint">{apiConfig.isMock ? "DEMO · 실제 기관으로 전송되지 않습니다." : "제출 후 해당 기관이 검토합니다."}</span><Button type="submit" icon={ArrowRight} disabled={!canEdit || !reviewed || missing.length > 0}>{action.busy ? "저장·제출 중…" : "확인한 내용으로 제출"}</Button></div>
      </Panel>
    </form>}
    <Feedback action={action} onRetry={draftRequestId ? () => { savedVersion.current = null; query.reload(); } : undefined} />
  </div>;
}
