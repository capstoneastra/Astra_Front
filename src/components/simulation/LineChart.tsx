import { useRef, useState } from "react";
import type { PointerEvent } from "react";

/**
 * 가벼운 SVG 선 그래프 (라이브러리 없이).
 * - 한 개의 y축만 사용, 가는 선(2px), 옅은 격자
 * - 기준선(장비 한계)은 점선 + 글자 라벨로 표시해 색만으로 의미를 전달하지 않음
 * - 마우스를 올리면 세로 보조선과 값 툴팁
 */
export interface LimitLine { y: number; label: string; tone?: "limit" | "ok" }
export function LineChart({ points, xLabel, yLabel, xLog = false, yLog = false, limits = [], format, height = 250, ariaLabel, xFormat }: {
  points: { x: number; y: number }[];
  xLabel: string; yLabel: string; xLog?: boolean; yLog?: boolean;
  limits?: LimitLine[];
  format: (y: number) => string;
  xFormat?: (x: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const box = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 760, H = height, L = 58, R = 14, T = 16, B = 40;
  const tx = (v: number) => (xLog ? Math.log10(v) : v);
  const ty = (v: number) => (yLog ? Math.log10(Math.max(v, 1e-6)) : v);
  const xs = points.map((p) => tx(p.x));
  const ys = [...points.map((p) => ty(p.y)), ...limits.map((l) => ty(l.y))];
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.12 || 1;
  y0 -= pad; y1 += pad;
  const px = (v: number) => L + ((tx(v) - x0) / (x1 - x0 || 1)) * (W - L - R);
  const py = (v: number) => T + (1 - (ty(v) - y0) / (y1 - y0 || 1)) * (H - T - B);
  const d = points.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join("");
  const ticks = (a: number, b: number, log: boolean) => {
    if (log) { const out: number[] = []; for (let e = Math.ceil(a); e <= Math.floor(b); e += 1) out.push(10 ** e); return out; }
    const step = niceStep((b - a) / 4); const out: number[] = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(6)); return out;
  };
  const xt = ticks(x0, x1, xLog), yt = ticks(y0, y1, yLog);
  const fx = xFormat ?? ((v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)));
  const onMove = (event: PointerEvent) => {
    const rect = box.current?.getBoundingClientRect(); if (!rect) return;
    const sx = ((event.clientX - rect.left) / rect.width) * W;
    let best = 0, dist = Infinity;
    points.forEach((p, i) => { const dd = Math.abs(px(p.x) - sx); if (dd < dist) { dist = dd; best = i; } });
    setHover(best);
  };
  const hp = hover != null ? points[hover] : null;
  return (
    <div className="line-chart">
      <svg ref={box} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {yt.map((v) => <g key={`y${v}`}><line x1={L} x2={W - R} y1={py(v)} y2={py(v)} className="line-chart__grid" /><text x={L - 8} y={py(v) + 4} textAnchor="end" className="line-chart__tick">{format(v)}</text></g>)}
        {xt.map((v) => <text key={`x${v}`} x={px(v)} y={H - B + 18} textAnchor="middle" className="line-chart__tick">{fx(v)}</text>)}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="line-chart__axis" />
        {limits.map((l) => (
          <g key={l.label} className={`line-chart__limit line-chart__limit--${l.tone ?? "limit"}`}>
            <line x1={L} x2={W - R} y1={py(l.y)} y2={py(l.y)} />
            <text x={W - R - 4} y={py(l.y) - 6} textAnchor="end">{l.label}</text>
          </g>
        ))}
        <path d={d} className="line-chart__line" pathLength={1} />
        {hp && <>
          <line x1={px(hp.x)} x2={px(hp.x)} y1={T} y2={H - B} className="line-chart__cross" />
          <circle cx={px(hp.x)} cy={py(hp.y)} r={4.5} className="line-chart__dot" />
        </>}
        <text x={L} y={H - 4} className="line-chart__label">{xLabel}</text>
        <text x={12} y={T + 2} className="line-chart__label" transform={`rotate(-90 12 ${T + 2})`} textAnchor="end">{yLabel}</text>
      </svg>
      {hp && (
        <span className="line-chart__tip" style={{ left: `${(px(hp.x) / W) * 100}%`, top: `${(py(hp.y) / H) * 100}%` }}>
          {fx(hp.x)} · <b>{format(hp.y)}</b>
        </span>
      )}
    </div>
  );
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
