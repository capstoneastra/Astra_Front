import type { CSSProperties } from "react";

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** 막대 끝에 표시할 값 (없으면 value) */
  display?: string;
  /** 마우스를 올렸을 때 보여줄 설명 */
  detail?: string;
  /** 기준 이상으로 강조할 행 (예: 장비 부족) */
  emphasis?: boolean;
  /** 강조 이유를 글자로 표시 (색만으로 의미를 전달하지 않도록) */
  flag?: string;
}

/**
 * 단일 계열 가로 막대 차트. 차트 라이브러리 없이 HTML/CSS 로 그립니다.
 * - 막대는 순서대로 왼쪽에서 자라나고(transition 기반), 행에 올리면 설명이 나타납니다.
 * - 한 계열이라 범례 없이 제목이 의미를 설명합니다. 값 글자는 본문 색을 씁니다.
 */
export default function BarChart({ rows, max, ariaLabel, empty }: {
  rows: BarRow[];
  max?: number;
  ariaLabel: string;
  empty: string;
}) {
  if (!rows.length) return <p className="dash-empty">{empty}</p>;
  const top = Math.max(max ?? 0, ...rows.map((row) => row.value), 1);
  return (
    <div className="bar-chart">
      <ul className="bar-chart__rows" aria-label={ariaLabel}>
        {rows.map((row, index) => (
          <li key={row.key} className={`bar-chart__row${row.emphasis ? " is-emphasis" : ""}`} tabIndex={0}
            aria-label={`${row.label} ${row.display ?? row.value}${row.detail ? `, ${row.detail}` : ""}`}
            style={{ "--i": index } as CSSProperties}>
            <span className="bar-chart__label" title={row.label}>{row.label}</span>
            <span className="bar-chart__track">
              <i style={{ width: `${Math.max(2, (row.value / top) * 100)}%` }} />
            </span>
            <span className="bar-chart__value">
              {row.flag && <em className="bar-chart__flag">{row.flag}</em>}
              {row.display ?? row.value.toLocaleString("ko-KR")}
            </span>
            {row.detail && <span className="bar-chart__tip" role="tooltip">{row.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
