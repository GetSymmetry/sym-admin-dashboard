'use client';

import { RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeRangeSelector } from '@/components/ui/TimeRangeSelector';

interface HeaderProps {
  title: string;
  environment: 'prod' | 'test';
  lastUpdated?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
  showTimeRange?: boolean;
}

export function Header({
  title,
  environment,
  lastUpdated,
  onRefresh,
  isRefreshing,
  timeRange = '24h',
  onTimeRangeChange,
  showTimeRange = true,
}: HeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border-subtle bg-surface-secondary">
      <div className="flex items-center gap-4">
        <h1 className="text-subheading font-semibold text-text-primary">{title}</h1>
        <span
          className={cn(
            'px-3 py-1 text-body-xs font-bold rounded-full border',
            environment === 'prod'
              ? 'bg-status-error/10 text-status-error border-status-error'
              : 'bg-status-success/10 text-status-success border-status-success'
          )}
        >
          {environment.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {showTimeRange && onTimeRangeChange && (
          <TimeRangeSelector
            value={timeRange}
            onChange={onTimeRangeChange}
          />
        )}

        {lastUpdated && (
          <div className="flex items-center gap-2 text-body-small text-text-muted">
            <Clock size={14} />
            <span>Updated {lastUpdated}</span>
          </div>
        )}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-body-small font-medium rounded-sds-200 transition-all duration-200',
            'bg-surface-tertiary text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            'border border-border-subtle hover:border-border',
            isRefreshing && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw
            size={16}
            className={cn(isRefreshing && 'animate-spin')}
          />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
