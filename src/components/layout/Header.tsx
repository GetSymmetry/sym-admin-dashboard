'use client';

import { RefreshCw, Clock, Globe, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeRangeSelector } from '@/components/ui/TimeRangeSelector';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  environment: 'prod' | 'test';
  lastUpdated?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
  showTimeRange?: boolean;
  region?: string;
  onRegionChange?: (region: string) => void;
  availableRegions?: string[];
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
  region = 'centralus',
  onRegionChange,
  availableRegions = ['centralus'],
}: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

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
        {/* Region selector */}
        {onRegionChange && availableRegions.length > 0 && (
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-text-muted" />
            <select
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="px-2 py-1.5 text-body-small bg-surface-tertiary border border-border-subtle rounded-sds-100 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {availableRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

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
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-body-small font-medium rounded-sds-200 transition-all duration-200 text-text-muted hover:text-status-error hover:bg-status-error/5"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
