import { useState } from "react";
import { ArrowRight, Plus, Search, Sparkles } from "lucide-react";
import { useWorkspace } from "../../context/AppContext";
import { Button, EmptyState, Panel } from "../ui";
import ApiState from "../ui/ApiState";
import { useApiQuery } from "../../hooks/useApiQuery";
import { requestService } from "../../services/requestService";
import { requestStatusLabels } from "../../domain/constants";
import MissionOrbit from "../motion/MissionOrbit";
import TwoWeekSchedule from "./TwoWeekSchedule";
import RequestDetailDialog from "../workflow/RequestDetailDialog";
import EquipmentStatus from "../workflow/EquipmentStatus";
import DashboardVisuals from "./DashboardVisuals";
import AdminDashboard from "./AdminDashboard";
export default function RoleDashboard({ setActiveMenu, onSearch }) {
  const { user, workspaceView, summaryQuery, equipmentList, catalogQuery } = useWorkspace();
  const provider = workspaceView === "PROVIDER", admin = workspaceView === "ADMIN";
  const [q, setQ] = useState(""), [selected, setSelected] = useState<number | null>(null);
  const list = useApiQuery(signal => requestService.list({ size: 5, ...(admin ? {} : { box: provider ? "RECEIVED" : "SENT" }) }, signal), `dashboard-list:${user.id}:${workspaceView}`, !admin);
  const summary = summaryQuery.data, available = summary?.dataAvailable.requests === true;
  const counts = summary?.requestCounts;
  const own = equipmentList.filter(e => admin || e.institutionId === user.organization?.id);
  const statuses = [
    { label: "작성 중", keys: ["DRAFT"] }, { label: "접수·검토", keys: ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"] },
    { label: "보완 요청", keys: ["SUPPLEMENT_REQUESTED"] }, { label: "일정 협의", keys: ["SCHEDULING"] },
    { label: "예약 확정", keys: ["CONFIRMED"] }, { label: "시험 완료", keys: ["COMPLETED"] },
  ];
  if (admin) return <AdminDashboard onNavigate={setActiveMenu} />;
  return <div className={`content-page page-enter role-dashboard role-dashboard--${workspaceView.toLowerCase()}`}>
    <header className="role-dashboard__greeting"><div><span>{user.organization?.name ?? "ASTRA 플랫폼 운영"}</span><h1>{user.name}님, 안녕하세요</h1><p>{admin ? "승인·데이터·예약 운영 현황" : provider ? "접수 의뢰와 보유 장비를 확인하세요." : "내 의뢰와 다음 할 일을 확인하세요."}</p></div>
      <div>{admin ? <Button onClick={() => setActiveMenu("admin")}>회원·조직 승인</Button> : provider ? <><Button variant="secondary" onClick={() => setActiveMenu("manager")}>보유 장비 관리</Button><Button onClick={() => setActiveMenu("review")}>접수 의뢰 검토</Button></> : <><Button variant="secondary" icon={Sparkles} onClick={() => setActiveMenu("assistant")}>AI로 조건 정리</Button><Button icon={Plus} onClick={() => setActiveMenu("reservation")}>새 시험 의뢰</Button></>}</div>
    </header>
    {(summaryQuery.loading || summaryQuery.error) && <ApiState loading={summaryQuery.loading} error={summaryQuery.error} onRetry={summaryQuery.reload} />}
    {admin ? <div className="compact-admin-metrics">{[["회원 승인 대기", summary?.pendingUsers, "admin"], ["조직 승인 대기", summary?.pendingInstitutions, "admin"], ["전체 장비", summary?.equipmentStats.total, "manager"]].map(([label, value, menu]) => <button key={String(label)} onClick={() => setActiveMenu(menu)}><span>{label}</span><strong>{value ?? "—"}</strong></button>)}</div>
      : <div className="request-status-strip" aria-label="의뢰 단계별 현황">{statuses.map((item, i) => <button key={item.label} onClick={() => setActiveMenu(provider ? "review" : "reservationCheck")}><span>{item.label}</span><strong>{available ? item.keys.reduce((sum, key) => sum + (counts?.[key] ?? 0), 0) : "—"}</strong><i style={{ background: i === 0 || i === 2 ? "var(--amber)" : "var(--cyan)" }} /></button>)}</div>}
    {!provider && !admin && <section className="dashboard-search dashboard-search--compact"><MissionOrbit /><form onSubmit={e => { e.preventDefault(); onSearch(q.trim()); }}><Search size={20} /><input aria-label="장비 검색" value={q} onChange={e => setQ(e.target.value)} placeholder="장비명·시험항목·기관 검색" /><button type="submit">장비 찾기<ArrowRight size={15} /></button></form></section>}
    {provider && <TwoWeekSchedule onCalendar={() => setActiveMenu("calendar")} />}
    <DashboardVisuals />
    <div className="role-dashboard__grid"><Panel title={admin ? "운영 바로가기" : provider ? "검토할 의뢰" : "최근 시험 의뢰"} action={!admin && <Button variant="ghost" onClick={() => setActiveMenu(provider ? "review" : "reservationCheck")}>전체 보기</Button>}>
      {admin ? <div className="dashboard-quick-actions">{[["회원·조직 승인","admin"],["장비 데이터 검증","manager"],["중복 장비 검토","duplicates"],["예약 모니터링","calendar"]].map(([title, menu]) => <Button key={menu} variant="secondary" onClick={() => setActiveMenu(menu)}>{title}<ArrowRight size={14} /></Button>)}</div>
        : list.loading || list.error ? <ApiState loading={list.loading} error={list.error} onRetry={list.reload} /> : list.data?.content.length ? <div className="dashboard-request-rows">{list.data.content.map(r => <button type="button" key={r.id} onClick={() => setSelected(r.id)}><span><strong>{r.title || r.equipment?.name}</strong><small>{r.requestNo} · {r.institution?.name}</small></span><b>{requestStatusLabels[r.status]}</b><ArrowRight size={15} /></button>)}</div> : <EmptyState title={provider ? "접수된 의뢰가 없습니다" : "아직 보낸 의뢰가 없습니다"} />}
    </Panel><Panel title={admin ? "장비 데이터 상태" : provider ? "보유 장비 · 바로 관리" : "다음 업무"} action={provider && <Button variant="ghost" onClick={() => setActiveMenu("manager")}>전체 장비</Button>}>
      {provider || admin ? catalogQuery.loading || catalogQuery.error ? <ApiState loading={catalogQuery.loading} error={catalogQuery.error} onRetry={catalogQuery.reload} /> : own.length ? own.slice(0, 4).map(e => <div className="dashboard-equipment-status" key={e.id}><strong>{e.name}</strong><EquipmentStatus equipment={e} /><Button variant="ghost" onClick={() => setActiveMenu("manager")}>관리하기</Button></div>) : <EmptyState title="등록한 장비가 없습니다"><Button onClick={() => setActiveMenu("manager")}>장비 등록</Button></EmptyState>
        : <div className="dashboard-quick-actions"><Button variant="secondary" onClick={() => setActiveMenu("reservationCheck")}>보완 요청·결제 확인<ArrowRight size={14} /></Button><Button variant="secondary" onClick={() => setActiveMenu("calendar")}>시험 일정 확인<ArrowRight size={14} /></Button><Button variant="secondary" onClick={() => setActiveMenu("search")}>장비 검색·비교<ArrowRight size={14} /></Button></div>}
    </Panel></div>
    {selected && <RequestDetailDialog requestId={selected} onClose={() => setSelected(null)} />}
  </div>;
}
