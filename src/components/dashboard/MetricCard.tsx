'use client';

import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  format?: 'number' | 'currency' | 'percent' | 'raw';
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  format = 'number',
  trend,
  trendLabel,
  icon: Icon,
  iconColor = 'text-brand-blue',
  className,
}: MetricCardProps) {
  const formattedValue = (() => {
    if (typeof value === 'string') return value;
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return `${value.toFixed(1)}%`;
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
    <div
      className={cn(
        'bg-surface rounded-card border border-border-subtle shadow-card p-4',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-body-small font-medium text-text-muted">{title}</span>
        {Icon && (
          <div className={cn('p-2 rounded-sds-200 bg-surface-tertiary', iconColor)}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono tracking-tight text-text-primary metric-value">
            {formattedValue}
          </span>
          {trend !== undefined && TrendIcon && (
            <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
              <TrendIcon size={14} />
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {(subtitle || trendLabel) && (
          <p className="text-body-xs text-text-muted">
            {subtitle || trendLabel}
          </p>
        )}
      </div>
    </div>
  );
}
