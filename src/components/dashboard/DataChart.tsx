import { EmptyState } from "../ui";
export interface ChartItem { label: string; value: number; color: string }
export default function DataChart({ items, label, kind = "donut", unit = "건" }: { items: ChartItem[]; label: string; kind?: "donut" | "bars"; unit?: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const maximum = Math.max(...items.map(item => item.value), 1);
  if (!total) return <EmptyState title="집계할 데이터가 없습니다" description="데이터가 등록되면 분포가 표시됩니다." />;
  return <div className={`data-chart data-chart--${kind}`} role="group" aria-label={label}>
    {kind === "donut" && <div className="data-chart__orbit"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="61" fill="none" stroke="currentColor" strokeWidth="12" className="data-chart__track" />{items.map((item, index) => {
      if (item.value === 0) return null;
      const fraction = item.value / total, position = items.slice(0, index).reduce((sum, previous) => sum + previous.value, 0) / total;
      return <circle key={item.label} cx="80" cy="80" r="61" fill="none" stroke={item.color} strokeWidth="12" pathLength="100" strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-position * 100} transform="rotate(-90 80 80)" />;
    })}<circle cx="80" cy="80" r="47" className="data-chart__inner" fill="none" stroke="currentColor" strokeDasharray="2 6" /></svg><div><strong>{total.toLocaleString("ko-KR")}</strong><span>합계 ({unit})</span></div></div>}
    <ul className="data-chart__legend">{items.map(item => <li key={item.label}><div><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value.toLocaleString("ko-KR")}<small>{unit}</small></strong></div>{kind === "bars" && <span className="data-chart__bar"><i style={{ width: `${item.value / maximum * 100}%`, background: item.color }} /></span>}</li>)}</ul>
  </div>;
}
