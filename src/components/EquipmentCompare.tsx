import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeftRight, ArrowRight, Building2, ChevronDown, Plus, Search, X } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, Button, PageHeader } from "./ui/index";
import { useApiQuery } from "../hooks/useApiQuery";
import { catalogService } from "../services/catalogService";
import { equipmentService, testTypeLabel } from "../services/equipmentService";
import type { Equipment } from "../services/equipmentService";
import type { EquipmentSpec } from "../services/contracts";
import ApiState from "./ui/ApiState";
import { valueText } from "../domain/constants";

const availabilityLabels: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: "이용 가능", tone: "green" },
  LIMITED: { label: "일정 제한", tone: "amber" },
  MAINTENANCE: { label: "점검 중", tone: "amber" },
  UNAVAILABLE: { label: "이용 불가", tone: "neutral" },
};

/** 비교용 크기 값: 단일 값이면 그대로, 범위면 상한을 사용합니다. */
const magnitude = (spec?: EquipmentSpec | null) => (spec ? spec.value ?? spec.max ?? null : null);

function EquipmentPicker({ value, exclude, onChange, slot }: {
  value: number | null; exclude: number | null; onChange: (id: number | null) => void; slot: string;
}) {
  const { equipmentList, comparisonIds } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const current = equipmentList.find((item) => item.id === value);
  const term = query.trim().toLowerCase();
  const options = equipmentList
    .filter((item) => item.id !== exclude)
    .filter((item) => !term || `${item.name} ${item.institution} ${item.testItem} ${item.model ?? ""}`.toLowerCase().includes(term))
    .sort((a, b) => Number(comparisonIds.includes(b.id)) - Number(comparisonIds.includes(a.id)))
    .slice(0, 40);
  return (
    <div className="compare-picker" ref={box}>
      <button type="button" className="compare-picker__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="compare-picker__slot">{slot}</span>
        <span className="compare-picker__value">{current ? current.name : "비교할 장비 선택"}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="compare-picker__pop">
          <label className="compare-picker__search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">장비 검색</span>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장비명·기관·시험 종류" />
          </label>
          <ul role="listbox" aria-label={`${slot} 장비 목록`}>
            {options.map((item) => (
              <li key={item.id}>
                <button type="button" role="option" aria-selected={item.id === value} onClick={() => { onChange(item.id); setOpen(false); setQuery(""); }}>
                  <strong>{item.name}</strong>
                  <small>{item.institution} · {item.testItem}</small>
                  {comparisonIds.includes(item.id) && <Badge tone="cyan">비교함</Badge>}
                </button>
              </li>
            ))}
            {!options.length && <li className="compare-picker__empty">일치하는 장비가 없습니다.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function EquipmentCompare({ setActiveMenu }: { setActiveMenu?: (menu: string) => void }) {
  const { equipmentList, comparisonIds, setComparisonIds, catalogQuery, setSelectedEquipment, setDraftRequestId, user } = useWorkspace();
  const [slots, setSlots] = useState<[number | null, number | null]>(() => [comparisonIds[0] ?? null, comparisonIds[1] ?? null]);
  const [left, right] = slots;
  const both = left != null && right != null;
  const single = both ? null : left ?? right;

  const comparison = useApiQuery((signal) => catalogService.compare([left, right], undefined, signal), `compare:${left},${right}`, both);
  const detail = useApiQuery((signal) => equipmentService.detail(single, signal), `equipment:${single}`, single != null);

  useEffect(() => {
    setComparisonIds((ids) => [...new Set([...slots.filter((id) => id != null), ...ids])].slice(0, 5));
  }, [slots, setComparisonIds]);

  const columns = useMemo(() => {
    const ids = [left, right];
    if (both && comparison.data) {
      return ids.map((id, index) => {
        const equipment = comparison.data.equipment.find((e) => e.id === id) ?? comparison.data.equipment[index];
        const usage = comparison.data.usage.find((u) => u.equipmentId === id) ?? comparison.data.usage[index];
        return { id, equipment, usage, specs: comparison.data.rows.map((row) => ({ key: row.key, label: row.label, spec: row.values[index] })) };
      });
    }
    return ids.map((id) => {
      if (id == null || id !== single || !detail.data) return null;
      const e = detail.data;
      return { id, equipment: e.raw, usage: { equipmentId: e.id, feeText: e.usage?.feeText ?? e.feeText, durationText: e.usage?.durationText, availability: e.availability, infoUpdatedAt: e.updateDate },
        specs: (e.specs ?? []).map((spec) => ({ key: spec.key, label: spec.label ?? spec.key, spec })) };
    });
  }, [both, comparison.data, detail.data, left, right, single]);

  const rowKeys = (columns.find(Boolean)?.specs ?? []).map((row) => ({ key: row.key, label: row.label }));
  const setSlot = (index: 0 | 1, id: number | null) => setSlots((prev) => (index === 0 ? [id, prev[1]] : [prev[0], id]));
  const basket = comparisonIds.map((id) => equipmentList.find((e) => e.id === id)).filter(Boolean) as Equipment[];
  const loading = (both && comparison.loading) || (single != null && detail.loading);
  const error = both ? comparison.error : detail.error;

  const request = (id: number) => {
    const equipment = equipmentList.find((e) => e.id === id);
    if (!equipment) return;
    setDraftRequestId(null);
    setSelectedEquipment(equipment);
    setActiveMenu?.("reservation");
  };

  const usageRows: { key: "feeText" | "durationText" | "availability" | "infoUpdatedAt"; label: string }[] = [
    { key: "feeText", label: "이용료" },
    { key: "durationText", label: "소요 기간" },
    { key: "availability", label: "가용 상태" },
    { key: "infoUpdatedAt", label: "정보 갱신일" },
  ];

  return (
    <div className="content-page page-enter compare-page">
      <PageHeader title="장비 비교" description="두 장비를 나란히 놓고 사양과 이용 조건을 한눈에 비교하세요.">
        <Button variant="secondary" icon={ArrowLeftRight} disabled={!left && !right} onClick={() => setSlots(([a, b]) => [b, a])}>좌우 바꾸기</Button>
        <Button variant="secondary" icon={Plus} onClick={() => setActiveMenu?.("search")}>장비 검색에서 담기</Button>
      </PageHeader>

      {basket.length > 0 && (
        <div className="compare-basket" aria-label="비교함">
          <span>비교함</span>
          {basket.map((item) => (
            <span key={item.id} className={`compare-basket__item${slots.includes(item.id) ? " is-active" : ""}`}>
              <button type="button" onClick={() => setSlot(left == null || (right != null && left !== item.id) ? 0 : 1, item.id)} title="비교 카드에 올리기">{item.name}</button>
              <button type="button" className="compare-basket__remove" aria-label={`${item.name} 비교함에서 빼기`}
                onClick={() => { setComparisonIds((ids) => ids.filter((x) => x !== item.id)); setSlots(([a, b]) => [a === item.id ? null : a, b === item.id ? null : b]); }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {(catalogQuery.loading || catalogQuery.error) && <ApiState loading={catalogQuery.loading} error={catalogQuery.error} onRetry={catalogQuery.reload} />}

      <div className="compare-board" style={{ "--rows": rowKeys.length + usageRows.length } as CSSProperties}>
        {([0, 1] as const).map((index) => {
          const column = columns[index];
          const id = slots[index];
          const other = columns[index === 0 ? 1 : 0];
          const equipment = column?.equipment;
          const availability = availabilityLabels[column?.usage?.availability ?? ""] ;
          return (
            <section key={index} className={`compare-card${id == null ? " compare-card--empty" : ""}`} aria-label={`비교 장비 ${index === 0 ? "A" : "B"}`}>
              <div className="compare-card__head">
                <EquipmentPicker slot={index === 0 ? "A" : "B"} value={id} exclude={slots[index === 0 ? 1 : 0]} onChange={(next) => setSlot(index, next)} />
                {id != null && <button type="button" className="icon-button" aria-label="이 카드 비우기" onClick={() => setSlot(index, null)}><X size={16} /></button>}
              </div>
              {id == null ? (
                <div className="compare-card__fill compare-card__placeholder">
                  <span><Plus size={22} /></span>
                  <p>위에서 장비를 선택하거나<br />비교함에서 장비를 올려주세요.</p>
                </div>
              ) : loading || !equipment ? (
                <div className="compare-card__fill">
                  {error ? <ApiState error={error} onRetry={both ? comparison.reload : detail.reload} /> : <ApiState loading />}
                </div>
              ) : (
                <>
                  <div className="compare-card__summary">
                    <h2>{equipment.name}</h2>
                    <p><Building2 size={14} aria-hidden="true" />{equipment.institution?.name}{equipment.region && ` · ${equipment.region}`}</p>
                    <div className="compare-card__badges">
                      {equipment.testTypes.map((code) => <Badge key={code} tone="cyan">{testTypeLabel(code)}</Badge>)}
                      {availability && <Badge tone={availability.tone}>{availability.label}</Badge>}
                      {equipment.model && <Badge>{equipment.model}</Badge>}
                    </div>
                  </div>
                  {/* 각 행은 카드의 직계 자식(subgrid)이라 좌우 카드의 같은 항목이 항상 같은 높이에 놓입니다. */}
                    {rowKeys.map((row) => {
                      const spec = column.specs.find((s) => s.key === row.key)?.spec ?? null;
                      const peer = other?.specs.find((s) => s.key === row.key)?.spec ?? null;
                      const mine = magnitude(spec);
                      const theirs = magnitude(peer);
                      const max = Math.max(mine ?? 0, theirs ?? 0);
                      const differs = other != null && valueText(spec) !== valueText(peer);
                      return (
                        <dl key={row.key} className={`compare-row${differs ? " compare-row--diff" : ""}${!spec ? " compare-row--missing" : ""}`}>
                          <dt>{row.label}</dt>
                          <dd>
                            <span>{spec ? valueText(spec) : "정보 없음"}{spec?.sourceType === "MOCK" && <small className="compare-row__flag">미검증</small>}</span>
                            {mine != null && max > 0 && other != null && theirs != null && (
                              <i className="compare-row__bar" style={{ width: `${(mine / max) * 100}%` }} aria-hidden="true" />
                            )}
                          </dd>
                        </dl>
                      );
                    })}
                    {usageRows.map((row) => {
                      const raw = column.usage?.[row.key];
                      const text = row.key === "availability" ? availabilityLabels[raw ?? ""]?.label : raw;
                      const peer = other?.usage?.[row.key];
                      return (
                        <dl key={row.key} className={`compare-row compare-row--usage${other && peer !== raw ? " compare-row--diff" : ""}`}>
                          <dt>{row.label}</dt>
                          <dd><span>{text && text !== "UNKNOWN" ? text : "기관 문의"}</span></dd>
                        </dl>
                      );
                    })}
                  <div className="compare-card__foot">
                    <Button icon={ArrowRight} disabled={user.organization?.id != null && equipment.institution?.id === user.organization.id}
                      onClick={() => request(id)}>이 장비로 의뢰하기</Button>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
      {both && comparison.data && <p className="page-hint">값이 서로 다른 항목은 강조되어 표시됩니다. 최종 시험 가능 여부와 비용은 보유기관에 확인하세요.</p>}
    </div>
  );
}
