import { useState } from "react";
import { useWorkspace } from "../../context/AppContext";
import { useApiQuery } from "../../hooks/useApiQuery";
import { loadCalendar } from "../../services/calendarService";
import { addDays, onDay, seoulDate, timeLabel } from "../../domain/calendar";
import { Button, Panel } from "../ui";
import ApiState from "../ui/ApiState";
import RequestDetailDialog from "../workflow/RequestDetailDialog";
export default function TwoWeekSchedule({ onCalendar }) {
  const { user } = useWorkspace();
  const [offset, setOffset] = useState(0), [selected, setSelected] = useState<number | null>(null);
  const [now] = useState(Date.now);
  const today = seoulDate(now), start = addDays(today, offset);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const query = useApiQuery(signal => loadCalendar(signal, undefined, "RECEIVED"), `two-weeks:${user.id}`);
  return <Panel className="two-week-schedule" title="장비 일정 · 2주" action={<div className="two-week-actions"><Button variant="ghost" aria-label="이전 2주" onClick={() => setOffset(v => v - 14)}>‹</Button><Button variant="ghost" onClick={() => setOffset(0)}>오늘</Button><Button variant="ghost" aria-label="다음 2주" onClick={() => setOffset(v => v + 14)}>›</Button><Button variant="secondary" onClick={onCalendar}>전체 달력</Button></div>}>
    {(query.loading || query.error) && <ApiState loading={query.loading} error={query.error} onRetry={query.reload} />}
    <p className="two-week-range">{start.slice(5)} ~ {days.at(-1).slice(5)} · KST</p><div className="two-week-grid">{days.map(date => {
      const events = (query.data?.schedules ?? []).filter(e => e.status !== "CANCELED" && onDay(e, date));
      return <div key={date} className={`two-week-day ${date === today ? "is-today" : ""}`}><span>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date(date + "T12:00:00+09:00"))}</span><strong>{Number(date.slice(8))}</strong>
        {events.slice(0, 2).map(e => <button type="button" key={e.id} className={e.status === "CONFIRMED" ? "is-confirmed" : "is-proposed"} onClick={() => setSelected(e.requestId)} title={`${e.equipment?.name} · ${e.status === "CONFIRMED" ? "예약 확정" : "일정 협의"}`}>{timeLabel(e.startAt)} {e.equipment?.name}<small>{e.status === "CONFIRMED" ? "확정" : "협의"}</small></button>)}
        {events.length > 2 && <button type="button" onClick={onCalendar}>+{events.length - 2}건</button>}
        {!events.length && <small className="muted-label">—</small>}
      </div>;
    })}</div>
    {selected && <RequestDetailDialog requestId={selected} onClose={() => setSelected(null)} />}
  </Panel>;
}
