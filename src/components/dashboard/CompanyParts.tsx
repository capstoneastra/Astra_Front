import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import type { RequestStatus } from "../../services/dashboardService";
import { Badge } from "../ui";
import { STAGES } from "./DashboardParts";

export interface UpcomingItem { reservationId: number; requestId: number; requestNo: string; equipmentName: string; startAt: string; endAt: string; title?: string; party?: string }

export interface ProgressItem {
  requestId: number; requestNo: string; title: string; status: RequestStatus;
  institutionName?: string; submittedAt?: string | null; dueDate?: string | null;
  nextTest?: { startAt: string } | null;
}
const TRACK = STAGES.filter((s) => s.key !== "draft");
const DAY = 86_400_000;

export function progressOf(item: ProgressItem, now: number) {
  const stageIndex = item.status === "DRAFT" ? -1 : TRACK.findIndex((s) => s.statuses.includes(item.status));
  const mine = ["DRAFT", "SUPPLEMENT_REQUESTED", "SCHEDULING"].includes(item.status);
  const waited = item.submittedAt ? Math.max(0, Math.floor((now - Date.parse(item.submittedAt)) / DAY)) : null;
  const due = item.dueDate ? Math.ceil((Date.parse(`${item.dueDate.slice(0, 10)}T23:59:59+09:00`) - now) / DAY) : null;
  let note = "";
  let late = false;
  switch (item.status) {
    case "DRAFT": note = "제출 전 · 작성 중"; break;
    case "SUBMITTED": case "RESUBMITTED": case "UNDER_REVIEW":
      note = `기관 검토 중 · ${waited ? `접수 ${waited}일째` : "오늘 접수"}`; late = (waited ?? 0) >= 4; break;
    case "SUPPLEMENT_REQUESTED": note = due != null ? `보완 기한 ${due < 0 ? `${-due}일 지남` : due === 0 ? "오늘" : `D-${due}`}` : "보완 자료 제출 필요"; late = due != null && due <= 1; break;
    case "SCHEDULING": note = "기관이 일정을 제안함 · 수락 필요"; break;
    case "CONFIRMED": note = item.nextTest ? `${Number(item.nextTest.startAt.slice(5, 7))}월 ${Number(item.nextTest.startAt.slice(8, 10))}일 시험 예정` : "예약 확정"; break;
    case "COMPLETED": note = "시험 완료"; break;
    default: note = "";
  }
  return { stageIndex, mine, note, late };
}

export function RequestProgress({ items, now, onOpen, actionLabel }: {
  items: ProgressItem[]; now: number;
  onOpen: (item: ProgressItem) => void;
  actionLabel: (item: ProgressItem) => string;
}) {
  const rows = items.map((item) => ({ item, ...progressOf(item, now) }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.late) - Number(a.late) || a.stageIndex - b.stageIndex);
  return (
    <ul className="progress-list">
      {rows.map(({ item, stageIndex, mine, note, late }, index) => (
        <li key={item.requestId} style={{ "--i": Math.min(index, 8) } as CSSProperties}>
          <button type="button" className={`progress-row${mine ? " is-mine" : ""}`} onClick={() => onOpen(item)}>
            <span className="progress-row__main">
              <strong>{item.title}</strong>
              <small>{[item.requestNo, item.institutionName].filter(Boolean).join(" · ")}</small>
            </span>
            <span className="progress-row__track">
              <span className="progress-steps" role="img"
                aria-label={stageIndex < 0 ? "제출 전" : `${TRACK.length}단계 중 ${stageIndex + 1}단계 ${TRACK[stageIndex].label}`}>
                {TRACK.map((stage, i) => (
                  <i key={stage.key} className={i < stageIndex ? "is-done" : i === stageIndex ? `is-now${mine ? " is-mine" : ""}${late ? " is-late" : ""}` : ""} />
                ))}
              </span>
              <span className="progress-row__note">
                <b>{stageIndex < 0 ? "작성 중" : TRACK[stageIndex].label}</b>{note && ` · ${note}`}
              </span>
            </span>
            <span className="progress-row__who">
              {late ? <Badge tone="red">지연</Badge> : mine ? <Badge tone="amber">내 차례</Badge> : <Badge tone="neutral">기관 처리</Badge>}
            </span>
            <span className="dash-row__cta">{actionLabel(item)}<ArrowRight size={14} aria-hidden="true" /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}
