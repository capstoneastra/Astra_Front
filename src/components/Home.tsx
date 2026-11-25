import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Check, ClipboardCheck, Users, X } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { useApiQuery } from "../hooks/useApiQuery";
import { useAction } from "../hooks/useAction";
import { dashboardService } from "../services/dashboardService";
import type { DashboardRequest, DashboardView, RequestStatus } from "../services/dashboardService";
import { adminService } from "../services/adminService";
import { catalogService } from "../services/catalogService";
import type { RequestBox, RequestSummary } from "../services/contracts";
import type { ApprovalFocus } from "../hooks/useWorkspaceNavigation";
import { seoulDate } from "../domain/calendar";
import { requestStatusLabels, roleLabels } from "../domain/constants";
import { Badge, Button, Panel, TextLink } from "./ui";
import ApiState from "./ui/ApiState";
import { Empty, Section, Skeleton } from "./dashboard/DashboardParts";
import { RequestProgress, progressOf } from "./dashboard/CompanyParts";
import { ScheduleCalendar } from "./dashboard/ScheduleCalendar";
import { RegisterHero, RequestHero } from "./dashboard/Hero";
import EquipmentRegisterDialog from "./equipment/EquipmentRegisterDialog";
import { extractEquipmentDraft } from "../domain/equipmentDraft";
import { writeQuickPrefill, type HeroFile } from "../domain/quickPrefill";
import type { EquipmentDraft } from "../domain/equipmentDraft";
import type { ProgressItem, UpcomingItem } from "./dashboard/CompanyParts";
import { requestService } from "../services/requestService";
import { needsUpdate } from "./dashboard/ProviderParts";
import { FlowStack, VerificationRing, useAdminInsights } from "./dashboard/AdminInsights";
import BarChart from "./dashboard/BarChart";
import RequestDetailDialog from "./workflow/RequestDetailDialog";
import "../styles/dashboard.css";

interface HomeProps {
  view: DashboardView;
  setActiveMenu: (menu: string) => void;
  onSearch: (query: string, options?: { institutionId?: number; testType?: string; region?: string }) => void;
  openRequests: (box?: RequestBox, status?: RequestStatus | "REVIEW_QUEUE") => void;
  openCalendar: (box?: RequestBox) => void;
  openApprovals: (focus: ApprovalFocus) => void;
  openChat: (id: number) => void;
}

const DAY = 86_400_000;
const readTime = (value?: string | null) => (value ? Date.parse(value) : NaN);
const daysUntil = (value: string | null | undefined, now: number) =>
  Math.ceil((Date.parse(`${(value ?? "").slice(0, 10)}T23:59:59+09:00`) - now) / DAY);
const daysSince = (value: string | null | undefined, now: number) =>
  Math.max(0, Math.floor((now - readTime(value)) / DAY));
const dday = (n: number) => (n < 0 ? `D+${-n}` : n === 0 ? "D-day" : `D-${n}`);

function RequestRow({ item, now, onOpen, action }: {
  item: DashboardRequest; now: number; onOpen: () => void; action: string;
}) {
  const due = item.dueDate ? daysUntil(item.dueDate, now) : null;
  const age = daysSince(item.submittedAt, now);
  const tone = item.status === "SUPPLEMENT_REQUESTED" ? "amber" : item.status === "SCHEDULING" ? "violet" : item.status === "DRAFT" ? "neutral" : "cyan";
  return (
    <li>
      <button type="button" className="dash-row" onClick={onOpen}>
        <span className="dash-row__main">
          <span className="dash-row__title">
            <Badge tone={tone}>{requestStatusLabels[item.status]}</Badge>
            <strong>{item.title}</strong>
          </span>
          <small>{[item.requestNo, item.institutionName].filter(Boolean).join(" · ")}</small>
        </span>
        {due != null ? (
          <span className={`dash-row__meta${due <= 2 ? " dash-row__meta--alert" : ""}`}>{dday(due)}<small>보완 기한</small></span>
        ) : item.submittedAt ? (
          <span className={`dash-row__meta${age >= 3 ? " dash-row__meta--alert" : ""}`}>{age === 0 ? "오늘" : `${age}일 전`}<small>접수</small></span>
        ) : null}
        <span className="dash-row__cta">{action}<ArrowRight size={14} aria-hidden="true" /></span>
      </button>
    </li>
  );
}

type Upcoming = UpcomingItem;

function ApprovalQueue({ onOpenAll }: { onOpenAll: (focus: ApprovalFocus) => void }) {
  const action = useAction();
  const members = useApiQuery((signal) => adminService.users({ status: "PENDING", size: 20 }, signal), "dash-pending-users");
  const organizations = useApiQuery(async (signal) => {
    const pages = await Promise.all(["INSTITUTION", "UNIVERSITY"].map((orgType) => adminService.organizations({ orgType, verified: false }, signal)));
    return pages.flatMap((page) => page.content).filter((item) => !item.isVerified);
  }, "dash-pending-orgs");
  const [rejecting, setRejecting] = useState<number | null>(null);
  const reasons = ["소속 확인 불가", "중복 가입", "필수 정보 누락"];
  const loading = members.loading || organizations.loading;
  const rows = [
    ...(organizations.data ?? []).map((org) => ({ kind: "org" as const, id: org.id, title: org.name, detail: org.orgType === "UNIVERSITY" ? "대학 등록 신청" : "기관 등록 신청" })),
    ...(members.data?.content ?? []).map((user) => ({ kind: "user" as const, id: user.id, title: `${user.name} · ${roleLabels[user.role]}`, detail: `${user.organization?.name ?? "소속 없음"} · ${user.email}` })),
  ];
  return (
    <Section title="승인 대기" count={loading ? undefined : rows.length} className="dash-approvals"
      action={<TextLink onClick={() => onOpenAll("members")}>승인 관리</TextLink>}>
      {loading ? <Skeleton /> : members.error ? <ApiState error={members.error} onRetry={members.reload} /> : rows.length === 0 ? <Empty>처리할 승인 요청이 없습니다.</Empty> : (
        <ul className="dash-list">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="approval-row">
              <span className={`approval-row__icon approval-row__icon--${row.kind}`}>{row.kind === "org" ? <Building2 size={16} /> : <Users size={16} />}</span>
              <span className="approval-row__main"><strong>{row.title}</strong><small>{row.detail}</small></span>
              {rejecting === row.id && row.kind === "user" ? (
                <span className="approval-row__reasons" role="group" aria-label="거절 사유 선택">
                  {reasons.map((reason) => (
                    <button key={reason} type="button" disabled={action.busy} onClick={() => action.run(() => adminService.reject(row.id, reason)).then(() => setRejecting(null))}>{reason}</button>
                  ))}
                  <button type="button" className="icon-button" aria-label="취소" onClick={() => setRejecting(null)}><X size={14} /></button>
                </span>
              ) : (
                <span className="approval-row__actions">
                  {row.kind === "user" && <Button variant="ghost" disabled={action.busy} onClick={() => setRejecting(row.id)}>거절</Button>}
                  <Button variant="secondary" icon={Check} disabled={action.busy}
                    onClick={() => action.run(() => (row.kind === "org" ? adminService.verify(row.id) : adminService.approve(row.id)))}>승인</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {action.error && <p className="dash-inline-error" role="alert">{action.error.message}</p>}
    </Section>
  );
}

export default function Home({ view, setActiveMenu, onSearch, openRequests, openCalendar, openApprovals }: HomeProps) {
  const { user, setDraftRequestId, equipmentList, catalogQuery } = useWorkspace();
  const [registerDraft, setRegisterDraft] = useState<EquipmentDraft | null>(null);
  const [registered, setRegistered] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{ id: number; box: RequestBox } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const requester = view === "REQUESTER";
  const provider = view === "PROVIDER";
  const admin = view === "ADMIN";
  const university = user.organization?.orgType === "UNIVERSITY";
  const box: RequestBox = provider ? "RECEIVED" : "SENT";
  const summaryQuery = useApiQuery(
    (signal) => dashboardService.summary(user, view, signal),
    `summary:${user.id}:${user.organization?.id ?? "none"}:${view}`,
  );
  const types = useApiQuery((signal) => catalogService.testTypes(signal), "test-types", !admin);
  const summary = summaryQuery.data;
  const loading = summaryQuery.loading;
  const ready = summary?.dataAvailable.requests === true;
  const counts = ready ? summary.requestCounts : null;
  const today = seoulDate(now);
  const sum = (...statuses: RequestStatus[]) => (counts ? statuses.reduce((total, status) => total + counts[status], 0) : null);

  const tasks = useMemo(() => {
    const list = ready ? [...(provider ? summary.pendingReview ?? [] : summary.actionRequired ?? [])] : [];
    const priority = (item: DashboardRequest) =>
      item.status === "SUPPLEMENT_REQUESTED" ? 0 : item.status === "SCHEDULING" ? 1 : item.status === "RESUBMITTED" ? 0 : 2;
    return list.sort((a, b) => priority(a) - priority(b) || (readTime(a.dueDate) || Infinity) - (readTime(b.dueDate) || Infinity) ||
      (readTime(a.submittedAt) || Infinity) - (readTime(b.submittedAt) || Infinity));
  }, [ready, provider, summary]);
  const upcoming: Upcoming[] = ready ? [...(summary.upcomingReservations ?? [])]
    .filter((item) => Date.parse(item.endAt) > now).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)) : [];
  const owned = equipmentList.filter((item) => admin || item.institutionId === user.organization?.id);
  const verification = summary?.institutionVerification ?? [];
  const verifiedRate = verification.length
    ? Math.round((verification.reduce((s, i) => s + i.verifiedCount, 0) / Math.max(1, verification.reduce((s, i) => s + i.equipmentCount, 0))) * 100) : null;
  const staleCount = owned.filter((item) => needsUpdate(item, now).reasons.length).length;
  const weekEnd = seoulDate(now + 7 * 86400000);
  const weekCount = upcoming.filter((u) => seoulDate(Date.parse(u.startAt)) <= weekEnd).length;
  const insights = useAdminInsights(admin);
  // 기업: 건별 진행 현황 — 보낸 의뢰 전체에서 진행 중인 것만
  // 보낸/받은 의뢰 목록 — 기업은 건별 진행 현황, 기관은 일정 보드·캘린더에 의뢰 이름을 붙이는 데 씁니다.
  const sentRequests = useApiQuery((signal) => requestService.list({ box, size: 50 }, signal), `box-requests:${user.id}:${box}`, !admin);
  const requestInfo = new Map<number, RequestSummary>((sentRequests.data?.content ?? []).map((r) => [r.id, r]));
  const labeled: UpcomingItem[] = upcoming.map((u) => {
    const r = requestInfo.get(u.requestId);
    return { ...u, title: r?.title, party: provider ? r?.revision?.content?.applicant?.companyName : r?.institution?.name };
  });
  const progressItems: ProgressItem[] | null = sentRequests.data ? sentRequests.data.content
    .filter((r) => !["COMPLETED", "REJECTED", "CANCELED"].includes(r.status))
    .map((r) => {
      const task = summary?.actionRequired?.find((t) => t.requestId === r.id);
      const next = upcoming.find((u) => u.requestId === r.id);
      return { requestId: r.id, requestNo: r.requestNo, title: r.title, status: r.status as RequestStatus,
        institutionName: r.institution?.name, submittedAt: r.submittedAt, dueDate: task?.dueDate ?? null, nextTest: next ?? null };
    }) : null;
  const progressStats = (progressItems ?? []).reduce((acc, item) => {
    const p = progressOf(item, now);
    if (p.mine) acc.mine += 1; else acc.theirs += 1;
    if (p.late) acc.late += 1;
    return acc;
  }, { mine: 0, theirs: 0, late: 0 });

  // 첫 칸에서 쓰는 값
  const popular = [...(types.data ?? [])].sort((a, b) => (b.equipmentCount ?? 0) - (a.equipmentCount ?? 0)).slice(0, 5);
  // AI 간편 의뢰: AI 상담 창을 열고, 검색칸에 적어 둔 내용이 있으면 입력칸에 미리 넣어 둡니다.
  const startAiRequest = (text: string, files: HeroFile[]) => {
    // v15: 챗봇 대신 'AI 간편 의뢰' 페이지로 — 적어 둔 글·파일은 그 페이지에서 바로 해석
    if (text || files.length) writeQuickPrefill({ text, files });
    setActiveMenu("quickRequest");
  };
  const startRegister = (text: string) => {
    setRegistered(false);
    setRegisterDraft(text ? extractEquipmentDraft(text, (types.data ?? []).map((t) => t.code))
      : { name: "", model: "", manufacturer: "", testTypes: [], specs: [], description: "", found: [] });
  };
  const openManager = (staleOnly: boolean) => {
    try { window.sessionStorage.setItem("astra.manager.filter", staleOnly ? "stale" : "all"); } catch { /* 저장 불가 환경은 무시 */ }
    setActiveMenu("manager");
  };
  const openTask = (item: DashboardRequest) => {
    if (item.status === "DRAFT") {
      setDraftRequestId(item.requestId);
      setActiveMenu("reservation");
    } else setSelectedRequest({ id: item.requestId, box });
  };
  const taskAction = (item: DashboardRequest) =>
    provider ? (item.status === "UNDER_REVIEW" ? "이어서 검토" : "검토하기")
      : ({ SUPPLEMENT_REQUESTED: "보완하기", SCHEDULING: "일정 확인", DRAFT: "이어 쓰기" } as Record<string, string>)[item.status] ?? "열기";

  return (
    <div key={view} className={`work-dashboard page-enter view-fade work-dashboard--${admin ? "admin" : provider ? (university ? "university" : "institution") : "company"}`}>
      {summaryQuery.error && <Panel><ApiState error={summaryQuery.error} onRetry={summaryQuery.reload} /></Panel>}

      {/* ── 기업(내 의뢰): 우주 배경 첫 칸(시험 검색 + AI 간편 의뢰) / 건별 진행 현황 / 다가오는 시험 ── */}
      {requester && <>
        <RequestHero popular={popular} onSearch={(query, options) => onSearch(query, options)} onAiRequest={startAiRequest} />
        <div className="dash-grid dash-grid--company dash-fill">
          <Section title="진행 중인 의뢰" count={progressItems ? progressItems.length : undefined} className="dash-progress"
            action={<TextLink onClick={() => openRequests("SENT")}>전체 의뢰</TextLink>}>
            {progressItems && progressItems.length > 0 && (
              <p className="progress-summary">
                <span className="is-mine">내 차례 <b>{progressStats.mine}</b></span>
                <span>기관 처리 중 <b>{progressStats.theirs}</b></span>
                {progressStats.late > 0 && <span className="is-late">지연 <b>{progressStats.late}</b></span>}
                <span>이번 달 완료 <b>{sum("COMPLETED") ?? 0}</b></span>
              </p>
            )}
            {loading || sentRequests.loading ? <Skeleton /> : sentRequests.error ? <ApiState error={sentRequests.error} onRetry={sentRequests.reload} />
              : progressItems?.length ? (
                <RequestProgress items={progressItems} now={now} actionLabel={(item) => taskAction(item as DashboardRequest)}
                  onOpen={(item) => openTask(item as DashboardRequest)} />
              ) : <Empty>진행 중인 의뢰가 없습니다. 위에서 시험을 찾거나 AI 간편 의뢰로 시작해 보세요.</Empty>}
          </Section>
          <Section title="다가오는 시험" count={ready ? upcoming.length : undefined} className="dash-calendar"
            action={<TextLink onClick={() => openCalendar("SENT")}>예약 캘린더</TextLink>}>
            {loading ? <Skeleton /> : <ScheduleCalendar items={labeled} today={today} onOpen={(i) => setSelectedRequest({ id: i.requestId, box })} />}
          </Section>
        </div>
      </>}

      {/* ── 기관·대학(장비 운영): 우주 배경 첫 칸(AI 간편 장비 등록) / 검토할 의뢰 / 장비·시험 통합 캘린더 ── */}
      {provider && <>
        <RegisterHero stats={{ total: owned.length, stale: staleCount }} onRegister={startRegister} onOpenManager={openManager} />
        {registered && <p className="dash-toast" role="status">장비를 등록했습니다. 보유 장비 관리에서 이용료·가용 상태를 더 채울 수 있어요.</p>}
        <div className="dash-grid dash-grid--provider dash-fill">
          <Section title="검토할 의뢰" count={ready ? tasks.length : undefined} className="dash-tasks"
            action={<TextLink onClick={() => openRequests("RECEIVED")}>받은 의뢰 전체</TextLink>}>
            {loading ? <Skeleton /> : tasks.length ? (
              <ul className="dash-list">{tasks.map((item) => <RequestRow key={item.requestId} item={item} now={now} action={taskAction(item)} onOpen={() => openTask(item)} />)}</ul>
            ) : <Empty icon={ClipboardCheck}>검토 대기 중인 의뢰가 없습니다.</Empty>}
            {!loading && (
              <div className="dash-tasks__foot" aria-label="이번 주 요약">
                <span><b>{weekCount}</b>건 이번 주 시험 예정</span>
                {staleCount > 0 && <button type="button" onClick={openManager}><b>{staleCount}</b>대 장비 정보 갱신 필요</button>}
              </div>
            )}
          </Section>
          <Section title="장비·시험 일정" count={ready ? upcoming.length : undefined} className="dash-calendar"
            action={<TextLink onClick={() => openCalendar("RECEIVED")}>예약 캘린더</TextLink>}>
            {loading || catalogQuery.loading ? <Skeleton /> : (
              <ScheduleCalendar items={labeled} today={today} colorBy="equipment" equipmentNames={owned.map((e) => e.name)}
                onOpen={(i) => setSelectedRequest({ id: i.requestId, box })} />
            )}
          </Section>
        </div>
        {registerDraft && <EquipmentRegisterDialog key={JSON.stringify(registerDraft)} draft={registerDraft} testTypes={types.data ?? []}
          onClose={() => setRegisterDraft(null)} onDone={() => setRegistered(true)} />}
      </>}

      {/* ── 관리자: 운영 지표 시각화 + 승인 처리 + 데이터 품질 ── */}
      {admin && <>
        <div className="insight-row" aria-label="플랫폼 운영 지표">
          <Section title="의뢰 진행 분포" className="insight" action={<TextLink onClick={() => setActiveMenu("stats")}>자세히</TextLink>}>
            {loading ? <Skeleton rows={2} /> : <FlowStack counts={counts} />}
          </Section>
          <Section title="장비가 부족한 시험 분야" className="insight" action={<TextLink onClick={() => setActiveMenu("stats")}>자세히</TextLink>}>
            <p className="dash-chart__caption">장비 1대당 접수 의뢰 수 · 높을수록 부족</p>
            {insights.types.loading || insights.requests.loading ? <Skeleton rows={3} />
              : <BarChart rows={insights.demandBars.slice(0, 4)} max={insights.top} ariaLabel="시험 종류별 장비 1대당 의뢰 수" empty="아직 집계할 의뢰가 없습니다." />}
          </Section>
          <Section title="장비 정보 검증률" className="insight">
            {loading ? <Skeleton rows={2} /> : <VerificationRing summary={summary} />}
          </Section>
        </div>
        <div className="dash-grid dash-grid--main dash-fill">
          <ApprovalQueue onOpenAll={openApprovals} />
          <Section title="기관별 장비 정보 검증" className="dash-verification"
            action={verifiedRate != null ? <span className="dash-section__meta">전체 {verifiedRate}% 검증</span> : undefined}>
            {loading ? <Skeleton /> : verification.length ? (
              <ul className="dash-list">
                {[...verification].sort((a, b) => a.verifiedCount / Math.max(1, a.equipmentCount) - b.verifiedCount / Math.max(1, b.equipmentCount)).map((item) => {
                  const rate = Math.round((item.verifiedCount / Math.max(1, item.equipmentCount)) * 100);
                  return (
                    <li key={item.id}>
                      <button type="button" className="dash-row" onClick={() => setActiveMenu("manager")} title="등록 장비 관리에서 확인">
                        <span className="dash-row__main"><strong>{item.name}</strong><small>{item.region ?? "지역 미등록"} · {item.verifiedCount}/{item.equipmentCount}대 검증</small></span>
                        <span className={`verify-meter${rate < 60 ? " verify-meter--low" : ""}`}><i style={{ width: `${rate}%` }} /></span>
                        <span className="dash-row__meta">{item.equipmentCount ? `${rate}%` : "—"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty>표시할 기관이 없습니다.</Empty>}
          </Section>
        </div>
      </>}

      {selectedRequest && <RequestDetailDialog key={selectedRequest.id} requestId={selectedRequest.id}
        requestBox={selectedRequest.box} onClose={() => setSelectedRequest(null)} />}
    </div>
  );
}
