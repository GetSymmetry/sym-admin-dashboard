'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

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
