import { useState } from "react";
import { Activity, ArrowRight, Building2, CalendarCheck2, Clock3, Database, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useWorkspace } from "../../context/AppContext";
import { useApiQuery } from "../../hooks/useApiQuery";
import { adminService } from "../../services/adminService";
import { dashboardService } from "../../services/dashboardService";
import { loadCalendar } from "../../services/calendarService";
import { chartColors, requestDistribution } from "../../domain/dashboard";
import { reservationStatuses } from "../../domain/calendar";
import { requestStatusLabels } from "../../domain/constants";
import { apiConfig } from "../../api/config";
import { Badge, Button, EmptyState, Panel } from "../ui";
import ApiState from "../ui/ApiState";
import RequestDetailDialog from "../workflow/RequestDetailDialog";
import DataChart from "./DataChart";

export default function AdminDashboard({ onNavigate }: { onNavigate: (menu: string) => void }) {
  const { user, summaryQuery } = useWorkspace();
  const stats = useApiQuery(signal => dashboardService.equipmentStats(signal), `admin-equipment-stats:${user.id}`);
  const members = useApiQuery(signal => adminService.users({ size: 1 }, signal), `admin-member-total:${user.id}`);
  const organizations = useApiQuery(signal => adminService.allOrganizations(signal), `admin-all-organizations:${user.id}`);
  const available = summaryQuery.data?.dataAvailable.requests === true;
  // Existing scoped request list + detail API only; no invented calendar/analytics endpoint.
  const calendar = useApiQuery(signal => loadCalendar(signal), `admin-dashboard-calendar:${user.id}`, available);
  const [selected, setSelected] = useState<number | null>(null);
  const [now] = useState(Date.now);
  const counts = summaryQuery.data?.requestCounts;
  const ongoing = available ? ["SUBMITTED", "UNDER_REVIEW", "SUPPLEMENT_REQUESTED", "RESUBMITTED", "SCHEDULING", "CONFIRMED"].reduce((sum, key) => sum + (counts?.[key] ?? 0), 0) : null;
  const institutions = organizations.data?.filter(o => ["INSTITUTION", "UNIVERSITY"].includes(o.orgType));
  const confirmed = calendar.data?.schedules.filter(r => r.status === "CONFIRMED").length;
  const overdue = calendar.data?.requests.filter(r => r.status === "SUPPLEMENT_REQUESTED" && r.supplements?.some(s => s.status === "OPEN" && s.dueDate && Date.parse(`${s.dueDate.slice(0, 10)}T23:59:59.999+09:00`) < now)).length;
  const metricItems = [
    { label: "전체 가입 회원", value: members.data?.totalElements, unit: "명", icon: Users, menu: "admin", hint: "기업·기관·운영 계정" },
    { label: "승인 대기 회원", value: summaryQuery.data?.pendingUsers, unit: "명", icon: UserCheck, menu: "admin", hint: "가입 검토 필요" },
    { label: "전체 등록 장비", value: stats.data?.total, unit: "대", icon: Database, menu: "manager", hint: "활성 장비 기준" },
    { label: "등록 기관·대학", value: institutions?.length, unit: "곳", icon: Building2, menu: "admin", hint: "승인 전 조직 포함" },
    { label: "진행 중 시험 의뢰", value: ongoing, unit: "건", icon: Activity, menu: "review", hint: "접수부터 예약 확정까지" },
    { label: "예약 확정 현황", value: confirmed, unit: "건", icon: CalendarCheck2, menu: "calendar", hint: "전체 기간 · 확정된 예약" },
  ];
  const actionItems = [
    { title: "회원 가입 승인", hint: "가입 요청 검토 및 승인·거절", value: summaryQuery.data?.pendingUsers, menu: "admin", icon: UserCheck },
    { title: "장비 정보 관리", hint: "기관 확인 전 장비 · 중복 검토", value: stats.data?.institutions.reduce((n, row) => n + row.equipmentCount - row.verifiedCount, 0), menu: "manager", icon: Database },
    { title: "기관 운영 현황", hint: "기관·대학 승인 대기", value: institutions?.filter(row => !row.isVerified).length, menu: "admin", icon: Building2 },
    { title: "보완 기한 경과 의뢰", hint: "열린 보완 요청의 기한이 지난 건", value: overdue, menu: "review", icon: Clock3 },
  ];
  const regions = Object.entries(stats.data?.byRegion ?? {}).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: chartColors[i % chartColors.length] }));
  const reservationItems = Object.entries(reservationStatuses).map(([status, item], i) => ({ label: item.label, value: calendar.data?.schedules.filter(r => r.status === status).length ?? 0, color: chartColors[i] }));
  const requests = [...(calendar.data?.requests ?? [])].sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "")).slice(0, 5);
  return <div className="content-page page-enter role-dashboard role-dashboard--admin admin-overview">
    <header className="role-dashboard__greeting"><div><span>ASTRA / ADMIN OVERVIEW</span><h1>플랫폼 운영 대시보드</h1><p>회원 승인부터 장비·시험 운영까지 한눈에 확인하세요.</p></div><div><Badge tone={apiConfig.isMock ? "amber" : "cyan"}>{apiConfig.isMock ? "DEMO 데이터" : "API 데이터"}</Badge><Button icon={ShieldCheck} onClick={() => onNavigate("admin")}>회원·기관 관리</Button></div></header>
    {summaryQuery.error && <ApiState error={summaryQuery.error} onRetry={summaryQuery.reload} />}
    <div className="admin-metric-grid">{metricItems.map(({ label, value, unit, icon: Icon, menu, hint }) => <button type="button" key={label} onClick={() => onNavigate(menu)}><span className="admin-metric__label"><Icon size={16} />{label}<ArrowRight size={13} /></span><strong>{value == null ? "—" : value.toLocaleString("ko-KR")}<small>{unit}</small></strong><span className="admin-metric__hint">{hint}</span></button>)}</div>
    {(members.error || organizations.error) && <ApiState error={members.error ?? organizations.error} onRetry={() => { members.reload(); organizations.reload(); }} />}
    <div className="admin-chart-grid">
      <Panel title="전체 의뢰 진행 분포" description="전체 의뢰 · 현재 상태 기준">{summaryQuery.loading ? <ApiState loading /> : available && counts ? <DataChart label="전체 의뢰 상태별 건수" items={requestDistribution(counts)} /> : <p className="chart-unavailable">의뢰 집계 연동 대기</p>}</Panel>
      <Panel title="예약 상태 현황" description="제안·확정을 구분한 전체 기간 집계">{calendar.loading || calendar.error ? <ApiState loading={calendar.loading} error={calendar.error} onRetry={calendar.reload} /> : calendar.data ? <DataChart label="예약 상태별 건수" kind="bars" items={reservationItems} /> : <p className="chart-unavailable">예약 집계 연동 대기</p>}</Panel>
      <Panel title="지역별 장비 인프라" description="활성 장비 · 등록된 소재지 기준">{stats.loading || stats.error ? <ApiState loading={stats.loading} error={stats.error} onRetry={stats.reload} /> : <DataChart unit="대" label="지역별 장비 대수" kind="bars" items={regions} />}</Panel>
    </div>
    <div className="admin-operation-grid">
      <Panel title="기관별 장비·의뢰 현황" action={<Button variant="ghost" onClick={() => onNavigate("manager")}>전체 장비<ArrowRight size={13} /></Button>}>
        {stats.loading || stats.error ? <ApiState loading={stats.loading} error={stats.error} onRetry={stats.reload} /> : stats.data?.institutions.length ? <div className="table-scroll admin-institution-table"><table><thead><tr><th>보유 조직</th><th>장비</th><th>기관 확인</th><th>진행 의뢰</th></tr></thead><tbody>{stats.data.institutions.map(row => <tr key={row.id}><td>{row.name}<small>{row.region ?? "지역 미확인"}</small></td><td>{row.equipmentCount}대</td><td><span className="verification-meter"><i style={{ width: `${row.equipmentCount ? row.verifiedCount / row.equipmentCount * 100 : 0}%` }} /></span><small>{row.verifiedCount}/{row.equipmentCount}대</small></td><td>{calendar.data ? calendar.data.requests.filter(r => r.institution?.id === row.id && !["DRAFT", "COMPLETED", "REJECTED", "CANCELED"].includes(r.status)).length : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="등록된 장비 보유 조직이 없습니다" />}
      </Panel>
      <Panel title="관리자가 바로 처리할 업무"><div className="admin-action-list">{actionItems.map(({ title, hint, value, menu, icon: Icon }) => <button type="button" key={title} onClick={() => onNavigate(menu)}><Icon size={18} /><span><strong>{title}</strong><small>{hint}</small></span><b>{value ?? "—"}</b><ArrowRight size={15} /></button>)}</div><Button className="admin-duplicate-link" variant="ghost" onClick={() => onNavigate("duplicates")}>중복 의심 장비 검토<ArrowRight size={14} /></Button></Panel>
    </div>
    <Panel title="최근 시험 의뢰" action={<Button variant="ghost" onClick={() => onNavigate("review")}>시험 운영 관리<ArrowRight size={13} /></Button>}>
      {calendar.loading || calendar.error ? <ApiState loading={calendar.loading} error={calendar.error} onRetry={calendar.reload} /> : !available ? <p className="chart-unavailable">의뢰 목록 연동 대기</p> : requests.length ? <div className="dashboard-request-rows">{requests.map(r => <button type="button" key={r.id} onClick={() => setSelected(r.id)}><span><strong>{r.title || r.equipment?.name}</strong><small>{r.requestNo} · {r.institution?.name ?? "기관 미확인"}</small></span><b>{requestStatusLabels[r.status]}</b><ArrowRight size={14} /></button>)}</div> : <EmptyState title="아직 등록된 시험 의뢰가 없습니다" />}
    </Panel>
    <p className="admin-data-note">{apiConfig.isMock ? "DEMO · 실제 운영 통계가 아닙니다. " : ""}월별 가입 추이·장비 가동률은 통계 API 협의 후 제공합니다. 미제공 값은 —로 표시합니다.</p>
    {selected != null && <RequestDetailDialog requestId={selected} onClose={() => setSelected(null)} />}
  </div>;
}
