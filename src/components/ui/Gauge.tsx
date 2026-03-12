type SimpleThresholds = { warning: number; error: number };
type GradientThreshold = { value: number; color: string };

interface GaugeProps {
  value: number; // 0-100
  max?: number;  // Scale denominator (default 100)
  label?: string;
  size?: number;
  color?: string; // Direct color override (bypasses thresholds)
  thresholds?: SimpleThresholds | GradientThreshold[];
}

function resolveColor(value: number, thresholds: SimpleThresholds | GradientThreshold[]): string {
  if (Array.isArray(thresholds)) {
    // Gradient thresholds: sorted descending by value, first match wins
    const sorted = [...thresholds].sort((a, b) => b.value - a.value);
    for (const t of sorted) {
      if (value >= t.value) return t.color;
    }
    return sorted[sorted.length - 1]?.color ?? "var(--color-status-success)";
  }
  return value >= thresholds.error
    ? "var(--color-status-error)"
    : value >= thresholds.warning
      ? "var(--color-status-warning)"
      : "var(--color-status-success)";
}

export function Gauge({ value, max = 100, label, size = 120, color: colorOverride, thresholds = { warning: 70, error: 90 } }: GaugeProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const arcColor = colorOverride ?? resolveColor(pct, thresholds);
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border)" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={arcColor} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)" className="transition-all duration-500" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          className="text-title-page font-semibold" fill="var(--color-text-primary)">
          {Math.round(pct)}%
        </text>
      </svg>
      {label && <p className="text-body-small text-text-secondary mt-sds-100">{label}</p>}
    </div>
  );
}
