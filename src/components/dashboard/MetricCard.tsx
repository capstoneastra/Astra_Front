import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  label,
  value,
  unit,
  description,
  icon: Icon,
  tone = "cyan",
  onClick,
  tag,
}: {
  label: string;
  value: string | number;
  unit?: string;
  description: string;
  icon: LucideIcon;
  tone?: string;
  onClick?: () => void;
  tag?: string;
}) {
  const content = (
    <>
      <div className="metric-card__top">
        <span>{label}</span>
        <span className="metric-card__icon">
          <Icon size={18} strokeWidth={1.6} />
        </span>
      </div>
      <div className="metric-card__value">
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
        <span>{unit}</span>
      </div>
      <div className="metric-card__bottom">
        <span>{description}</span>
        {tag && <small>{tag}</small>}
        {onClick && <ArrowUpRight size={14} aria-hidden="true" />}
      </div>
      <span className="metric-card__decoration" aria-hidden="true">
        <i />
      </span>
    </>
  );
  return onClick ? (
    <button className={`metric-card metric-card--${tone}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`metric-card metric-card--${tone}`}>{content}</div>
  );
}
