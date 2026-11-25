import { useMemo, useState } from "react";
import { ArrowRight, Building2, Check, Circle, Sparkles } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, FormField, PageHeader, Panel } from "./ui";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { requestService } from "../services/requestService";
import { catalogService } from "../services/catalogService";
import type { RequestContent } from "../services/contracts";
import ConditionEditor from "./workflow/ConditionEditor";
import { Feedback } from "./workflow/Feedback";
import ApiState from "./ui/ApiState";
import { requestStatusLabels } from "../domain/constants";

type Content = RequestContent & { notes?: string; test: RequestContent["test"] & { standard?: string } };

/**
 * 시험 의뢰서 작성.
 * 피드백에 따라 '초안 저장' 단계를 없앴습니다. 새 의뢰는 화면에서 바로 작성하고
 * [의뢰서 제출] 한 번으로 생성 → 내용 저장 → 제출이 이어서 처리됩니다.
 * (AI 자동 작성 등으로 이미 만들어진 초안은 불러와서 이어서 작성할 수 있습니다.)
 */
export default function Reservation({ setActiveMenu }: { setActiveMenu: (menu: string) => void }) {
  const {
    testCondition, setTestCondition, selectedEquipment, setSelectedEquipment, equipmentList,
    requirementId, draftRequestId, setDraftRequestId, user,
  } = useWorkspace();
  const action = useAction();
  const [reviewed, setReviewed] = useState(false);
  const [editor, setEditor] = useState<Content | null>(null);
  const query = useApiQuery((signal) => requestService.get(draftRequestId, signal), `request:${draftRequestId}`, Boolean(draftRequestId));
  const draft = query.data;

  const organizationId = user.organization?.id;
  const options = useMemo(() => {
    const list = selectedEquipment && !equipmentList.some((item) => item.id === selectedEquipment.id)
      ? [selectedEquipment, ...equipmentList] : equipmentList;
    return list.filter((equipment) => organizationId == null || equipment.institutionId !== organizationId);
  }, [equipmentList, organizationId, selectedEquipment]);
  const equipment = draft?.equipment ? options.find((e) => e.id === draft.equipment.id) ?? null : selectedEquipment;

  const blank: Content = useMemo(() => ({
    applicant: { companyName: user.organization?.name ?? "", contactName: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "" },
    test: { testTypeCode: selectedEquipment?.testTypes?.[0], purpose: "", conditions: [] },
    schedule: { desiredStartDate: null, desiredEndDate: null },
    sample: { name: "", quantity: 1, readyDate: null },
    conditions: [],
    notes: testCondition,
  }), [user, selectedEquipment, testCondition]);
  const content: Content = editor ?? (draft?.revision.content as Content) ?? blank;
  const testTypeCode = content.test.testTypeCode ?? equipment?.testTypes?.[0];
  const rules = useApiQuery((signal) => catalogService.testType(testTypeCode, signal), `test-type:${testTypeCode}`, Boolean(testTypeCode));

  const change = <K extends keyof Content>(section: K, key: string, value: unknown) => {
    setEditor({ ...content, [section]: { ...(content[section] as object), [key]: value } });
    setReviewed(false);
  };

  const checklist = [
    { label: "시험장비", done: Boolean(equipment) },
    { label: "희망 시험일", done: Boolean(content.schedule.desiredStartDate) },
    { label: "담당자 연락 정보", done: Boolean(content.applicant.companyName && content.applicant.contactName && content.applicant.email) },
    { label: "시료 정보", done: Boolean(content.sample.name && content.sample.quantity) },
    { label: "시험 목적", done: Boolean(content.test.purpose?.trim()) },
  ];
  const ready = checklist.every((item) => item.done);
  const locked = draft != null && draft.status !== "DRAFT";

  const submit = () => {
    if (!ready || !reviewed || !equipment || locked) return;
    void action.run(async (signal) => {
      let id = draft?.id;
      let version = draft?.version;
      if (!id) {
        const body = { equipmentId: equipment.id, ...(requirementId ? { requirementId } : {}) };
        const created = requirementId ? await requestService.aiDraft(body, signal) : await requestService.create(body, signal);
        id = created.requestId ?? created.id;
        version = (await requestService.get(id, signal)).version;
      }
      const saved = await requestService.save(id, version, { ...content, test: { ...content.test, testTypeCode } }, signal);
      await requestService.submit(id, saved.version, signal);
      setDraftRequestId(null);
      setSelectedEquipment(null);
      setTestCondition("");
      setActiveMenu("reservationCheck");
    });
  };

  const loadAiDraft = () => action.run(async (signal) => {
    const result = await requestService.aiDraft({ equipmentId: equipment.id, requirementId }, signal);
    setEditor(null);
    setDraftRequestId(result.requestId ?? result.id);
  });

  const disabled = action.busy || locked;

  return (
    <div className="content-page page-enter request-form-page">
      <PageHeader title="시험 의뢰하기" description="필수 항목을 채우고 바로 제출하세요. 제출 후 보유기관이 검토합니다.">
        {draft && <Badge tone="cyan">{requestStatusLabels[draft.status] ?? draft.status} · {draft.requestNo}</Badge>}
      </PageHeader>
      <form className="request-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="request-form__main">
          <Panel className="request-form__section" title="1. 시험장비">
            <div className="form-grid">
              <FormField id="request-equipment" label="시험장비 *" className="form-field--full">
                <select id="request-equipment" value={equipment?.id ?? ""} disabled={Boolean(draftRequestId) || disabled}
                  onChange={(event) => {
                    const next = options.find((item) => item.id === Number(event.target.value)) ?? null;
                    setSelectedEquipment(next);
                    if (editor) setEditor({ ...editor, test: { ...editor.test, testTypeCode: next?.testTypes?.[0] } });
                  }}>
                  <option value="" disabled>의뢰할 장비를 선택해주세요</option>
                  {options.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.institution}</option>)}
                </select>
              </FormField>
            </div>
            {requirementId && !draftRequestId && equipment && (
              <div className="request-form__ai">
                <Sparkles size={16} aria-hidden="true" />
                <span>AI 상담에서 정리한 조건으로 의뢰서를 자동으로 채울 수 있어요.</span>
                <Button variant="secondary" disabled={action.busy} onClick={loadAiDraft}>AI로 채우기</Button>
              </div>
            )}
          </Panel>

          <Panel className="request-form__section" title="2. 일정·신청자">
            <div className="form-grid">
              <FormField id="request-date" label="희망 시험일 *" hint="기관과 협의 후 확정됩니다.">
                <input id="request-date" type="date" value={content.schedule.desiredStartDate ?? ""} disabled={disabled}
                  onChange={(e) => change("schedule", "desiredStartDate", e.target.value || null)} />
              </FormField>
              <FormField id="request-end-date" label="희망 종료일">
                <input id="request-end-date" type="date" value={content.schedule.desiredEndDate ?? ""} disabled={disabled}
                  min={content.schedule.desiredStartDate ?? undefined}
                  onChange={(e) => change("schedule", "desiredEndDate", e.target.value || null)} />
              </FormField>
              <FormField id="request-company" label="기업명 *">
                <input id="request-company" required value={content.applicant.companyName ?? ""} disabled={disabled}
                  onChange={(e) => change("applicant", "companyName", e.target.value)} />
              </FormField>
              <FormField id="request-contact" label="담당자 *">
                <input id="request-contact" required value={content.applicant.contactName ?? ""} disabled={disabled}
                  onChange={(e) => change("applicant", "contactName", e.target.value)} />
              </FormField>
              <FormField id="request-email" label="이메일 *">
                <input id="request-email" type="email" required value={content.applicant.email ?? ""} disabled={disabled}
                  onChange={(e) => change("applicant", "email", e.target.value)} />
              </FormField>
              <FormField id="request-phone" label="연락처">
                <input id="request-phone" value={content.applicant.phone ?? ""} disabled={disabled}
                  onChange={(e) => change("applicant", "phone", e.target.value)} />
              </FormField>
            </div>
          </Panel>

          <Panel className="request-form__section" title="3. 시료·시험 내용">
            <div className="form-grid">
              <FormField id="request-sample" label="시료명 *">
                <input id="request-sample" required value={content.sample.name ?? ""} disabled={disabled} placeholder="예: 6U 큐브위성 EM"
                  onChange={(e) => change("sample", "name", e.target.value)} />
              </FormField>
              <FormField id="request-quantity" label="시료 수량 *">
                <input id="request-quantity" type="number" min="1" step="1" required value={content.sample.quantity ?? ""} disabled={disabled}
                  onChange={(e) => change("sample", "quantity", e.target.value === "" ? null : Number(e.target.value))} />
              </FormField>
              <FormField id="request-ready" label="시료 준비 완료일">
                <input id="request-ready" type="date" value={content.sample.readyDate ?? ""} disabled={disabled}
                  onChange={(e) => change("sample", "readyDate", e.target.value || null)} />
              </FormField>
              <FormField id="request-standard" label="시험 규격">
                <input id="request-standard" value={content.test.standard ?? ""} disabled={disabled} placeholder="예: MIL-STD-810H, GEVS"
                  onChange={(e) => change("test", "standard", e.target.value)} />
              </FormField>
              <FormField id="request-purpose" label="시험 목적 *" className="form-field--full">
                <textarea id="request-purpose" required rows={3} value={content.test.purpose ?? ""} disabled={disabled}
                  placeholder="예: 발사 인증 전 구조체 건전성 확인"
                  onChange={(e) => change("test", "purpose", e.target.value)} />
              </FormField>
              <FormField id="request-condition" label="세부 시험조건" className="form-field--full">
                <textarea id="request-condition" rows={4} value={content.notes ?? ""} disabled={disabled}
                  placeholder="시험 대상, 시험 항목, 주파수·온도·하중 등"
                  onChange={(e) => { setEditor({ ...content, notes: e.target.value }); setReviewed(false); }} />
              </FormField>
            </div>
            {rules.data && (
              <ConditionEditor rules={rules.data.conditionRules} conditions={content.conditions} disabled={disabled}
                onChange={(conditions) => { setEditor({ ...content, conditions }); setReviewed(false); }} />
            )}
            {draftRequestId && (query.loading || query.error) && <ApiState loading={query.loading} error={query.error} onRetry={query.reload} />}
          </Panel>
        </div>

        <aside className="request-form__aside">
          <Panel className="request-summary">
            <div className="request-summary__equipment">
              {equipment ? (
                <>
                  <strong>{equipment.name}</strong>
                  <small><Building2 size={13} aria-hidden="true" />{equipment.institution}</small>
                  {equipment.usage?.feeText && <small>이용료 {equipment.usage.feeText}</small>}
                </>
              ) : <small>장비를 선택하면 보유기관과 이용료가 표시됩니다.</small>}
            </div>
            <ul className="request-summary__checklist" aria-label="필수 항목">
              {checklist.map((item) => (
                <li key={item.label} className={item.done ? "is-done" : undefined}>
                  {item.done ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                  {item.label}
                </li>
              ))}
            </ul>
            <label className="request-summary__confirm">
              <input type="checkbox" checked={reviewed} disabled={!ready || disabled} onChange={(e) => setReviewed(e.target.checked)} />
              입력한 내용을 확인했습니다.
            </label>
            <Button type="submit" icon={ArrowRight} className="button--full" disabled={!ready || !reviewed || disabled}>
              {action.busy ? "제출 중…" : "의뢰서 제출"}
            </Button>
            <Feedback action={action} onRetry={query.reload} />
          </Panel>
        </aside>
      </form>
    </div>
  );
}
