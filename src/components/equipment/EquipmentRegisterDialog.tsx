import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useWorkspace } from "../../context/AppContext";
import { useAction } from "../../hooks/useAction";
import { catalogService } from "../../services/catalogService";
import { testTypeLabel } from "../../services/equipmentService";
import { similarEquipment } from "../../domain/equipmentDraft";
import type { DraftSpec, EquipmentDraft } from "../../domain/equipmentDraft";
import { Button, FormField } from "../ui/index";
import { Feedback } from "../workflow/Feedback";

/**
 * 장비 등록 창 (v9 — 대시보드 'AI 간편 등록'에서 열림)
 * 글에서 읽어낸 항목을 미리 채우고, 담당자가 확인·수정한 뒤 등록합니다.
 * 등록 전에 비슷한 장비가 이미 있으면 알려줍니다(별도 '중복 장비' 화면 대신).
 * 등록 순서: POST /equipment → PUT /equipment/{id}/specs (API 명세)
 */
export default function EquipmentRegisterDialog({ draft, testTypes, onClose, onDone }: {
  draft: EquipmentDraft;
  testTypes: { code: string; nameKo: string }[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { equipmentList, user, catalogQuery } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(draft);
  const action = useAction();
  useEffect(() => { dialog.current?.showModal(); }, []);

  const similar = useMemo(() => similarEquipment(form, equipmentList, user.organization?.id), [form, equipmentList, user.organization?.id]);
  const valid = form.name.trim() && form.testTypes.length > 0;
  const setSpec = (i: number, patch: Partial<DraftSpec>) => setForm({ ...form, specs: form.specs.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const submit = () => action.run(async (signal) => {
    const created = await catalogService.createEquipment({
      name: form.name.trim(), model: form.model.trim() || null, manufacturer: form.manufacturer.trim() || null,
      description: form.description.trim() || null, equipmentType: "TEST",
      testTypes: form.testTypes.map((code) => ({ code })),
    }, signal) as { id?: number } | undefined;
    const specs = form.specs.filter((s) => s.label.trim() && (s.value != null || s.min != null || s.max != null || s.valueText));
    if (created?.id && specs.length) await catalogService.saveSpecs(created.id, specs as never, signal);
    catalogQuery.reload();
    onDone?.();
    dialog.current?.close();
  }, "장비를 등록했습니다.");

  return (
    <dialog ref={dialog} className="dialog equipment-dialog register-dialog" aria-labelledby="register-title" onClose={onClose}
      onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
      <div className="dialog__heading">
        <span className="register-dialog__badge"><Sparkles size={14} aria-hidden="true" />AI 간편 등록</span>
        <button type="button" className="icon-button" aria-label="장비 등록 닫기" onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      <h2 id="register-title">새 장비 등록</h2>
      {draft.found.length > 0
        ? <p className="register-dialog__found"><b>이렇게 읽었어요</b> {draft.found.join(" · ")}<br /><small>틀린 곳이 있으면 고친 뒤 등록하세요.</small></p>
        : <p className="register-dialog__found"><small>장비 정보를 직접 입력하세요. 이름과 시험 종류만 있으면 등록할 수 있고, 사양은 나중에 보유 장비 관리에서 더 채울 수 있습니다.</small></p>}

      {similar.length > 0 && (
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

      <form className="register-dialog__form" onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }}>
        <div className="form-grid">
          <FormField id="reg-name" label="장비명 *"><input id="reg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 대형 전기역학 진동시험기" /></FormField>
          <FormField id="reg-model" label="모델"><input id="reg-model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></FormField>
          <FormField id="reg-maker" label="제조사"><input id="reg-maker" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></FormField>
        </div>
        <fieldset className="register-dialog__types">
          <legend>시험 종류 * <small>여러 개 고를 수 있어요</small></legend>
          {testTypes.map((t) => (
            <button type="button" key={t.code} className="chip" aria-pressed={form.testTypes.includes(t.code)}
              onClick={() => setForm({ ...form, testTypes: form.testTypes.includes(t.code) ? form.testTypes.filter((c) => c !== t.code) : [...form.testTypes, t.code] })}>
              {t.nameKo || testTypeLabel(t.code)}
            </button>
          ))}
        </fieldset>
        <div className="register-dialog__specs">
          <div className="register-dialog__specs-head"><span>주요 사양</span><button type="button" className="text-link" onClick={() => setForm({ ...form, specs: [...form.specs, { key: `custom_${Date.now()}`, label: "", unit: "" }] })}><Plus size={13} aria-hidden="true" />사양 추가</button></div>
          {form.specs.length === 0 && <p className="register-dialog__empty">읽어낸 사양이 없습니다. 필요하면 추가하세요.</p>}
          {form.specs.map((spec, i) => {
            const isRange = spec.min != null || spec.max != null;
            return (
              <div className="spec-row" key={spec.key}>
                <input aria-label="사양 이름" value={spec.label} onChange={(e) => setSpec(i, { label: e.target.value })} placeholder="사양 이름" />
                {spec.valueText != null && !isRange && spec.value == null
                  ? <input aria-label={`${spec.label} 값`} value={spec.valueText ?? ""} onChange={(e) => setSpec(i, { valueText: e.target.value })} placeholder="값" />
                  : isRange
                    ? <span className="spec-row__range">
                        <input aria-label={`${spec.label} 최소`} type="number" value={spec.min ?? ""} onChange={(e) => setSpec(i, { min: e.target.value === "" ? null : Number(e.target.value) })} />
                        <span aria-hidden="true">~</span>
                        <input aria-label={`${spec.label} 최대`} type="number" value={spec.max ?? ""} onChange={(e) => setSpec(i, { max: e.target.value === "" ? null : Number(e.target.value) })} />
                      </span>
                    : <input aria-label={`${spec.label} 값`} type="number" value={spec.value ?? ""} onChange={(e) => setSpec(i, { value: e.target.value === "" ? null : Number(e.target.value) })} placeholder="값" />}
                <input aria-label="단위" className="spec-row__unit" value={spec.unit ?? ""} onChange={(e) => setSpec(i, { unit: e.target.value })} placeholder="단위" />
                <button type="button" className="icon-button" aria-label={`${spec.label || "사양"} 삭제`} onClick={() => setForm({ ...form, specs: form.specs.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
        <Feedback action={action} />
        <div className="dialog__actions">
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>취소</Button>
          <Button type="submit" disabled={!valid || action.busy}>{action.busy ? "등록 중…" : similar.some((s) => s.sameModel) ? "그래도 등록" : "장비 등록"}</Button>
        </div>
      </form>
    </dialog>
  );
}
