import type { CSSProperties, ReactNode } from "react";
import type { RequestStatus } from "../../services/dashboardService";
import { Panel } from "../ui";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** 의뢰 진행 단계 — 실무자가 '지금 어디까지 왔는지' 한 줄로 보도록 상태를 묶습니다. */
export const STAGES: { key: string; label: string; statuses: RequestStatus[]; attention?: "requester" | "provider" }[] = [
  { key: "review", label: "접수·검토", statuses: ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"], attention: "provider" },
  { key: "supplement", label: "보완 요청", statuses: ["SUPPLEMENT_REQUESTED"], attention: "requester" },
  { key: "scheduling", label: "일정 협의", statuses: ["SCHEDULING"] },
  { key: "confirmed", label: "예약 확정", statuses: ["CONFIRMED"] },
  { key: "completed", label: "시험 완료", statuses: ["COMPLETED"] },
];

/** lead: 제목 바로 아래 고정 줄(요약 등) — 본문이 카드 안에서 스크롤돼도 따라 내려가지 않음 */
export function Section({ title, action, children, className = "", count, lead }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string; count?: number; lead?: ReactNode;
}) {
  return (
    <Panel className={`dash-section ${className}`} title={<>{title}{count != null && <span className="dash-section__count">{count}</span>}</>} action={action}>
      {lead && <div className="dash-section__lead">{lead}</div>}
      <div className="dash-section__body">{children}</div>
    </Panel>
  );
}

/** 빈 상태 — 카드 높이가 늘어나도 가운데에 자리 잡아 '비어 보이는' 느낌을 줄입니다. */
export function Empty({ children, icon: Icon = Inbox }: { children: ReactNode; icon?: LucideIcon }) {
  return <p className="dash-empty"><span className="dash-empty__icon" aria-hidden="true"><Icon size={18} /></span><span>{children}</span></p>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="dash-skeleton" aria-hidden="true">{Array.from({ length: rows }, (_, i) => <span key={i} />)}</div>;
}

export function Pipeline({ counts, audience, onOpen }: {
  counts: Record<RequestStatus, number> | null;
  audience: "requester" | "provider" | "admin";
  onOpen?: (status: RequestStatus) => void;
}) {
  const total = counts ? STAGES.reduce((sum, stage) => sum + stage.statuses.reduce((s, x) => s + counts[x], 0), 0) : 0;
  return (
    <ol className="pipeline" aria-label="의뢰 진행 단계">
      {STAGES.filter((stage) => audience !== "provider" || stage.key !== "draft").map((stage) => {
        const value = counts ? stage.statuses.reduce((sum, status) => sum + counts[status], 0) : null;
        const attention = Boolean(value) && stage.attention === audience;
        return (
          <li key={stage.key} className={`pipeline__step${attention ? " pipeline__step--attention" : ""}${value ? "" : " pipeline__step--empty"}`}>
            <button type="button" disabled={!value || !onOpen} onClick={() => onOpen?.(stage.statuses[0])}>
              <span className="pipeline__label">{stage.label}{attention && <i aria-label="처리 필요" />}</span>
              <strong>{value ?? "—"}</strong>
              <span className="pipeline__bar" style={{ "--share": total && value ? value / total : 0 } as CSSProperties} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

