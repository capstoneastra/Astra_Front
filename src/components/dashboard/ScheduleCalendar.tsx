import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, monthDays, monthOf, moveMonth, seoulDate, timeLabel } from "../../domain/calendar";
import type { UpcomingItem } from "./CompanyParts";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 대시보드 캘린더 (v9·v11)
 * - 칸에는 표시만 하고(점·색 막대), 내용은 날짜에 마우스를 올리거나 키보드로 선택하면 작은 창으로 보여줍니다.
 * - colorBy="equipment": 기관·대학용. 장비마다 색을 정해 하나의 캘린더에서 시험과 장비를 함께 구분합니다.
 *   v11: 아래 범례는 없애고, 날짜에 마우스를 올리면 뜨는 작은 창에서 장비 이름과 색을 함께 보여줍니다.
 */
export function ScheduleCalendar({ items, today, colorBy, equipmentNames = [], onOpen }: {
  items: UpcomingItem[];
  today: string;
  colorBy?: "equipment";
  equipmentNames?: string[];
  onOpen: (item: UpcomingItem) => void;
}) {
  const [month, setMonth] = useState(monthOf(today));
  const [hover, setHover] = useState<{ day: string; x: number; y: number; flip: boolean } | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // 장비 → 색 번호 (보유 장비 순서로 고정해, 필터를 바꿔도 색이 바뀌지 않게)
  const palette = useMemo(() => {
    const names = [...new Set([...equipmentNames, ...items.map((i) => i.equipmentName)])];
    return new Map(names.map((name, i) => [name, i % 8]));
  }, [equipmentNames, items]);
  const byDay = useMemo(() => {
    const map = new Map<string, UpcomingItem[]>();
    for (const item of items) {
      for (let day = seoulDate(item.startAt), guard = 0; day <= seoulDate(Date.parse(item.endAt) - 1) && guard < 40; day = addDays(day, 1), guard += 1)
        map.set(day, [...(map.get(day) ?? []), item]);
    }
    return map;
  }, [items]);
  const days = monthDays(month);

  const show = (day: string, target: HTMLElement) => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (!byDay.get(day)?.length) { setHover(null); return; }
    const root = box.current?.getBoundingClientRect();
    const cell = target.getBoundingClientRect();
    if (!root) return;
    const half = Math.min(130, root.width / 2);
    const x = Math.min(Math.max(cell.left - root.left + cell.width / 2, half), root.width - half);
    const below = cell.bottom - root.top;
    const flip = below > root.height * 0.62;
    setHover({ day, x, y: flip ? cell.top - root.top - 6 : below + 6, flip });
  };
  const hide = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHover(null), 160);
  };
  const keep = () => { if (leaveTimer.current) window.clearTimeout(leaveTimer.current); };
  const tone = (item: UpcomingItem) => (colorBy === "equipment" ? `series-${palette.get(item.equipmentName) ?? 0}` : "series-plain");
  const dday = (iso: string) => Math.round((Date.parse(`${seoulDate(iso)}T00:00:00+09:00`) - Date.parse(`${today}T00:00:00+09:00`)) / 86_400_000);

  return (
    <div className="sched-cal" ref={box} onMouseLeave={hide}>
      <div className="sched-cal__nav">
        <button type="button" className="icon-button" aria-label="이전 달" onClick={() => { setMonth(moveMonth(month, -1)); setHover(null); }}><ChevronLeft size={16} /></button>
        <strong aria-live="polite">{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</strong>
        <button type="button" className="icon-button" aria-label="다음 달" onClick={() => { setMonth(moveMonth(month, 1)); setHover(null); }}><ChevronRight size={16} /></button>
      </div>
      <div className="sched-cal__grid" role="grid" aria-label={`${month} 시험 일정`}>
        {WEEKDAYS.map((d, i) => <span key={d} className={`sched-cal__wd${i === 0 ? " is-sun" : ""}`} role="columnheader">{d}</span>)}
        {days.map((day) => {
          const events = byDay.get(day) ?? [];
          const shown = events.slice(0, 3);
          return (
            <button type="button" role="gridcell" key={day} data-day={day}
              className={`sched-cal__day${day === today ? " is-today" : ""}${events.length ? " has-event" : ""}${day < today ? " is-past" : ""}${day.slice(0, 7) !== month ? " is-out" : ""}${hover?.day === day ? " is-hover" : ""}`}
              aria-label={`${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일${events.length ? ` · 시험 ${events.length}건: ${events.map((e) => `${e.title ?? e.equipmentName} (${e.equipmentName})`).join(", ")}` : ""}`}
              onMouseEnter={(e) => show(day, e.currentTarget)} onFocus={(e) => show(day, e.currentTarget)} onBlur={hide}
              onClick={() => { if (events.length === 1) onOpen(events[0]); }}>
              <span className="sched-cal__num">{Number(day.slice(8))}</span>
              {events.length > 0 && (
                <span className="sched-cal__marks" aria-hidden="true">
                  {shown.map((e) => <i key={e.reservationId} className={tone(e)} />)}
                  {events.length > shown.length && <b>+{events.length - shown.length}</b>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hover && (
        <div className={`sched-pop${hover.flip ? " is-above" : ""}`} style={{ left: hover.x, top: hover.y } as CSSProperties}
          onMouseEnter={keep} onMouseLeave={hide} role="dialog" aria-label={`${hover.day} 일정`}>
          <p className="sched-pop__date">{Number(hover.day.slice(5, 7))}월 {Number(hover.day.slice(8))}일 · {(byDay.get(hover.day) ?? []).length}건</p>
          <ul>
            {(byDay.get(hover.day) ?? []).map((item) => {
              const n = dday(item.startAt);
              return (
                <li key={item.reservationId}>
                  <button type="button" onClick={() => onOpen(item)}>
                    <i className={tone(item)} aria-hidden="true" />
                    <span className="sched-pop__body">
                      <strong>{item.title ?? item.equipmentName}</strong>
                      <small>{timeLabel(item.startAt)} · {item.equipmentName}{item.party ? ` · ${item.party}` : ""}</small>
                    </span>
                    <em className={n <= 1 ? "is-soon" : undefined}>{n < 0 ? "진행 중" : n === 0 ? "오늘" : `D-${n}`}</em>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
