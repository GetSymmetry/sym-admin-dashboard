/**
 * Centralized SQL queries for PostgreSQL database.
 */

/**
 * Database SQL queries.
 */
export const DATABASE_QUERIES = {
  /**
   * Entity counts (absolute totals).
   */
  entityCounts: () => `
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM organizations) as total_orgs,
      (SELECT COUNT(*) FROM workspaces) as total_workspaces,
      (SELECT COUNT(*) FROM knowledge_units) as total_kus,
      (SELECT COUNT(*) FROM chat_conversations) as total_conversations,
      (SELECT COUNT(*) FROM chat_messages) as total_messages,
      (SELECT COUNT(*) FROM processing_jobs) as total_jobs
  `,

  /**
   * Job stats by status (absolute).
   */
  jobStatsByStatus: () => `
    SELECT status, COUNT(*) as count 
    FROM processing_jobs 
    GROUP BY status 
    ORDER BY count DESC
  `,

  /**
   * Recent users trend (last 7 days for chart).
   */
  recentUsersTrend: () => `
    SELECT DATE(created_at)::text as date, COUNT(*) as count
    FROM users 
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at) 
    ORDER BY DATE(created_at) DESC
  `,

  /**
   * Jobs in time range.
   */
  jobsInRange: (interval: string) => `
    SELECT status, COUNT(*) as count
    FROM processing_jobs 
    WHERE created_at > NOW() - INTERVAL '${interval}'
    GROUP BY status
  `,

  /**
   * Database health metrics.
   */
  databaseHealth: () => `
    SELECT 
      pg_database_size(current_database()) / 1024 / 1024 as db_size_mb,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active_queries,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as total_connections,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') as idle_connections,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' AND wait_event_type IS NOT NULL AND wait_event_type != 'Client') as waiting_queries,
      (SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int / 3600) as uptime_hours
  `,

  /**
   * Connection pool stats.
   */
  connectionStats: () => `
    SELECT 
      state,
      COUNT(*) as count,
      COALESCE(MAX(EXTRACT(EPOCH FROM (now() - state_change)))::int, 0) as max_duration_sec
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
    ORDER BY count DESC
  `,

  /**
   * Cache hit ratio and stats.
   */
  cacheStats: () => `
    SELECT 
      ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0), 2) as cache_hit_ratio,
      sum(blks_hit) as cache_hits,
      sum(blks_read) as disk_reads,
      sum(tup_returned) as rows_returned,
      sum(tup_fetched) as rows_fetched,
      sum(tup_inserted) as rows_inserted,
      sum(tup_updated) as rows_updated,
      sum(tup_deleted) as rows_deleted
    FROM pg_stat_database
    WHERE datname = current_database()
  `,

  /**
   * Table sizes.
   */
  tableSizes: (limit: number = 15) => `
    SELECT 
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_total_relation_size(relid) / 1024 / 1024 as size_mb,
      n_live_tup as row_count,
      n_dead_tup as dead_tuples,
      CASE WHEN (n_live_tup + n_dead_tup) > 0 
        THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2) 
        ELSE 0 
      END as dead_tuple_ratio
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT ${limit}
  `,

  /**
   * Slow queries from pg_stat_statements.
   */
  slowQueries: (limit: number = 10) => `
    SELECT 
      LEFT(query, 100) as query_snippet,
      calls,
      ROUND(total_exec_time::numeric, 2) as total_time_ms,
      ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
      ROUND(max_exec_time::numeric, 2) as max_time_ms,
      rows
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND query NOT LIKE '%pg_stat%'
    ORDER BY mean_exec_time DESC
    LIMIT ${limit}
  `,

  /**
   * Query statistics summary.
   */
  queryStats: () => `
    SELECT 
      (SELECT count(*) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as total_query_types,
      (SELECT ROUND(sum(calls)::numeric) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as total_calls,
      (SELECT ROUND(sum(total_exec_time)::numeric / 1000 / 60, 2) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as total_exec_minutes,
      (SELECT ROUND(avg(mean_exec_time)::numeric, 2) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as avg_query_time_ms
  `,

  /**
   * Index usage stats.
   */
  indexUsage: (limit: number = 10) => `
    SELECT 
      relname as table_name,
      indexrelname as index_name,
      idx_scan as scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched,
      pg_size_pretty(pg_relation_size(indexrelid)) as index_size
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
    LIMIT ${limit}
  `,

  /**
   * Lock statistics.
   */
  lockStats: () => `
    SELECT 
      mode,
      COUNT(*) as count
    FROM pg_locks
    WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
    GROUP BY mode
    ORDER BY count DESC
  `,

  /**
   * Activity counts in time range.
   */
  activityInRange: (interval: string) => ({
    newUsers: `SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '${interval}'`,
    newJobs: `SELECT COUNT(*) as count FROM processing_jobs WHERE created_at > NOW() - INTERVAL '${interval}'`,
    newConversations: `SELECT COUNT(*) as count FROM chat_conversations WHERE created_at > NOW() - INTERVAL '${interval}'`,
    newMessages: `SELECT COUNT(*) as count FROM chat_messages WHERE created_at > NOW() - INTERVAL '${interval}'`,
    newKUs: `SELECT COUNT(*) as count FROM knowledge_units WHERE created_at > NOW() - INTERVAL '${interval}'`,
  }),
};
