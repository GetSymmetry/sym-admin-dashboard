/**
 * PostgreSQL database operations using pg package.
 * Uses connection pooling for efficient connection reuse.
 */

import { Pool } from 'pg';
import { getDatabaseConfig, type Environment } from './config';

// Connection pools per environment (reused across requests)
const pools: Record<Environment, Pool | null> = { prod: null, test: null };

/**
 * Get or create a connection pool for the specified environment.
 */
function getPool(env: Environment): Pool {
  if (!pools[env]) {
    const config = getDatabaseConfig(env);
    
    if (!config.connectionString) {
      throw new Error(`Database connection string not configured for ${env} environment`);
    }
    
    pools[env] = new Pool({
      connectionString: config.connectionString,
      max: 5,                    // Max connections in pool
      idleTimeoutMillis: 30000,  // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout after 10s
      ssl: {
        rejectUnauthorized: false, // Required for Azure PostgreSQL in serverless environments
      },
    });
    
    // Handle pool errors
    pools[env]!.on('error', (err) => {
      console.error(`PostgreSQL pool error (${env}):`, err);
    });
  }
  
  return pools[env]!;
}

/**
 * Execute a query and return rows.
 */
export async function queryDatabase<T = Record<string, unknown>>(
  query: string,
  env: Environment
): Promise<T[]> {
  try {
    const pool = getPool(env);
    const result = await pool.query(query);
    return result.rows as T[];
  } catch (error) {
    console.error(`PostgreSQL query failed (${env}):`, error);
    throw error;
  }
}

/**
 * Execute a query and return a single value.
 */
export async function queryScalar<T = unknown>(
  query: string,
  env: Environment
): Promise<T | null> {
  const rows = await queryDatabase<Record<string, T>>(query, env);
  if (rows.length === 0) return null;
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  return keys.length > 0 ? firstRow[keys[0]] : null;
}

/**
 * Execute multiple queries in parallel and return all results.
 */
export async function queryDatabaseParallel<T extends unknown[]>(
  queries: string[],
  env: Environment
): Promise<T> {
  const results = await Promise.all(
    queries.map(query => queryDatabase(query, env))
  );
  return results as T;
}

/**
 * Parse a pipe-delimited row result (for legacy compatibility).
 */
export function parseRows(result: string): string[][] {
  if (!result) return [];
  return result.split('\n').filter(Boolean).map(row => row.split('|'));
}

/**
 * Close all connection pools (for cleanup).
 */
export async function closePools(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  
  for (const env of ['prod', 'test'] as Environment[]) {
    if (pools[env]) {
      closePromises.push(pools[env]!.end());
      pools[env] = null;
    }
  }
  
  await Promise.all(closePromises);
}
