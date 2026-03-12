"use client";

import useSWR, { SWRConfiguration } from "swr";
import { debuggerClient } from "@/lib/api/client";
import type { DebugResponse } from "@/lib/api/types";

/**
 * SWR wrapper for debugger API calls.
 * Automatically handles loading, error, and refresh.
 */
export function useDebugger<T>(
  endpoint: string | null,
  params?: Record<string, string>,
  config?: SWRConfiguration
) {
  const key = endpoint
    ? `${endpoint}${params ? "?" + new URLSearchParams(params).toString() : ""}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<DebugResponse<T>>(
    key,
    () => debuggerClient.get<T>(endpoint!, params),
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      ...config,
    }
  );

  return {
    data: data?.data ?? null,
    metadata: data?.metadata ?? null,
    error,
    isLoading,
    refresh: mutate,
  };
}
