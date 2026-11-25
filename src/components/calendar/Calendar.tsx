import { useRef } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthDays, monthOf, moveMonth, onDay, addDays, dateLabel, dayTimeLabel, reservationStatuses } from "../../domain/calendar";
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
export default function Calendar({ month, today, selected, events, busy = [], testName, onMonth, onDaySelect, onEventSelect }) {
  const root = useRef(null);
  const days = monthDays(month);
  const keyboard = (e, day) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -new Date(`${day}T00:00:00Z`).getUTCDay(), End: 6 - new Date(`${day}T00:00:00Z`).getUTCDay() }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = addDays(day, delta);
    if (monthOf(next) !== month) onMonth(monthOf(next));
    requestAnimationFrame(() => root.current?.querySelector(`[data-day="${next}"] .calendar-day__select`)?.focus());
  };
  return (
    <section className="panel calendar" aria-label="월간 시험 예약 캘린더" ref={root}>
      <header className="calendar__toolbar">
        <div><span className="eyebrow">TEST SCHEDULE</span><h2 aria-live="polite">{Number(month.slice(0, 4))}년 <strong>{Number(month.slice(5))}월</strong></h2></div>
        <div className="calendar__navigation">
          <span className="calendar__timezone">Asia/Seoul · KST</span>
          <button type="button" className="icon-button" aria-label="이전 달" onClick={() => onMonth(moveMonth(month, -1))}><ChevronLeft size={19} /></button>
          <button type="button" className="icon-button" aria-label="다음 달" onClick={() => onMonth(moveMonth(month, 1))}><ChevronRight size={19} /></button>
        </div>
      </header>
      <div className="calendar__weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar__days">
        {days.map((day) => {
          const entries = events.filter((event) => onDay(event, day));
          const occupied = busy.filter((interval) => onDay(interval, day));
          return (
            <div key={day} data-day={day} className={`calendar-day${monthOf(day) !== month ? " calendar-day--outside" : ""}${day === selected ? " calendar-day--selected" : ""}${day === today ? " calendar-day--today" : ""}`}>
              <button type="button" className="calendar-day__select" aria-label={`${dateLabel(day)} · ${entries.length}건${occupied.length ? ` · 장비 확정 점유 ${occupied.length}구간` : ""}${day === today ? " · 오늘" : ""}`} aria-current={day === today ? "date" : undefined}
                onClick={() => onDaySelect(day)} onKeyDown={(e) => keyboard(e, day)}>
                <span>{Number(day.slice(-2))}</span><small className={entries.length > 1 ? "is-many" : undefined}>{entries.length > 0 ? `${entries.length}건` : day === today ? "오늘" : ""}</small>
              </button>
              {/* v8: 칸 크기는 고정, 일정은 포스트잇 1장 + 겹친 종이 표시, 나머지는 +N (날짜를 누르면 전체 목록) */}
              <div className={`calendar-day__notes${entries.length > 1 ? " has-stack" : ""}`}>{entries.slice(0, 1).map((event, i) => {
                const status = reservationStatuses[event.status];
                return (
                  <button type="button" key={event.id} className={`sticky-note sticky-note--${status.tone}`} style={{ "--tilt": `${((event.id + i) % 3) - 1}deg` } as CSSProperties}
                    onClick={() => onEventSelect(event, day)} title={`${testName(event.testType)} · ${event.equipment?.name ?? ""} · ${dayTimeLabel(event, day)} · ${status.label}`}
                    aria-label={`${dateLabel(day)} ${testName(event.testType)} · ${event.equipment?.name ?? "장비 확인 필요"} · ${dayTimeLabel(event, day)} · ${status.label}`}>
                    <strong>{testName(event.testType)}</strong>
                    <small>{dayTimeLabel(event, day)}</small>
                  </button>
                );
              })}</div>
              {occupied.length > 0 && <span className="calendar-day__busy" aria-label={`선택 장비 확정 점유 ${occupied.length}구간`}>확정 점유 {occupied.length}구간</span>}
            </div>
          );
        })}
      </div>
      <footer className="calendar__footer"><span>날짜를 선택해 일정 확인 · 방향키로 날짜 이동</span><span>여러 날 시험은 날짜별로 이어서 표시됩니다.</span></footer>
    </section>
  );
}
