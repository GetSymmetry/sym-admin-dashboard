'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { debuggerClient } from '@/lib/api/client';

export type Environment = 'prod' | 'test';

interface DashboardState {
  environment: Environment;
  timeRange: string;
  setEnvironment: (env: Environment) => void;
  setTimeRange: (range: string) => void;
}

/**
 * Hook to manage dashboard state via URL query parameters.
 * State persists across page navigations and refreshes.
 */
export function useDashboardState(): DashboardState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read state from URL params with defaults
  const environment = (searchParams.get('env') as Environment) || 'prod';
  const timeRange = searchParams.get('range') || '24h';

  // Helper to update URL params
  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        params.set(key, value);
      });
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const setEnvironment = useCallback(
    (env: Environment) => {
      updateParams({ env });
    },
    [updateParams]
  );

  const setTimeRange = useCallback(
    (range: string) => {
      updateParams({ range });
    },
    [updateParams]
  );

  return useMemo(
    () => ({
      environment,
      timeRange,
      setEnvironment,
      setTimeRange,
    }),
    [environment, timeRange, setEnvironment, setTimeRange]
  );
}

/* ─── Debugger-oriented state (region + time range) ─── */

export type TimeRangeKey = '1h' | '6h' | '24h' | '7d' | '30d';

const TIME_RANGE_LABELS: Record<TimeRangeKey, string> = {
  '1h': 'Last 1 hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

export function useDebuggerDashboardState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const region = searchParams.get('region') || 'centralus';
  const timeRange = (searchParams.get('timeRange') as TimeRangeKey) || '24h';

  // Keep debugger client region in sync
  debuggerClient.setRegion(region);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  return {
    region,
    setRegion: (r: string) => {
      debuggerClient.setRegion(r);
      setParam('region', r);
    },
    timeRange,
    timeRangeLabel: TIME_RANGE_LABELS[timeRange],
    setTimeRange: (t: string) => setParam('timeRange', t),
    availableRegions: ['centralus'],
    timeRangeOptions: TIME_RANGE_LABELS,
  };
}
