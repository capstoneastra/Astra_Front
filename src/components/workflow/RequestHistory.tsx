import type { CSSProperties } from "react";
import { ArrowRight, FileStack, History, UserRound } from "lucide-react";
import { Badge } from "../ui/index";
import ApiState from "../ui/ApiState";
import { requestStatusLabels, requestStatusTones, formatDate, valueText } from "../../domain/constants";
import type { NamedResource, RequestRevision } from "../../services/contracts";

interface HistoryEntry {
  id: number;
  fromStatus?: string | null;
  toStatus: string;
  createdAt: string;
  changedBy?: NamedResource | null;
  note?: string | null;
}
interface Query<T> { data: T | null; error: { message?: string; status?: number; code?: string } | null; loading: boolean; reload: () => void }

const label = (status?: string | null) => (status ? requestStatusLabels[status] ?? status : "");
const StatusBadge = ({ status }: { status: string }) => <Badge tone={requestStatusTones[status] ?? "neutral"}>{label(status)}</Badge>;

/**
 * 의뢰 상세 아래 '제출본·상태 변경 이력' (GET /test-requests/{id}/history · /revisions)
 * - 상태 변경: 최근 순 세로 타임라인 — 이전 → 이후 상태 배지, 시각·처리자, 메모는 따로 한 칸
 * - 제출본: 최신 순 카드 — 변경 요약, 조건·준비 완료일은 항목/값 격자
 */
export default function RequestHistory({ history, revisions }: { history: Query<HistoryEntry[]>; revisions: Query<RequestRevision[]> }) {
  const entries = [...(history.data ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const revs = [...(revisions.data ?? [])].sort((a, b) => b.revisionNo - a.revisionNo);
  const latestNo = revs[0]?.revisionNo;
  const error = history.error ?? revisions.error;

  return (
    <details className="request-history">
      <summary>
        제출본·상태 변경 이력
        {!error && history.data && revisions.data && (
          <span className="request-history__count">상태 변경 {entries.length} · 제출본 {revs.length}</span>
        )}
      </summary>
      {error ? (
        <ApiState error={error} onRetry={() => { history.reload(); revisions.reload(); }} />
      ) : history.loading || revisions.loading ? (
        <ApiState loading />
      ) : (
        <div className="request-history__body">
          <section className="request-history__group" aria-label="상태 변경 이력">
            <h4><History size={15} aria-hidden="true" /> 상태 변경 <small>최근 순</small></h4>
            {entries.length ? (
              <ol className="request-timeline">
                {entries.map((entry, i) => (
                  <li key={entry.id} className={i === 0 ? "is-latest" : undefined}
                    style={{ "--dot": `var(--${requestStatusTones[entry.toStatus] === "neutral" || !requestStatusTones[entry.toStatus] ? "text-muted" : requestStatusTones[entry.toStatus]})` } as CSSProperties}>
                    <div className="request-timeline__head">
                      <span className="request-timeline__change">
                        {entry.fromStatus ? <><StatusBadge status={entry.fromStatus} /><ArrowRight size={13} aria-label="에서" /></> : <span className="request-timeline__start">처음</span>}
                        <StatusBadge status={entry.toStatus} />
                      </span>
                      <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                    </div>
                    {entry.changedBy?.name && <p className="request-timeline__who"><UserRound size={12} aria-hidden="true" />{entry.changedBy.name}</p>}
                    {entry.note && <p className="request-timeline__note">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            ) : <p className="request-history__empty">아직 상태 변경 이력이 없습니다.</p>}
          </section>

          <section className="request-history__group" aria-label="제출본 이력">
            <h4><FileStack size={15} aria-hidden="true" /> 제출본 <small>최신 순</small></h4>
            {revs.length ? (
              <div className="request-revisions">
                {revs.map((revision) => {
                  // 제출본 목록 응답에는 내용(content)이 빠져 올 수 있다(서버가 요약만 줌). 있을 때만 그린다
                  const conditions = revision.content?.conditions ?? [];
                  const readyDate = revision.content?.sample ? revision.content.sample.readyDate ?? "미확인" : null;
                  return (
                    <article key={revision.revisionNo} className={`request-revision${revision.revisionNo === latestNo ? " is-latest" : ""}`}>
                      <header>
                        <strong>제출본 {revision.revisionNo}</strong>
                        {revision.revisionNo === latestNo && <Badge tone="cyan">현재</Badge>}
                        {revision.isAiGenerated && <Badge tone="violet">AI 초안 기반</Badge>}
                      </header>
                      <p className={`request-revision__summary${revision.changeSummary ? "" : " is-empty"}`}>
                        {revision.changeSummary || (revision.revisionNo === 1 ? "첫 제출본" : "변경 요약 없음")}
                      </p>
                      {(conditions.length > 0 || readyDate) && (
                        <dl className="request-revision__facts">
                          {conditions.map((c) => (
                            <div key={c.key}><dt>{c.label ?? c.key}</dt><dd>{valueText(c)}</dd></div>
                          ))}
                          {readyDate && <div><dt>준비 완료일</dt><dd>{readyDate}</dd></div>}
                        </dl>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : <p className="request-history__empty">제출본이 없습니다.</p>}
          </section>
        </div>
      )}
    </details>
  );
}
