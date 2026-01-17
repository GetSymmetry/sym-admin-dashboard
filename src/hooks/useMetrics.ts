'use client';

import useSWR from 'swr';

export interface MetricsData {
  timestamp: string;
  environment: string;
  overview: {
    totalRequests: number;
    totalErrors: number;
    llmCost24h: number;
    llmTokens24h: number;
    llmCalls24h: number;
    queueDepth: number;
    deadLetters: number;
  };
  requestsByService: Array<{ service: string; count: number }>;
  llmByModel: Array<{ model: string; calls: number; tokens: number; cost: number }>;
  queues: Array<{ name: string; active: number; deadLetter: number }>;
  services: Array<{ name: string; status: string }>;
  recentErrors: Array<{ timestamp: string; message: string; service: string; path: string }>;
  performance: Array<{ endpoint: string; avgMs: number; p95Ms: number; count: number }>;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch metrics');
  }
  return response.json();
};

export function useMetrics(environment: 'prod' | 'test' = 'prod') {
  const { data, error, isLoading, mutate } = useSWR<MetricsData>(
    `/api/metrics?env=${environment}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
      dedupingInterval: 30000,
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
