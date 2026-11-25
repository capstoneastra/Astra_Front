import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useWorkspace } from "../context/AppContext";
import { canAccessMenu } from "../auth/permissions";
import { useApiQuery } from "../hooks/useApiQuery";
import { loadCalendar } from "../services/calendarService";
import { catalogService } from "../services/catalogService";
import { inMonth, monthOf, onDay, reservationStatuses, seoulDate } from "../domain/calendar";
import { Badge, Button, PageHeader } from "./ui";
import ApiState from "./ui/ApiState";
import Calendar from "./calendar/Calendar";
import ScheduleDetail from "./calendar/ScheduleDetail";
import RequestDetailDialog from "./workflow/RequestDetailDialog";
import "../styles/calendar.css";
export default function ReservationCalendar({ onAiLauncherTarget }: { onAiLauncherTarget?: (element: HTMLDivElement | null) => void } = {}) {
  const { user, workspaceView } = useWorkspace();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const today = seoulDate(now);
  const [month, setMonth] = useState(monthOf(today));
  const [selection, setSelection] = useState<{ date: string; id?: number } | null>(null);
  const [detail, setDetail] = useState<{ id: number; date?: string } | null>(null);
  const query = useApiQuery(signal => loadCalendar(signal, undefined, workspaceView === "ADMIN" ? undefined : workspaceView === "PROVIDER" ? "RECEIVED" : "SENT"), `calendar:${user.id}:${workspaceView}`);
  const types = useApiQuery(signal => catalogService.testTypes(signal), "calendar-test-types");
  const names = new Map((types.data ?? []).map(t => [t.code, t.nameKo]));
  const testName = code => names.get(code) ?? code ?? "시험 유형 미확인";
  const events = query.data?.schedules ?? [];
  const monthly = events.filter(event => inMonth(event, month));
  const eligible = (query.data?.requests ?? []).filter(r => r.status === "SCHEDULING");
  const choose = (date: string, id?: number) => { setSelection({ date, id }); setMonth(monthOf(date)); };
  return <div className="content-page page-enter reservation-calendar">
    <PageHeader eyebrow={null} title="시험 예약 캘린더">{workspaceView === "REQUESTER" && canAccessMenu(user.role, "assistant") && <div className="ai-launcher-slot" ref={onAiLauncherTarget} />}<Button variant="secondary" icon={RefreshCw} disabled={query.loading || query.refreshing} onClick={query.reload}>새로고침</Button></PageHeader>
    <div className="schedule-summary"><span>{workspaceView === "ADMIN" ? "전체 조직" : workspaceView === "PROVIDER" ? "소속 조직 장비 일정" : "내가 신청한 일정"}</span><div><Badge>월간 {query.loading || query.error ? "—" : monthly.length}건</Badge><Badge tone="cyan">확정 {query.loading || query.error ? "—" : monthly.filter(e => e.status === "CONFIRMED").length}건</Badge></div></div>
    {(query.loading || query.error) && <div className="schedule-query-state"><ApiState loading={query.loading} error={query.error} onRetry={query.reload} /></div>}
    <div className="schedule-legend" aria-label="예약 상태 범례">{Object.entries(reservationStatuses).map(([key, item]) => <span key={key} className={`schedule-status schedule-status--${item.tone}`}>{item.label}</span>)}<span className="schedule-legend__note">{query.refreshing ? "최신 상태 확인 중…" : "한국 표준시 · KST"}</span></div>
    <div className="schedule-workspace" aria-busy={query.loading || query.refreshing}><Calendar month={month} today={today} selected={selection?.date ?? today} events={query.error ? [] : events} busy={[]} unavailable={Boolean(query.loading || query.error)} testName={testName} onMonth={setMonth} onToday={() => { setMonth(monthOf(today)); setSelection(null); }} onDaySelect={date => choose(date)} onEventSelect={(event, date) => choose(date, event.id)} /></div>
    {selection && !query.loading && !query.error && <ScheduleDetail key={`${selection.date}:${selection.id ?? "day"}`} date={selection.date} events={events.filter(e => onDay(e, selection.date))} busy={[]} initialId={selection.id} eligibleRequests={eligible} testName={testName} onClose={() => setSelection(null)} onRequest={(id, date) => { setSelection(null); setDetail({ id, date }); }} />}
    {detail && <RequestDetailDialog requestId={detail.id} initialReservationDate={detail.date} onClose={() => setDetail(null)} />}
  </div>;
}
