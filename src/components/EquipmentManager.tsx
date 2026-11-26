import { Fragment, useDeferredValue, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Building2, ChevronDown, CircleAlert, CircleCheck, Database, FileText, Gauge, Pencil, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Button, EmptyState, PageHeader, Panel } from "./ui";
import ApiState from "./ui/ApiState";
import { useAction } from "../hooks/useAction";
import { catalogService } from "../services/catalogService";
import EquipmentEditDialog from "./workflow/EquipmentEditDialog";
import { Feedback } from "./workflow/Feedback";
import { specLabel, testTypeLabel } from "../services/equipmentService";
import { useApiQuery } from "../hooks/useApiQuery";
import type { Equipment } from "../services/equipmentService";
import { valueText } from "../domain/constants";
import { needsUpdate } from "./dashboard/ProviderParts";

const OPERATION: Record<string, [string, string]> = { AVAILABLE: ["운영 중", "green"], LIMITED: ["일정 제한", "amber"], MAINTENANCE: ["점검 중", "red"] };
const operation = (item: Equipment) => OPERATION[item.availability ?? item.usage?.availability ?? ""] ?? ["상태 미등록", "neutral"];
/** 이용 범위 코드 → 화면 이름 (장비 상세·정보 수정 창과 같은 말) */
const ACCESS: Record<string, string> = { EXTERNAL_ALLOWED: "외부 이용 가능", INTERNAL_ONLY: "기관 내부 전용" };
/** 코드면 한글로, 이미 글로 들어온 값은 그대로, UNKNOWN·빈 값은 null */
const accessText = (scope?: string | null) => (!scope || scope === "UNKNOWN" ? null : ACCESS[scope] ?? scope);
type StatusFilter = "all" | "AVAILABLE" | "LIMITED" | "MAINTENANCE" | "stale";
/** 한 번에 그리는 행 수 — 관리자는 전체 장비(수백 대)를 보므로 나눠서 그림 */
const PAGE_ROWS = 50;
const availabilityOf = (e: Equipment) => e.availability ?? e.usage?.availability;

export default function EquipmentManager() {
  const { equipmentList, user, catalogQuery } = useWorkspace();
  const admin = user.role === "ADMIN";
  const orgId = user.organization?.id;
  const managedEquipment = useMemo(
    () => user.role === "INSTITUTION_MANAGER" ? equipmentList.filter((item) => item.institutionId === orgId) : equipmentList,
    [equipmentList, user.role, orgId],
  );
  // 시험유형 한글 이름표 (5분 캐시 — 다른 화면에서 이미 받았으면 요청 없음)
  useApiQuery((signal) => catalogService.testTypes(signal), "test-types");
  const [open, setOpen] = useState<number | null>(null);
  // 대시보드의 '정보 갱신 필요'를 눌러 들어오면 해당 장비만 먼저 보여줍니다.
  const [status, setStatus] = useState<StatusFilter>(() => {
    try {
      const saved = window.sessionStorage.getItem("astra.manager.filter");
      window.sessionStorage.removeItem("astra.manager.filter");
      return saved === "stale" ? "stale" : "all";
    } catch { return "all"; }
  });
  const [now] = useState(() => Date.now());
  // 장비마다 '갱신 필요' 판정은 한 번만 계산해 두고 재사용 (키 입력마다 수백 대를 다시 계산하지 않음)
  const checks = useMemo(() => new Map(managedEquipment.map((e) => [e.id, needsUpdate(e, now)])), [managedEquipment, now]);
  const statusCounts = useMemo<{ key: StatusFilter; label: string; count: number }[]>(() => {
    const count = (state: string) => managedEquipment.filter((e) => availabilityOf(e) === state).length;
    return [
      { key: "all", label: "전체", count: managedEquipment.length },
      { key: "AVAILABLE", label: "운영 중", count: count("AVAILABLE") },
      { key: "LIMITED", label: "일정 제한", count: count("LIMITED") },
      { key: "MAINTENANCE", label: "점검 중", count: count("MAINTENANCE") },
      { key: "stale", label: "정보 갱신 필요", count: managedEquipment.filter((e) => (checks.get(e.id)?.reasons.length ?? 0) > 0).length },
    ];
  }, [managedEquipment, checks]);
  // v10: 시험 의뢰 관리처럼 오른쪽 위 검색 — 장비명·모델·장비번호·시험 종류로 찾기
  const [keyword, setKeyword] = useState("");
  // 입력은 바로 반영하고, 목록 거르기는 한 박자 늦게 (입력이 버벅이지 않게)
  const deferredKeyword = useDeferredValue(keyword);
  const term = deferredKeyword.trim().toLowerCase().replace(/\s+/g, "");
  const [limit, setLimit] = useState(PAGE_ROWS);
  const visible = useMemo(() => {
    const matches = (e: Equipment) => !term || [e.name, e.model, e.externalId, e.testItem]
      .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "").includes(term);
    return managedEquipment.filter((e) => (status === "all" || (status === "stale" ? (checks.get(e.id)?.reasons.length ?? 0) > 0 : availabilityOf(e) === status)) && matches(e));
  }, [managedEquipment, checks, status, term]);
  const shown = visible.slice(0, limit);
  const [editing, setEditing] = useState(null),
    action = useAction();
  const handleDelete = (id) => {
    if (
      window.confirm("이 장비를 비활성화할까요? 기존 의뢰 이력은 유지됩니다.")
    )
      action.run(
        () => catalogService.deleteEquipment(id),
        "장비를 비활성화했습니다.",
      );
  };

  return (
    <div className="content-page page-enter">
      <PageHeader title={admin ? "등록 장비 관리" : "보유 장비 관리"} />
      <Feedback action={action} />
      <div className="manager-toolbar">
        <div className="manager-status" role="group" aria-label="장비 상태로 보기">
          {statusCounts.map((item) => (
            <button type="button" key={item.key} aria-pressed={status === item.key} disabled={catalogQuery.status !== "ready"}
              className={item.key === "stale" && item.count ? "is-attention" : undefined} onClick={() => { setStatus(item.key); setOpen(null); setLimit(PAGE_ROWS); }}>
              {item.label}<b>{catalogQuery.status === "ready" ? item.count : "—"}</b>
            </button>
          ))}
        </div>
        <label className="mgr-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">{admin ? "등록 장비 검색" : "보유 장비 검색"}</span>
          <input type="search" value={keyword} onChange={(e) => { setKeyword(e.target.value); setOpen(null); setLimit(PAGE_ROWS); }} placeholder="장비명·모델·번호 검색" />
        </label>
      </div>
      {catalogQuery.loading || catalogQuery.error ? (
        <Panel><ApiState loading={catalogQuery.loading} error={catalogQuery.error} onRetry={catalogQuery.reload} /></Panel>
      ) : visible.length ? (
        <div className="mgr-table" role="table" aria-label={admin ? "등록 장비 목록" : "보유 장비 목록"}>
          <div className="mgr-row mgr-row--head" role="row">
            <span role="columnheader">장비 · 모델</span>
            <span role="columnheader">시험 종류</span>
            <span role="columnheader">운영 상태</span>
            <span role="columnheader">정보 확인</span>
            <span role="columnheader">이용료</span>
            <span role="columnheader"><span className="sr-only">작업</span></span>
          </div>
          {shown.map((equip, index) => {
            const [opLabel, opTone] = operation(equip);
            const check = checks.get(equip.id) ?? needsUpdate(equip, now);
            const expanded = open === equip.id;
            return (
              <Fragment key={equip.id}>
                <div role="row" className={`mgr-row${expanded ? " is-open" : ""}${check.reasons.length ? " is-stale" : ""}`} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
                  <button type="button" role="cell" className="mgr-row__name" aria-expanded={expanded} aria-controls={`equipment-detail-${equip.id}`}
                    onClick={() => setOpen(expanded ? null : equip.id)}>
                    <ChevronDown size={15} aria-hidden="true" className="mgr-row__chevron" />
                    <span><strong>{equip.name}</strong><small>{[equip.model, equip.externalId].filter(Boolean).join(" · ") || "모델 미입력"}</small></span>
                  </button>
                  <span role="cell" className="mgr-row__types">{equip.testTypes.length
                    ? equip.testTypes.map((code) => <span key={code} className="type-chip">{testTypeLabel(code)}</span>)
                    : <span className="mgr-row__muted">—</span>}</span>
                  <span role="cell" className="mgr-row__op"><span className={`status-chip status-chip--${opTone}`}><i aria-hidden="true" />{opLabel}</span></span>
                  <span role="cell" className="mgr-row__check">
                    {check.reasons.length ? <span className="warn-chip" title={check.reasons.join(", ")}>갱신 필요</span> : <span className="ok-chip">최신</span>}
                    <small>{equip.updateDate ?? "갱신일 없음"}</small>
                  </span>
                  <span role="cell" className="mgr-row__fee">{equip.usage?.feeText ?? equip.feeText ?? "미등록"}</span>
                  <span role="cell" className="mgr-row__actions">
                    <button type="button" className="icon-button" aria-label={`${equip.name} 정보 수정`} title="정보 수정" disabled={action.busy} onClick={() => setEditing(equip.id)}><Pencil size={15} /></button>
                    <button type="button" className="icon-button icon-button--danger" aria-label={`${equip.name} 비활성화`} title="비활성화" disabled={action.busy} onClick={() => handleDelete(equip.id)}><Trash2 size={15} /></button>
                  </span>
                </div>
                <div id={`equipment-detail-${equip.id}`} className={`mgr-detail${expanded ? " is-open" : ""}`} role="row" aria-hidden={!expanded}>
                  {/* v19: 세 묶음을 각각 작은 카드로, 항목마다 줄을 그어 이름·값을 읽기 쉽게. 수정은 행 오른쪽 연필 아이콘으로 */}
                  <div className="mgr-detail__inner" role="cell">
                    <section className="mgr-card mgr-card--specs">
                      <h3><Gauge size={14} aria-hidden="true" />주요 사양{equip.specs?.length ? <small>{equip.specs.length}개</small> : null}</h3>
                      {equip.specs?.length ? (
                        <dl className="mgr-specs">
                          {equip.specs.map((spec) => (
                            <div key={spec.key}>
                              <dt>{specLabel(spec)}</dt>
                              <dd>{valueText(spec)}{spec.verificationStatus !== "CONFIRMED" && <em title="기관 확인 전 사양">미확인</em>}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : <p className="mgr-detail__empty">등록된 사양이 없습니다.</p>}
                    </section>
                    <section className="mgr-card">
                      <h3><Building2 size={14} aria-hidden="true" />운영 정보</h3>
                      <dl className="mgr-specs">
                        <div><dt>제조사</dt><dd>{equip.manufacturer || <span className="is-empty">미입력</span>}</dd></div>
                        <div><dt>지역</dt><dd>{equip.region || <span className="is-empty">미입력</span>}</dd></div>
                        <div><dt>이용 범위</dt><dd>{accessText(equip.usage?.accessScope) ?? <span className="is-empty">확인 필요</span>}</dd></div>
                        <div><dt>소요 기간</dt><dd>{equip.usage?.durationText || <span className="is-empty">미입력</span>}</dd></div>
                        <div><dt>이용료</dt><dd>{equip.usage?.feeText ?? equip.feeText ?? <span className="is-empty">미등록</span>}</dd></div>
                      </dl>
                    </section>
                    <section className="mgr-card">
                      <h3><ShieldCheck size={14} aria-hidden="true" />상태 점검</h3>
                      <dl className="mgr-specs mgr-checks">
                        {[
                          ["사양 정보", equip.verificationStatus === "CONFIRMED" ? "확인 완료" : "미확인", equip.verificationStatus === "CONFIRMED"],
                          ["마지막 갱신", equip.updateDate ? `${equip.updateDate}${check.age != null ? ` · ${check.age}일 전` : ""}` : "기록 없음", check.age != null && check.age <= 180],
                          ["운영 상태", opLabel, opLabel === "운영 중"],
                        ].map(([label, value, ok]) => (
                          <div key={label as string} className={ok ? "is-ok" : "is-warn"}>
                            <dt>{ok ? <CircleCheck size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {check.reasons.length > 0 && <p className="mgr-card__note">갱신이 필요한 이유: {check.reasons.join(", ")}</p>}
                    </section>
                    {equip.reason && (
                      <section className="mgr-card mgr-card--wide">
                        <h3><FileText size={14} aria-hidden="true" />장비 설명</h3>
                        <p className="mgr-detail__desc">{equip.reason}</p>
                      </section>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
          {visible.length > shown.length && (
            <div className="mgr-more">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE_ROWS)}>
                더 보기 <small>{shown.length} / {visible.length}대</small>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Panel>
          <EmptyState icon={Database}
            title={term ? "검색어와 맞는 장비가 없습니다" : status === "all" ? "등록된 장비가 없습니다" : "해당 상태의 장비가 없습니다"}
            description={term ? "검색어를 바꾸거나 지워 보세요." : status === "all" ? (admin ? "기관·대학이 장비를 등록하면 여기에 표시됩니다." : "대시보드의 장비 등록 칸에 사양서 파일을 넣거나 '수동 등록'으로 첫 번째 장비를 등록해 보세요.") : "다른 상태를 선택해 보세요."} />
        </Panel>
      )}
      {editing && (
        <EquipmentEditDialog
          key={editing}
          equipmentId={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
