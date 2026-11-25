import { useState } from "react";
import type { CSSProperties } from "react";
import { useWorkspace } from "../../context/AppContext";
import { useApiQuery } from "../../hooks/useApiQuery";
import { catalogService } from "../../services/catalogService";
import { requestService } from "../../services/requestService";
import type { DashboardSummary, RequestStatus } from "../../services/dashboardService";
import type { BarRow } from "./BarChart";
import { STAGES } from "./DashboardParts";

/**
 * 관리자 통계 계산 — 대시보드 요약 카드와 '운영 통계' 화면이 같은 숫자를 쓰도록 한 곳에서 계산합니다.
 * (백엔드 집계 API 가 생기면 이 훅만 교체하면 됩니다.)
 */
export function useAdminInsights(enabled = true) {
  const { equipmentList, catalogQuery } = useWorkspace();
  const types = useApiQuery((signal) => catalogService.testTypes(signal), "test-types", enabled);
  const requests = useApiQuery((signal) => requestService.list({ size: 100 }, signal), "admin-insight-requests", enabled);

  const demand = new Map<string, number>();
  for (const item of requests.data?.content ?? []) {
    if (["DRAFT", "CANCELED"].includes(item.status)) continue;
    const code = item.revision?.content?.test?.testTypeCode;
    if (code) demand.set(code, (demand.get(code) ?? 0) + 1);
  }
  const ratioRows = (types.data ?? [])
    .map((type) => {
      const count = demand.get(type.code) ?? 0;
      const machines = type.equipmentCount ?? equipmentList.filter((e) => e.testTypes.includes(type.code)).length;
      return { type, count, machines, ratio: machines ? count / machines : count ? Infinity : 0 };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.ratio - a.ratio);
  const top = Math.max(1, ...ratioRows.filter((r) => Number.isFinite(r.ratio)).map((r) => r.ratio));
  const demandBars: BarRow[] = ratioRows.map((row) => ({
    key: row.type.code,
    label: row.type.nameKo,
    value: Number.isFinite(row.ratio) ? row.ratio : top,
    display: Number.isFinite(row.ratio) ? `${row.ratio.toFixed(1)}건` : "장비 없음",
    detail: `의뢰 ${row.count}건 · 등록 장비 ${row.machines}대`,
    emphasis: !Number.isFinite(row.ratio) || row.ratio >= 1.5,
    flag: Number.isFinite(row.ratio) && row.ratio >= 1.5 ? "부족" : undefined,
  }));

  const regions = new Map<string, number>();
  for (const item of equipmentList) regions.set(item.region || "미등록", (regions.get(item.region || "미등록") ?? 0) + 1);
  const regionBars: BarRow[] = [...regions].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([region, count]) => ({
    key: region, label: region, value: count, display: `${count}대`,
    detail: `보유 기관·대학 ${new Set(equipmentList.filter((e) => (e.region || "미등록") === region).map((e) => e.institutionId)).size}곳`,
  }));

  return { types, requests, catalogQuery, demandBars, top, regionBars };
}

const STAGE_TONE: Record<string, string> = { draft: "muted", review: "blue", supplement: "amber", scheduling: "violet", confirmed: "cyan", completed: "green" };

/** 의뢰가 어느 단계에 몰려 있는지 — 한 줄 누적 막대 + 범례(이름·건수 표기, 색만으로 구분하지 않음) */
export function FlowStack({ counts }: { counts: Record<RequestStatus, number> | null }) {
  const [hover, setHover] = useState<string | null>(null);
  const stages = STAGES.map((stage) => ({ ...stage, value: counts ? stage.statuses.reduce((s, x) => s + counts[x], 0) : 0 }));
  const total = stages.reduce((s, x) => s + x.value, 0);
  if (!counts || !total) return <p className="dash-empty">집계할 의뢰가 없습니다.</p>;
  const busiest = [...stages].filter((s) => !["draft", "completed"].includes(s.key)).sort((a, b) => b.value - a.value)[0];
  return (
    <div className="flow-stack">
      <p className="insight__number"><b>{total}</b>건 <small>중 <em>{busiest.label}</em> 단계가 가장 많음 ({busiest.value}건)</small></p>
      <div className="flow-stack__bar" role="img" aria-label={stages.map((s) => `${s.label} ${s.value}건`).join(", ")}>
        {stages.filter((s) => s.value).map((s, i) => (
          <i key={s.key} className={`tone-${STAGE_TONE[s.key]}${hover && hover !== s.key ? " is-dim" : ""}`}
            style={{ flexGrow: s.value, "--i": i } as CSSProperties} title={`${s.label} ${s.value}건 (${Math.round((s.value / total) * 100)}%)`}
            onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} />
        ))}
      </div>
      <ul className="flow-stack__legend">
        {stages.map((s) => (
          <li key={s.key} className={hover === s.key ? "is-hover" : undefined} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <i className={`tone-${STAGE_TONE[s.key]}`} aria-hidden="true" />{s.label}<b>{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 장비 정보 검증률 — 링 게이지 */
export function VerificationRing({ summary }: { summary?: DashboardSummary }) {
  const list = summary?.institutionVerification ?? [];
  const total = list.reduce((s, i) => s + i.equipmentCount, 0);
  const verified = list.reduce((s, i) => s + i.verifiedCount, 0);
  if (!total) return <p className="dash-empty">검증할 장비가 없습니다.</p>;
  const rate = Math.round((verified / total) * 100);
  const lowest = [...list].filter((i) => i.equipmentCount).sort((a, b) => a.verifiedCount / a.equipmentCount - b.verifiedCount / b.equipmentCount)[0];
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 84 84" width="84" height="84" role="img" aria-label={`장비 정보 검증률 ${rate}%`}>
        <circle cx="42" cy="42" r={r} className="ring__track" />
        <circle cx="42" cy="42" r={r} className="ring__value" style={{ "--c": c, "--v": c * (1 - rate / 100) } as CSSProperties}
          strokeDasharray={c} transform="rotate(-90 42 42)" />
        <text x="42" y="47" textAnchor="middle">{rate}%</text>
      </svg>
      <div className="ring__text">
        <p className="insight__number"><b>{verified}</b><small> / {total}대 검증</small></p>
        <p>미검증 <b>{total - verified}</b>대</p>
        {lowest && <p>가장 낮은 곳: {lowest.name} ({Math.round((lowest.verifiedCount / lowest.equipmentCount) * 100)}%)</p>}
      </div>
    </div>
  );
}
