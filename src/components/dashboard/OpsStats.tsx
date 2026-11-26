import { useState } from "react";
import type { CSSProperties } from "react";
import { useWorkspace } from "../../context/AppContext";
import { useApiQuery } from "../../hooks/useApiQuery";
import { requestService } from "../../services/requestService";
import { adminService } from "../../services/adminService";
import type { RequestSummary } from "../../services/contracts";
import { Section, Skeleton } from "./DashboardParts";
import BarChart from "./BarChart";
import type { BarRow } from "./BarChart";
import ApiState from "../ui/ApiState";

/*
 * 운영 통계 (11/26 추가): 의뢰 흐름 · 기관 운영 · 장비 · 회원
 * 모두 지금 있는 API(의뢰 목록, 회원 목록, 장비 목록)로 화면에서 계산합니다. 백엔드 집계 API 가 생기면 여기만 바꾸면 됩니다.
 */

const DAY = 86_400_000;
const KST = 9 * 3600_000;
/** 기관이 다음 행동을 해야 하는 단계 (오래 기다리면 관리자가 확인할 대상) */
const WAITING_ON_PROVIDER = ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW", "SCHEDULING"];
const OPEN = [...WAITING_ON_PROVIDER, "SUPPLEMENT_REQUESTED", "CONFIRMED"];
const waitingLabel: Record<string, string> = { SUBMITTED: "검토 대기", RESUBMITTED: "재제출 검토", UNDER_REVIEW: "검토 중", SCHEDULING: "일정 협의" };
const monthKey = (iso: string) => new Date(Date.parse(iso) + KST).toISOString().slice(0, 7);
const submittedOf = (r: RequestSummary) => r.submittedAt ?? null;

function useOpsData() {
  const requests = useApiQuery((signal) => requestService.list({ size: 100 }, signal), "admin-insight-requests");
  const users = useApiQuery((signal) => adminService.users({ size: 100 }, signal), "admin-users:all-stats");
  const [now] = useState(() => Date.now());
  return { requests, users, now, rows: (requests.data?.content ?? []) as (RequestSummary & { companyName?: string })[] };
}

/** 위 줄 숫자 카드 4장: 전체 의뢰 · 이번 달 접수 · 반려·취소율 · 회원 */
export function OpsKpis() {
  const { requests, users, now, rows } = useOpsData();
  const submitted = rows.filter((r) => r.status !== "DRAFT");
  const thisMonth = monthKey(new Date(now).toISOString());
  const lastMonth = monthKey(new Date(Date.parse(`${thisMonth}-01T00:00:00+09:00`) - DAY).toISOString());
  const monthCount = (key: string) => submitted.filter((r) => submittedOf(r) && monthKey(submittedOf(r)!) === key).length;
  const closedBad = submitted.filter((r) => ["REJECTED", "CANCELED"].includes(r.status)).length;
  const members = users.data?.content ?? [];
  const active = members.filter((m) => m.status === "ACTIVE").length;
  const pending = members.filter((m) => m.status === "PENDING").length;
  const diff = monthCount(thisMonth) - monthCount(lastMonth);
  const cards = [
    { label: "전체 의뢰", value: requests.data ? submitted.length : null, hint: requests.data ? `진행 중 ${submitted.filter((r) => OPEN.includes(r.status)).length}건` : "" },
    { label: "이번 달 접수", value: requests.data ? monthCount(thisMonth) : null,
      hint: requests.data ? (diff === 0 ? "지난달과 같음" : `지난달보다 ${Math.abs(diff)}건 ${diff > 0 ? "많음" : "적음"}`) : "" },
    { label: "반려·취소율", value: requests.data ? (submitted.length ? Math.round((closedBad / submitted.length) * 100) : 0) : null, unit: "%",
      hint: requests.data ? `반려·취소 ${closedBad}건` : "" },
    { label: "이용 중인 회원", value: users.data ? active : null, hint: users.data ? `승인 대기 ${pending}명` : "" },
  ];
  if (requests.error) return <ApiState error={requests.error} onRetry={requests.reload} />;
  return (
    <div className="ops-kpis" aria-label="운영 요약">
      {cards.map((card) => (
        <div key={card.label} className="ops-kpi">
          <span>{card.label}</span>
          <strong>{card.value == null ? "–" : card.value.toLocaleString("ko-KR")}{card.value != null && card.unit && <small>{card.unit}</small>}</strong>
          <small>{card.hint}</small>
        </div>
      ))}
    </div>
  );
}

/** 월별 접수 추이 (최근 6개월, 세로 막대) */
export function MonthlyTrend() {
  const { requests, now, rows } = useOpsData();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now + KST);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const counts = months.map((key) => rows.filter((r) => r.status !== "DRAFT" && submittedOf(r) && monthKey(submittedOf(r)!) === key).length);
  const max = Math.max(1, ...counts);
  return (
    <Section title="월별 의뢰 접수" className="dash-chart">
      <p className="dash-chart__caption">최근 6개월 동안 제출된 의뢰 수 (작성 중 제외)</p>
      {requests.loading ? <Skeleton rows={3} /> : (
        <ol className="ops-columns" aria-label="월별 의뢰 접수 수">
          {months.map((key, i) => (
            <li key={key} title={`${Number(key.slice(5))}월 ${counts[i]}건`} style={{ "--i": i } as CSSProperties}>
              <b>{counts[i]}</b>
              <span className="ops-columns__track"><i style={{ height: `${Math.max(counts[i] ? 6 : 2, (counts[i] / max) * 100)}%` }} /></span>
              <small>{Number(key.slice(5))}월</small>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** 오래 기다리는 의뢰: 기관이 처리할 차례인데 접수 후 며칠이 지났는지 */
export function WaitingRequests({ onOpen }: { onOpen: (id: number) => void }) {
  const { requests, now, rows } = useOpsData();
  const waiting = rows.filter((r) => WAITING_ON_PROVIDER.includes(r.status))
    .map((r) => ({ r, days: Math.floor((now - Date.parse((r as { updatedAt?: string | null }).updatedAt ?? submittedOf(r) ?? r.createdAt ?? new Date(now).toISOString())) / DAY) }))
    .sort((a, b) => b.days - a.days);
  const buckets = [
    { label: "3일 이하", value: waiting.filter((w) => w.days <= 3).length, tone: "" },
    { label: "4~7일", value: waiting.filter((w) => w.days >= 4 && w.days <= 7).length, tone: "is-warn" },
    { label: "7일 넘음", value: waiting.filter((w) => w.days > 7).length, tone: "is-late" },
  ];
  return (
    <Section title="오래 기다리는 의뢰" count={requests.data ? waiting.length : undefined} className="dash-chart">
      <p className="dash-chart__caption">시험기관이 처리할 차례인 의뢰 (마지막 변경 후 지난 날짜)</p>
      {requests.loading ? <Skeleton rows={4} /> : <>
        <div className="ops-buckets">
          {buckets.map((b) => <span key={b.label} className={b.tone}><b>{b.value}</b>{b.label}</span>)}
        </div>
        {waiting.length ? <ul className="ops-list">
          {waiting.slice(0, 6).map(({ r, days }) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)}>
                <span className="ops-list__main">
                  <strong>{r.title || r.requestNo}</strong>
                  <small>{[r.institution?.name, waitingLabel[r.status]].filter(Boolean).join(", ")}</small>
                </span>
                <span className={`ops-list__days${days > 7 ? " is-late" : days >= 4 ? " is-warn" : ""}`}>{days}일</span>
              </button>
            </li>
          ))}
        </ul> : <p className="dash-empty">기관이 처리할 의뢰가 없습니다.</p>}
      </>}
    </Section>
  );
}

/** 기관별 처리 현황: 받은 의뢰 · 진행 중 · 완료 · 반려 */
export function InstitutionLoad() {
  const { requests, rows } = useOpsData();
  const map = new Map<string, { name: string; total: number; open: number; done: number; rejected: number }>();
  for (const r of rows) {
    if (r.status === "DRAFT" || !r.institution?.name) continue;
    const row = map.get(r.institution.name) ?? { name: r.institution.name, total: 0, open: 0, done: 0, rejected: 0 };
    row.total += 1;
    if (OPEN.includes(r.status)) row.open += 1;
    if (r.status === "COMPLETED") row.done += 1;
    if (r.status === "REJECTED") row.rejected += 1;
    map.set(r.institution.name, row);
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total);
  return (
    <Section title="기관별 처리 현황" count={requests.data ? list.length : undefined} className="dash-chart">
      <p className="dash-chart__caption">어느 기관에 의뢰가 몰리는지, 처리가 끝나지 않은 의뢰가 얼마나 남았는지</p>
      {requests.loading ? <Skeleton rows={4} /> : list.length ? (
        <table className="ops-table">
          <thead><tr><th>시험기관</th><th>받은 의뢰</th><th>진행 중</th><th>완료</th><th>반려</th></tr></thead>
          <tbody>{list.slice(0, 8).map((row) => (
            <tr key={row.name}>
              <td title={row.name}>{row.name}</td>
              <td><b>{row.total}</b></td>
              <td className={row.open ? "is-open" : ""}>{row.open}</td>
              <td>{row.done}</td>
              <td>{row.rejected}</td>
            </tr>
          ))}</tbody>
        </table>
      ) : <p className="dash-empty">아직 접수된 의뢰가 없습니다.</p>}
    </Section>
  );
}

/** 장비 찾기·보유 장비 관리와 같은 이름 */
const availabilityLabels: Record<string, string> = {
  AVAILABLE: "이용 가능", LIMITED: "일정 제한", BUSY: "사용 중", MAINTENANCE: "점검 중", UNAVAILABLE: "이용 불가", UNKNOWN: "정보 없음",
};
const AVAILABILITY_ORDER: { key: string; tone: string }[] = [
  { key: "AVAILABLE", tone: "tone-green" },
  { key: "LIMITED", tone: "tone-amber" },
  { key: "BUSY", tone: "tone-blue" },
  { key: "MAINTENANCE", tone: "tone-red" },
  { key: "UNAVAILABLE", tone: "tone-violet" },
  { key: "UNKNOWN", tone: "tone-muted" },
];

/** 장비 가용 상태 분포: 한 줄 누적 막대 + 이름·대수 범례 (색만으로 구분하지 않음) */
export function AvailabilityMix() {
  const { equipmentList, catalogQuery } = useWorkspace();
  const total = equipmentList.length;
  const parts = AVAILABILITY_ORDER.map((p) => ({ ...p, value: equipmentList.filter((e) => (e.availability ?? "UNKNOWN") === p.key).length }))
    .filter((p) => p.value > 0);
  const known = total - (parts.find((p) => p.key === "UNKNOWN")?.value ?? 0);
  return (
    <Section title="장비 가용 상태" className="dash-chart">
      <p className="dash-chart__caption">등록 장비 {total.toLocaleString("ko-KR")}대 중 가용 상태를 아는 장비 {known}대</p>
      {catalogQuery.loading ? <Skeleton rows={2} /> : total ? (
        <div className="flow-stack">
          <div className="flow-stack__bar" role="img" aria-label={parts.map((p) => `${availabilityLabels[p.key] ?? p.key} ${p.value}대`).join(", ")}>
            {parts.map((p, i) => <i key={p.key} className={p.tone} style={{ flexGrow: p.value, "--i": i } as CSSProperties}
              title={`${availabilityLabels[p.key] ?? p.key} ${p.value}대 (${Math.round((p.value / total) * 100)}%)`} />)}
          </div>
          <ul className="flow-stack__legend">
            {parts.map((p) => <li key={p.key}><i className={p.tone} aria-hidden="true" />{availabilityLabels[p.key] ?? p.key}<b>{p.value}</b></li>)}
          </ul>
        </div>
      ) : <p className="dash-empty">등록된 장비가 없습니다.</p>}
    </Section>
  );
}

/** 가동률 높은 장비 상위 5 */
export function BusiestEquipment() {
  const { equipmentList, catalogQuery } = useWorkspace();
  const rows: BarRow[] = equipmentList
    .filter((e) => typeof e.utilizationRate === "number")
    .sort((a, b) => (b.utilizationRate ?? 0) - (a.utilizationRate ?? 0)).slice(0, 5)
    .map((e) => {
      const rate = (e.utilizationRate ?? 0) <= 1 ? (e.utilizationRate ?? 0) * 100 : (e.utilizationRate ?? 0);
      return { key: String(e.id), label: e.name, value: rate, display: `${Math.round(rate)}%`, detail: [e.institution, e.region].filter(Boolean).join(", "),
        emphasis: rate >= 80, flag: rate >= 80 ? "포화" : undefined };
    });
  return (
    <Section title="가동률 높은 장비" className="dash-chart">
      <p className="dash-chart__caption">가동률 80% 이상은 예약이 어려운 장비입니다. 같은 시험이 되는 다른 장비를 안내하세요.</p>
      {catalogQuery.loading ? <Skeleton rows={4} /> : <BarChart rows={rows} max={100} ariaLabel="가동률 상위 장비" empty="가동률 정보가 있는 장비가 없습니다." />}
    </Section>
  );
}
