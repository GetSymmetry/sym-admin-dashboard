'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { useDashboardState } from './useDashboardState';
import type { MetricsResponse, DatabaseMetricsResponse, LLMMetricsResponse } from '@/types/metrics';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${url}`);
  }
  return response.json();
};

/**
 * Unified hook for fetching all dashboard data.
 * Uses SWR for automatic deduplication - if multiple components
 * call this hook, only one network request is made.
 * 
 * Best Practice: SWR automatic deduplication (Rule 4.2)
 */
export function useDashboardData() {
  const { environment, timeRange } = useDashboardState();

  // Metrics (overview page)
  const metrics = useSWR<MetricsResponse>(
    `/api/metrics?env=${environment}&range=${timeRange}`,
    fetcher,
    {
      refreshInterval: 60000, // 1 minute
      dedupingInterval: 30000, // 30s dedup window
      revalidateOnFocus: true,
    }
  );

  // Database metrics
  const database = useSWR<DatabaseMetricsResponse>(
    `/api/database?env=${environment}&range=${timeRange}`,
    fetcher,
    {
      refreshInterval: 60000,
      dedupingInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  // LLM metrics (doesn't depend on env, only range)
  const llm = useSWR<LLMMetricsResponse>(
    `/api/llm?range=${timeRange}`,
    fetcher,
    {
      refreshInterval: 60000,
      dedupingInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  // Errors
  const errors = useSWR(
    `/api/errors?env=${environment}&range=${timeRange}`,
    fetcher,
    {
      refreshInterval: 60000,
      dedupingInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  // Deployments (doesn't depend on range)
  const deployments = useSWR(
    `/api/deployments?env=${environment}`,
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes (less volatile)
      dedupingInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  // Combined refresh function
  const refresh = useCallback(() => {
    metrics.mutate();
    database.mutate();
    llm.mutate();
    errors.mutate();
    deployments.mutate();
  }, [metrics, database, llm, errors, deployments]);

  // Combined loading state
  const isLoading =
    metrics.isLoading ||
    database.isLoading ||
    llm.isLoading ||
    errors.isLoading ||
    deployments.isLoading;

  // Any error
  const hasError =
    metrics.error ||
    database.error ||
    llm.error ||
    errors.error ||
    deployments.error;

  return {
    // Individual data
    metrics: metrics.data,
    database: database.data,
    llm: llm.data,
    errors: errors.data,
    deployments: deployments.data,

    // Loading states
    isLoading,
    isLoadingMetrics: metrics.isLoading,
    isLoadingDatabase: database.isLoading,
    isLoadingLlm: llm.isLoading,
    isLoadingErrors: errors.isLoading,
    isLoadingDeployments: deployments.isLoading,

    // Errors
    hasError,
    metricsError: metrics.error,
    databaseError: database.error,
    llmError: llm.error,
    errorsError: errors.error,
    deploymentsError: deployments.error,

    // Actions
    refresh,
    refreshMetrics: () => metrics.mutate(),
    refreshDatabase: () => database.mutate(),
    refreshLlm: () => llm.mutate(),
    refreshErrors: () => errors.mutate(),
    refreshDeployments: () => deployments.mutate(),

    // State from URL
    environment,
    timeRange,
  };
}

// Re-export types for convenience
export type { MetricsResponse, DatabaseMetricsResponse, LLMMetricsResponse };
