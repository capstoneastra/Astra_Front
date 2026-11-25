import { HeaderSlot, ViewSwitch } from "./layout/HeaderSlot";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCheck, Clock3 } from "lucide-react";
import { useAuth } from "../auth/context";
import { useApiQuery } from "../hooks/useApiQuery";
import { loadCalendar } from "../services/calendarService";
import { catalogService } from "../services/catalogService";
import { inMonth, monthOf, onDay, reservationStatuses, seoulDate } from "../domain/calendar";
import type { RequestBox } from "../services/contracts";
import { EmptyState, PageHeader, Panel } from "./ui/index";
import ApiState from "./ui/ApiState";
import Calendar from "./calendar/Calendar";
import ScheduleCard from "./calendar/ScheduleCard";
import ScheduleDetail from "./calendar/ScheduleDetail";
import RequestDetailDialog from "./workflow/RequestDetailDialog";

export default function ReservationCalendar({ requestBox, onBoxChange }: {
  requestBox?: RequestBox;
  onBoxChange: (box: RequestBox) => void;
}) {
  const { user } = useAuth();
  const box = user.role === "ADMIN" ? undefined : requestBox ?? (user.role === "INSTITUTION_MANAGER" ? "RECEIVED" : "SENT");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const today = seoulDate(now);
  const [month, setMonth] = useState(monthOf(today));
  const [selection, setSelection] = useState(null);
  const [requestDetail, setRequestDetail] = useState(null);
  // 피드백(v6): 캘린더 필터 영역을 없앴습니다. 조회 범위는 상단 받은/보낸 의뢰 전환으로만 바꿉니다.
  const query = useApiQuery((signal) => loadCalendar(signal, box), `calendar:${user.id}:${box ?? "ALL"}`);
  const types = useApiQuery((signal) => catalogService.testTypes(signal), "calendar-test-types");
  const names = new Map((types.data ?? []).map((type) => [type.code, type.nameKo]));
  const testName = (code) => names.get(code) ?? (code === "UNKNOWN" || !code ? "시험 유형 확인 필요" : code);
  const filtered = query.data?.schedules ?? [];
  const anonymousBusy: { startAt: string; endAt: string }[] = [];
  const monthly = filtered.filter((event) => inMonth(event, month));
  const confirmed = monthly.filter((event) => event.status === "CONFIRMED").length;
  const pending = monthly.filter((event) => ["PROPOSED", "COUNTER_PROPOSED"].includes(event.status)).length;
  const upcoming = filtered.filter((event) => event.status !== "CANCELED" && Date.parse(event.endAt) > now).slice(0, 4);
  const eligible = (query.data?.requests ?? []).filter((r) => r.status === "SCHEDULING");
  const chooseDate = (date: string, id?: number) => { setSelection({ date, id }); setMonth(monthOf(date)); };
  const openRequest = (id, date) => { setSelection(null); setRequestDetail({ id, date }); };
  const scope = !box ? "전체 시험 예약" : box === "RECEIVED" ? "소속 조직에 접수된 시험 예약" : "내가 신청한 시험 예약";
  const changeBox = (next: RequestBox) => {
    if (box === next) return;
    setSelection(null);
    setRequestDetail(null);
    onBoxChange(next);
  };
  return <div className="content-page page-enter reservation-calendar">
    <PageHeader title="시험 예약 캘린더" description={`${scope}을 확인하고 일정을 협의하세요.`} />
    {box && user.role === "INSTITUTION_MANAGER" && (
      <HeaderSlot>
        <ViewSwitch label="예약 조회 범위" value={box} onChange={changeBox}
          options={[{ value: "RECEIVED", label: "받은 의뢰" }, { value: "SENT", label: "보낸 의뢰" }]} />
      </HeaderSlot>
    )}
    {types.error && <p className="field-hint" role="status">시험 종류 이름을 불러오지 못해 코드로 표시합니다. <button type="button" className="text-link" onClick={types.reload}>다시 조회</button></p>}
    {query.loading || query.error ? (
      <Panel><ApiState loading={query.loading} error={query.error} onRetry={query.reload} /></Panel>
    ) : <>
      {/* 수치는 달력 위 한 줄 요약으로만 보여주고, 화면의 주인공은 달력이 되도록 했습니다. */}
      <div className="schedule-summary" aria-label="선택한 달 예약 요약">
        <span className="schedule-summary__item"><CalendarDays size={14} aria-hidden="true" />이번 달 <b>{monthly.length}</b>건</span>
        <span className="schedule-summary__item"><CheckCheck size={14} aria-hidden="true" />확정 <b>{confirmed}</b></span>
        <span className={`schedule-summary__item${pending ? " is-attention" : ""}`}><Clock3 size={14} aria-hidden="true" />협의 중 <b>{pending}</b></span>
        <span className="schedule-summary__legend" aria-label="예약 상태 범례">
          {Object.entries(reservationStatuses).map(([key, item]) => <span key={key} className={`schedule-status schedule-status--${item.tone}`}>{item.label}</span>)}
        </span>
        {query.refreshing && <span className="schedule-legend__note" role="status">최신 상태 확인 중…</span>}
      </div>
      <div className="schedule-workspace">
        <div className="schedule-workspace__main"><Calendar month={month} today={today} selected={selection?.date ?? today} events={filtered} busy={anonymousBusy} testName={testName} onMonth={setMonth} onDaySelect={(date) => chooseDate(date)} onEventSelect={(event, date) => chooseDate(date, event.id)} />
          {monthly.length === 0 && <div className="schedule-month-empty"><CalendarDays size={18} /><span>선택한 달에 일정이 없습니다. 날짜를 선택하면 일정 협의가 가능한 의뢰를 확인할 수 있습니다.</span></div>}
        </div>
        <aside className="panel schedule-upcoming"><header><span className="eyebrow">UP NEXT</span><h2>다가오는 시험</h2><p>진행 중인 일정부터 다음 예약까지</p></header>
          <div className="schedule-upcoming__list">{upcoming.length ? upcoming.map((event) => <ScheduleCard key={event.id} event={event} date={seoulDate(event.startAt) < today ? today : undefined} testName={testName(event.testType)} onSelect={(item, date) => chooseDate(date, item.id)} />) : <EmptyState icon={Clock3} title="예정된 시험이 없습니다" description="예약 제안과 확정 일정이 여기에 표시됩니다." />}</div>
          <div className="schedule-upcoming__note"><strong>일정 협의 가능 {eligible.length}건</strong><p>검토가 완료된 의뢰는 날짜 선택 후 일정을 제안할 수 있습니다.</p></div>
        </aside>
      </div>
    </>}
    {selection && !query.error && !query.loading && <ScheduleDetail key={`${selection.date}:${selection.id ?? "day"}`} date={selection.date} events={filtered.filter((event) => onDay(event, selection.date))} busy={anonymousBusy.filter((interval) => onDay(interval, selection.date))} initialId={selection.id} eligibleRequests={eligible} testName={testName} requestBox={box} onClose={() => setSelection(null)} onRequest={openRequest} />}
    {requestDetail && <RequestDetailDialog requestId={requestDetail.id} initialReservationDate={requestDetail.date} requestBox={box} onClose={() => setRequestDetail(null)} />}
  </div>;
}
