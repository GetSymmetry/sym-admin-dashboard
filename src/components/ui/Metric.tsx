'use client';

import { cn, formatNumber, formatCurrency, formatPercent, formatDuration } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricProps {
  label: string;
  value: number | string;
  format?: 'number' | 'currency' | 'percent' | 'duration' | 'raw';
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Metric({
  label,
  value,
  format = 'number',
  trend,
  trendLabel,
  icon,
  size = 'md',
  className,
}: MetricProps) {
  const formattedValue = (() => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return formatPercent(value);
      case 'duration':
        return formatDuration(value);
      case 'raw':
        return value.toString();
      default:
        return formatNumber(value);
    }
  })();

  const trendColor =
    trend === undefined
      ? 'text-text-muted'
      : trend > 0
      ? 'text-status-success'
      : trend < 0
      ? 'text-status-error'
      : 'text-text-muted';

  const TrendIcon =
    trend === undefined
      ? null
      : trend > 0
      ? TrendingUp
      : trend < 0
      ? TrendingDown
      : Minus;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-icon-muted">{icon}</span>}
        <span className="text-body-xs font-medium text-text-muted uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'font-mono font-semibold tracking-tight metric-value text-text-primary',
            size === 'sm' && 'text-xl',
            size === 'md' && 'text-3xl',
            size === 'lg' && 'text-5xl'
          )}
        >
          {formattedValue}
        </span>
        {trend !== undefined && TrendIcon && (
          <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
            <TrendIcon size={14} />
            <span>{Math.abs(trend).toFixed(1)}%</span>
            {trendLabel && (
              <span className="text-text-muted text-xs">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
