import { clsx } from "clsx";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label?: string };
  className?: string;
}

export function MetricCard({ label, value, trend, className }: MetricCardProps) {
  const trendColor = trend ? (trend.value > 0 ? "text-status-success" : trend.value < 0 ? "text-status-error" : "text-text-muted") : "";
  const TrendIcon = trend ? (trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus) : null;

  return (
    <div className={clsx("bg-surface rounded-sds-200 border border-border p-sds-400", className)}>
      <p className="text-body-small text-text-secondary mb-sds-100">{label}</p>
      <p className="text-title-page font-semibold text-text-primary">{value}</p>
      {trend && (
        <div className={clsx("flex items-center gap-1 mt-sds-100 text-body-small", trendColor)}>
          {TrendIcon && <TrendIcon size={14} />}
          <span>{trend.value > 0 ? "+" : ""}{trend.value}%</span>
          {trend.label && <span className="text-text-muted ml-1">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
