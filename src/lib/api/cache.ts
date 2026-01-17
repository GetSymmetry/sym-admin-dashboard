/**
 * Shared caching layer using LRU cache with TTL.
 * Used across API routes for consistent caching behavior.
 */

import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  /** Maximum number of items in cache */
  max?: number;
  /** Time-to-live in milliseconds */
  ttlMs: number;
}

/**
 * Create a typed LRU cache with TTL support.
 */
export function createCache<T extends object>(options: CacheOptions): LRUCache<string, T> {
  return new LRUCache<string, T>({
    max: options.max || 100,
    ttl: options.ttlMs,
  });
}

/**
 * Generate a cache key from environment and time range.
 */
export function getCacheKey(env: string, range: string): string {
  return `${env}-${range}`;
}

// Use a single cache instance with unknown type for flexibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCache = LRUCache<string, any>;

/**
 * Pre-configured caches for different API routes.
 * Using 'any' type to allow flexible usage with different response types.
 */

// Metrics cache: 5 minute TTL
export const metricsCache: AnyCache = new LRUCache({
  max: 50,
  ttl: 5 * 60 * 1000,
});

// Database cache: 2 minute TTL (more frequently changing)
export const databaseCache: AnyCache = new LRUCache({
  max: 50,
  ttl: 2 * 60 * 1000,
});

// LLM cache: 5 minute TTL
export const llmCache: AnyCache = new LRUCache({
  max: 50,
  ttl: 5 * 60 * 1000,
});

// Errors cache: 1 minute TTL (need fresh error data)
export const errorsCache: AnyCache = new LRUCache({
  max: 50,
  ttl: 1 * 60 * 1000,
});

// Deployments cache: 10 minute TTL (rarely changes)
export const deploymentsCache: AnyCache = new LRUCache({
  max: 20,
  ttl: 10 * 60 * 1000,
});

/**
 * Helper to check cache and return cached data if valid.
 * Returns null if cache miss or forced refresh.
 */
export function checkCache<T>(
  cache: AnyCache,
  key: string,
  forceRefresh: boolean = false
): T | null {
  if (forceRefresh) {
    return null;
  }
  
  const cached = cache.get(key);
  return (cached as T) ?? null;
}

/**
 * Helper to set cache and return the data.
 */
export function setCache<T>(
  cache: AnyCache,
  key: string,
  data: T
): T {
  cache.set(key, data);
  return data;
}
