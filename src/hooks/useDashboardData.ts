'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { useDashboardState } from './useDashboardState';
import type {
  MetricsResponse,
  DatabaseMetricsResponse,
  LLMMetricsResponse,
  ContainerAppsResponse,
  Neo4jResponse,
  AlertsResponse,
  CostsResponse,
} from '@/types/metrics';

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
 */
export function useDashboardData() {
  const { environment, timeRange } = useDashboardState();

  // Metrics (overview page)
  const metrics = useSWR<MetricsResponse>(
    `/api/metrics?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000, revalidateOnFocus: true }
  );

  // Database metrics
  const database = useSWR<DatabaseMetricsResponse>(
    `/api/database?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000, revalidateOnFocus: true }
  );

  // LLM metrics
  const llm = useSWR<LLMMetricsResponse>(
    `/api/llm?range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000, revalidateOnFocus: true }
  );

  // Errors
  const errors = useSWR(
    `/api/errors?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000, revalidateOnFocus: true }
  );

  // Container Apps
  const containerApps = useSWR<ContainerAppsResponse>(
    `/api/container-apps?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 30000, dedupingInterval: 15000, revalidateOnFocus: true }
  );

  // Neo4j
  const neo4j = useSWR<Neo4jResponse>(
    `/api/neo4j?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000, revalidateOnFocus: true }
  );

  // Alerts
  const alerts = useSWR<AlertsResponse>(
    `/api/alerts?env=${environment}`,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000, revalidateOnFocus: true }
  );

  // Costs
  const costs = useSWR<CostsResponse>(
    `/api/costs?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 300000, dedupingInterval: 60000, revalidateOnFocus: true }
  );

  // Deployments
  const deployments = useSWR(
    `/api/deployments?env=${environment}`,
    fetcher,
    { refreshInterval: 300000, dedupingInterval: 60000, revalidateOnFocus: true }
  );

  // Combined refresh
  const refresh = useCallback(() => {
    metrics.mutate();
    database.mutate();
    llm.mutate();
    errors.mutate();
    containerApps.mutate();
    neo4j.mutate();
    alerts.mutate();
    costs.mutate();
    deployments.mutate();
  }, [metrics, database, llm, errors, containerApps, neo4j, alerts, costs, deployments]);

  const isLoading =
    metrics.isLoading || database.isLoading || llm.isLoading ||
    errors.isLoading || containerApps.isLoading || neo4j.isLoading ||
    alerts.isLoading || costs.isLoading || deployments.isLoading;

  const hasError =
    metrics.error || database.error || llm.error ||
    errors.error || containerApps.error || neo4j.error ||
    alerts.error || costs.error || deployments.error;

  return {
    metrics: metrics.data,
    database: database.data,
    llm: llm.data,
    errors: errors.data,
    containerApps: containerApps.data,
    neo4j: neo4j.data,
    alerts: alerts.data,
    costs: costs.data,
    deployments: deployments.data,

    isLoading,
    isLoadingMetrics: metrics.isLoading,
    isLoadingDatabase: database.isLoading,
    isLoadingLlm: llm.isLoading,
    isLoadingErrors: errors.isLoading,
    isLoadingContainerApps: containerApps.isLoading,
    isLoadingNeo4j: neo4j.isLoading,
    isLoadingAlerts: alerts.isLoading,
    isLoadingCosts: costs.isLoading,
    isLoadingDeployments: deployments.isLoading,

    hasError,
    metricsError: metrics.error,
    databaseError: database.error,
    llmError: llm.error,
    errorsError: errors.error,
    containerAppsError: containerApps.error,
    neo4jError: neo4j.error,
    alertsError: alerts.error,
    costsError: costs.error,
    deploymentsError: deployments.error,

    refresh,
    refreshMetrics: () => metrics.mutate(),
    refreshDatabase: () => database.mutate(),
    refreshLlm: () => llm.mutate(),
    refreshErrors: () => errors.mutate(),
    refreshContainerApps: () => containerApps.mutate(),
    refreshNeo4j: () => neo4j.mutate(),
    refreshAlerts: () => alerts.mutate(),
    refreshCosts: () => costs.mutate(),
    refreshDeployments: () => deployments.mutate(),

    environment,
    timeRange,
  };
}

export type {
  MetricsResponse,
  DatabaseMetricsResponse,
  LLMMetricsResponse,
  ContainerAppsResponse,
  Neo4jResponse,
  AlertsResponse,
  CostsResponse,
};
