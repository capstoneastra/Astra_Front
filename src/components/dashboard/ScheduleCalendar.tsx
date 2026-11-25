import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addDays, monthDays, monthOf, moveMonth, seoulDate, timeLabel } from "../../domain/calendar";
import type { UpcomingItem } from "./CompanyParts";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 날짜 칸에 찍는 점 최대 개수 — 넘으면 점 대신 건수를 표시 */
const MAX_DOTS = 3;

/**
 * 대시보드 캘린더 (v18) — 작은 달력 + 일정 목록
 *
 * 구글 캘린더·아웃룩의 '작은 달력 + 일정(agenda)' 구성을 따릅니다.
 * - 달력: 오늘은 테두리 동그라미, 고른 날은 채운 동그라미, 일정 있는 날은 날짜 아래 색 점.
 * - 목록: 마우스를 올리지 않아도 다가오는 일정이 항상 보이게 (시연 화면·터치 화면에서도 읽힘).
 *   날짜별로 묶고 "오늘 / 내일 / 11월 29일 (토)" 로 표시. 날짜를 누르면 그날 일정만, 다시 누르면 전체.
 * - colorBy="equipment": 기관·대학용. 장비마다 색을 고정해 점과 목록 막대 색을 맞춥니다.
 * - 카드가 넓으면(컨테이너 520px 이상) 달력과 목록을 좌우로, 좁으면 위아래로 놓습니다 (CSS 컨테이너 쿼리).
 * - 좁고 낮은 카드(노트북 1280×620 등)에서는 아웃룩 모바일처럼 달력을 '2주 줄'로 접어 목록 자리를 남기고,
 *   [월 보기]로 한 달 전체를 펼칠 수 있습니다.
 */
const COMPACT_WIDTH = 520;
const COMPACT_HEIGHT = 440;
/** v6.css·v10.css 의 한 화면 대시보드 조건과 같아야 함 */
const FITTED_DASHBOARD = "(min-width: 1024px) and (min-height: 720px)";
export function ScheduleCalendar({ items, today, colorBy, equipmentNames = [], onOpen }: {
  items: UpcomingItem[];
  today: string;
  colorBy?: "equipment";
  equipmentNames?: string[];
  onOpen: (item: UpcomingItem) => void;
}) {
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<string | null>(null);
  // 카드 크기 — 좁고 낮으면 2주 줄로 접음
  const root = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [weekStart, setWeekStart] = useState(() => sundayOf(today));
  useEffect(() => {
    const el = root.current;
    if (!el || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // 카드 높이가 화면에 맞춰 고정된 '한 화면 대시보드'일 때만 접음 (스크롤 배치에서는 내용 높이라 접을 필요 없음)
      const fitted = window.matchMedia(FITTED_DASHBOARD).matches;
      setCompact(fitted && width < COMPACT_WIDTH && height < COMPACT_HEIGHT);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const strip = compact && !expanded;

  // 장비 → 색 번호 (보유 장비 순서로 고정해, 필터를 바꿔도 색이 바뀌지 않게)
  const palette = useMemo(() => {
    const names = [...new Set([...equipmentNames, ...items.map((i) => i.equipmentName)])];
    return new Map(names.map((name, i) => [name, i % 8]));
  }, [equipmentNames, items]);
  // 여러 날에 걸친 시험은 걸친 날마다 표시
  const byDay = useMemo(() => {
    const map = new Map<string, UpcomingItem[]>();
    for (const item of items) {
      for (let day = startDay(item), guard = 0; day <= endDay(item) && guard < 40; day = addDays(day, 1), guard += 1)
        map.set(day, [...(map.get(day) ?? []), item]);
    }
    return map;
  }, [items]);
  // 목록: 날짜를 고르면 그날 일정, 아니면 오늘 이후 전체를 시작일별로 묶음
  const groups = useMemo(() => {
    if (selected) return [{ day: selected, items: byDay.get(selected) ?? [] }];
    const map = new Map<string, UpcomingItem[]>();
    for (const item of [...items].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))) {
      // 이미 시작한(진행 중) 시험은 오늘 묶음에 넣음
      const day = startDay(item) < today ? today : startDay(item);
      map.set(day, [...(map.get(day) ?? []), item]);
    }
    return [...map].map(([day, list]) => ({ day, items: list }));
  }, [selected, byDay, items, today]);

  const days = strip ? Array.from({ length: 14 }, (_, i) => addDays(weekStart, i)) : monthDays(month);
  const stripLabel = () => {
    const [a, b] = [weekStart, addDays(weekStart, 13)];
    return monthOf(a) === monthOf(b) ? `${Number(a.slice(0, 4))}년 ${Number(a.slice(5, 7))}월` : `${Number(a.slice(5, 7))}월 – ${Number(b.slice(5, 7))}월`;
  };
  const move = (step: number) => (strip ? setWeekStart(addDays(weekStart, step * 7)) : setMonth(moveMonth(month, step)));
  const tone = (item: UpcomingItem) => (colorBy === "equipment" ? `series-${palette.get(item.equipmentName) ?? 0}` : "series-plain");
  const pick = (day: string) => {
    setSelected((current) => (current === day ? null : day));
    if (!strip && monthOf(day) !== month) setMonth(monthOf(day));
  };
  const dayTitle = (day: string) => {
    const diff = daysBetween(today, day);
    const base = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 (${WEEKDAYS[weekdayIndex(day)]})`;
    return diff === 0 ? `오늘 · ${base}` : diff === 1 ? `내일 · ${base}` : base;
  };

  return (
    <div className={`sched-cal${strip ? " is-strip" : ""}`} ref={root}>
      <div className="sched-cal__layout">
      <div className="sched-cal__month">
        <div className="sched-cal__nav">
          <button type="button" className="icon-button" aria-label={strip ? "이전 주" : "이전 달"} onClick={() => move(-1)}><ChevronLeft size={16} /></button>
          <strong aria-live="polite">{strip ? stripLabel() : `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월`}</strong>
          {compact && (
            <button type="button" className="sched-cal__toggle" aria-expanded={expanded}
              onClick={() => { setExpanded((v) => !v); if (!expanded) setMonth(monthOf(selected ?? weekStart)); else setWeekStart(sundayOf(selected ?? today)); }}>
              {expanded ? "접기" : "월 보기"}
            </button>
          )}
          <button type="button" className="icon-button" aria-label={strip ? "다음 주" : "다음 달"} onClick={() => move(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="sched-cal__grid" role="grid" aria-label={`${month} 시험 일정`}>
          {WEEKDAYS.map((d, i) => <span key={d} className={`sched-cal__wd${i === 0 ? " is-sun" : i === 6 ? " is-sat" : ""}`} role="columnheader">{d}</span>)}
          {days.map((day) => {
            const events = byDay.get(day) ?? [];
            const isSelected = selected === day;
            return (
              <button type="button" role="gridcell" key={day} data-day={day} aria-pressed={isSelected}
                className={`sched-cal__day${day === today ? " is-today" : ""}${isSelected ? " is-selected" : ""}${events.length ? " has-event" : ""}${day < today ? " is-past" : ""}${!strip && monthOf(day) !== month ? " is-out" : ""}`}
                aria-label={`${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일${day === today ? " (오늘)" : ""}${events.length ? ` · 시험 ${events.length}건` : ""}`}
                onClick={() => pick(day)}>
                <span className="sched-cal__num">{Number(day.slice(8))}</span>
                <span className="sched-cal__marks" aria-hidden="true">
                  {events.length > MAX_DOTS
                    ? <b>{events.length}</b>
                    : events.map((e) => <i key={e.reservationId} className={tone(e)} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sched-agenda" aria-live="polite">
        <div className="sched-agenda__head">
          <strong>{selected ? "선택한 날" : "다가오는 일정"}</strong>
          {selected && <button type="button" className="sched-agenda__reset" onClick={() => setSelected(null)}>전체 보기</button>}
        </div>
        {groups.every((g) => g.items.length === 0) ? (
          <p className="sched-agenda__empty">
            <CalendarDays size={16} aria-hidden="true" />
            {selected ? `${dayTitle(selected)}에는 시험 일정이 없어요.` : "확정된 시험 일정이 아직 없어요."}
          </p>
        ) : (
          <div className="sched-agenda__list">
            {groups.map((group) => (
              <section key={group.day} className="sched-agenda__group">
                <h3 className={daysBetween(today, group.day) === 0 ? "is-today" : undefined}>{dayTitle(group.day)}</h3>
                <ul>
                  {group.items.map((item) => {
                    const n = daysBetween(today, startDay(item));
                    const multi = startDay(item) !== endDay(item);
                    return (
                      <li key={`${group.day}:${item.reservationId}`}>
                        <button type="button" onClick={() => onOpen(item)}>
                          <i className={tone(item)} aria-hidden="true" />
                          <span className="sched-agenda__time">
                            {multi ? `${shortDate(startDay(item))}~${shortDate(endDay(item))}` : timeLabel(item.startAt)}
                          </span>
                          <span className="sched-agenda__body">
                            <strong>{item.title ?? item.equipmentName}</strong>
                            <small>{item.equipmentName}{item.party ? ` · ${item.party}` : ""}</small>
                          </span>
                          <em className={n <= 1 ? "is-soon" : undefined}>{n < 0 ? "진행 중" : n === 0 ? "오늘" : `D-${n}`}</em>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

const startDay = (item: UpcomingItem) => seoulDate(item.startAt);
/** 끝나는 시각이 자정이면 전날까지로 봄 (예: 26일 09:00 ~ 27일 00:00 → 26일 하루) */
const endDay = (item: UpcomingItem) => seoulDate(Date.parse(item.endAt) - 1);
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00+09:00`) - Date.parse(`${from}T00:00:00+09:00`)) / 86_400_000);
const weekdayIndex = (day: string) => new Date(`${day}T12:00:00+09:00`).getUTCDay();
/** 그 날이 속한 주의 일요일 */
const sundayOf = (day: string) => addDays(day, -weekdayIndex(day));
const shortDate = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`;
