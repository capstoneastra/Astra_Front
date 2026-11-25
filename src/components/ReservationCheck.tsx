import { useMemo, useState } from "react";
import { HeaderSlot, ViewSwitch } from "./layout/HeaderSlot";
import { ArrowRight, ClipboardList, Search } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { Badge, EmptyState, PageHeader, Panel } from "./ui";
import { useApiQuery } from "../hooks/useApiQuery";
import { requestService } from "../services/requestService";
import RequestDetailDialog from "./workflow/RequestDetailDialog";
import ApiState from "./ui/ApiState";
import { requestStatusLabels } from "../domain/constants";
import { seoulDate } from "../domain/calendar";
import type { RequestBox, RequestSummary } from "../services/contracts";
import "../styles/requests.css";

/** 상태 묶음 — 목록 상단의 탭(칩)으로 표시합니다. */
const groups: { id: string; label: string; statuses: string[] }[] = [
  { id: "", label: "전체", statuses: [] },
  { id: "REVIEW_QUEUE", label: "검토 대기", statuses: ["SUBMITTED", "RESUBMITTED"] },
  { id: "DRAFT", label: "작성 중", statuses: ["DRAFT"] },
  { id: "UNDER_REVIEW", label: "검토 중", statuses: ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"] },
  { id: "SUPPLEMENT_REQUESTED", label: "보완 요청", statuses: ["SUPPLEMENT_REQUESTED"] },
  { id: "SCHEDULING", label: "일정 협의", statuses: ["SCHEDULING"] },
  { id: "CONFIRMED", label: "예약 확정", statuses: ["CONFIRMED"] },
  { id: "COMPLETED", label: "완료", statuses: ["COMPLETED"] },
  { id: "CLOSED", label: "반려·취소", statuses: ["REJECTED", "CANCELED"] },
];
const tone: Record<string, string> = {
  DRAFT: "neutral", SUBMITTED: "cyan", UNDER_REVIEW: "cyan", RESUBMITTED: "cyan", SUPPLEMENT_REQUESTED: "amber",
  SCHEDULING: "violet", CONFIRMED: "green", COMPLETED: "neutral", REJECTED: "neutral", CANCELED: "neutral",
};

export default function ReservationCheck({
  setActiveMenu,
  initialStatus = "",
  institutionView = false,
}: {
  setActiveMenu: (menu: string) => void;
  initialStatus?: string;
  institutionView?: boolean;
}) {
  const { user, setDraftRequestId, setSelectedEquipment, equipmentList } = useWorkspace();
  const [selected, setSelected] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const admin = user.role === "ADMIN";
  const received = institutionView && !admin;
  const box: RequestBox | undefined = admin ? undefined : received ? "RECEIVED" : "SENT";
  const visibleGroups = groups.filter((g) => (received ? g.id !== "DRAFT" && g.id !== "UNDER_REVIEW" : g.id !== "REVIEW_QUEUE"));
  const normalized = visibleGroups.some((g) => g.id === initialStatus) ? initialStatus
    : groups.find((g) => g.statuses.includes(initialStatus) && visibleGroups.includes(g))?.id ?? "";
  const [group, setGroup] = useState(normalized);

  const query = useApiQuery(
    (signal) => requestService.list({ ...(box && { box }) }, signal),
    `requests:${user.id}:${box ?? "ALL"}`,
  );
  const all = useMemo(() => query.data?.content ?? [], [query.data]);
  const count = (id: string) => {
    const g = groups.find((x) => x.id === id);
    return g.statuses.length ? all.filter((r) => g.statuses.includes(r.status)).length : all.length;
  };
  const current = groups.find((g) => g.id === group) ?? groups[0];
  const term = keyword.trim().toLowerCase();
  const rows = all
    .filter((r) => !current.statuses.length || current.statuses.includes(r.status))
    .filter((r) => !term || `${r.title} ${r.requestNo} ${r.equipment?.name ?? ""} ${r.institution?.name ?? ""} ${r.revision?.content?.applicant?.companyName ?? ""}`.toLowerCase().includes(term));

  const continueDraft = (item: RequestSummary) => {
    setDraftRequestId(item.id);
    setSelectedEquipment(equipmentList.find((e) => e.id === item.equipment?.id) ?? null);
    setActiveMenu("reservation");
  };

  return (
    <div className="content-page page-enter requests-page">
      <PageHeader title="시험 의뢰 관리"
        description={admin ? "플랫폼 전체 의뢰의 진행 상태입니다." : received ? "우리 기관 장비로 접수된 의뢰입니다." : "신청한 의뢰의 진행 상태를 확인하세요."} />

      {user.role === "INSTITUTION_MANAGER" && (
        <HeaderSlot>
          <ViewSwitch label="의뢰함" value={received ? "review" : "reservationCheck"} onChange={setActiveMenu}
            options={[{ value: "review", label: "받은 의뢰" }, { value: "reservationCheck", label: "보낸 의뢰" }]} />
        </HeaderSlot>
      )}
      <div className="requests-toolbar">
        <div className="requests-chips" role="tablist" aria-label="진행 상태">
          {visibleGroups.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label}<span>{query.data ? count(g.id) : "·"}</span>
            </button>
          ))}
        </div>
        <label className="admin-search requests-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">의뢰 검색</span>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="의뢰명·번호·장비 검색" />
        </label>
      </div>

      {query.loading || query.error ? (
        <Panel><ApiState loading={query.loading} error={query.error} onRetry={query.reload} /></Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState icon={ClipboardList} title={received ? "해당하는 접수 의뢰가 없습니다" : "해당하는 의뢰가 없습니다"}
            description={group || term ? "다른 상태를 선택하거나 검색어를 지워보세요." : undefined} />
        </Panel>
      ) : (
        <Panel className="requests-table">
          <div className="requests-row requests-row--head" aria-hidden="true">
            <span>의뢰</span><span>{received ? "신청 기업" : "보유기관"}</span><span>희망 시험일</span><span>접수일</span><span>상태</span><span />
          </div>
          <ul className="request-list">
            {rows.map((item) => (
              <li key={item.id}>
                <button type="button" className="requests-row" onClick={() => setSelected(item.id)}>
                  <span className="requests-row__title">
                    <strong>{item.title || item.equipment?.name}</strong>
                    <small>{item.requestNo} · {item.equipment?.name}</small>
                  </span>
                  <span className="requests-row__org">{received ? item.revision?.content?.applicant?.companyName ?? "—" : item.institution?.name ?? "—"}</span>
                  <span className="requests-row__date">{item.revision?.content?.schedule?.desiredStartDate ?? "협의"}</span>
                  <span className="requests-row__date">{item.submittedAt ? seoulDate(item.submittedAt) : "미제출"}</span>
                  <span><Badge tone={tone[item.status]} dot>{requestStatusLabels[item.status] ?? item.status}</Badge></span>
                  <span className="requests-row__cta">
                    {!received && item.status === "DRAFT" ? (
                      <span role="button" tabIndex={0} className="text-link" onClick={(e) => { e.stopPropagation(); continueDraft(item); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); continueDraft(item); } }}>이어 쓰기</span>
                    ) : <ArrowRight size={15} aria-hidden="true" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {selected && <RequestDetailDialog key={selected} requestId={selected} requestBox={box} onClose={() => setSelected(null)} />}
    </div>
  );
}
