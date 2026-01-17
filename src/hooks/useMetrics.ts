'use client';

import useSWR from 'swr';
import type { MetricsResponse } from '@/types/metrics';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch metrics');
  }
  return response.json();
};

/**
 * Hook to fetch dashboard metrics with automatic refresh.
 * @param environment - 'prod' or 'test'
 * @param timeRange - Time range string (e.g., '24h', '7d')
 */
export function useMetrics(
  environment: 'prod' | 'test' = 'prod',
  timeRange: string = '24h'
) {
  const { data, error, isLoading, mutate } = useSWR<MetricsResponse>(
    `/api/metrics?env=${environment}&range=${timeRange}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
      dedupingInterval: 30000, // Dedup within 30s window
    }
  );

  const refresh = () => mutate();

  return {
    data,
    error,
    isLoading,
    refresh,
  };
}

// Re-export types for convenience
export type { MetricsResponse };
