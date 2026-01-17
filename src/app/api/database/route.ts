import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache by env+range for database metrics (2 min TTL)
const dbCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 min cache

// Database connection info (from Key Vault)
const DB_CONFIG = {
  prod: {
    host: process.env.PROD_DB_HOST || 'psql-sym-prod-centralus.postgres.database.azure.com',
    user: process.env.PROD_DB_USER || 'symadmin',
    password: process.env.PROD_DB_PASSWORD || '',
    database: process.env.PROD_DB_NAME || 'symmetry_main',
  },
  test: {
    host: process.env.TEST_DB_HOST || 'psql-sym-test-centralus.postgres.database.azure.com',
    user: process.env.TEST_DB_USER || 'symadmin',
    password: process.env.TEST_DB_PASSWORD || '',
    database: process.env.TEST_DB_NAME || 'symmetry_main',
  },
};

async function runQuery(query: string, env: 'prod' | 'test' = 'prod'): Promise<string> {
  const config = DB_CONFIG[env];
  
  try {
    const { stdout } = await execAsync(
      `PGPASSWORD='${config.password}' psql -h ${config.host} -U ${config.user} -d ${config.database} -t -A -F '|' -c "${query.replace(/"/g, '\\"')}"`,
      { maxBuffer: 1024 * 1024 * 10, timeout: 30000 }
    );
    return stdout.trim();
  } catch (error) {
    console.error('PostgreSQL query failed:', error);
    return '';
  }
}

function parseRows(result: string): string[][] {
  if (!result) return [];
  return result.split('\n').filter(Boolean).map(row => row.split('|'));
}

// Convert time range to PostgreSQL interval
function toPostgresInterval(range: string): string {
  const match = range.match(/(\d+)([hdm])/);
  if (!match) return '24 hours';
  const [, num, unit] = match;
  const value = parseInt(num);
  if (unit === 'd') return `${value} days`;
  if (unit === 'h') return `${value} hours`;
  if (unit === 'm') return `${value} minutes`;
  return '24 hours';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as 'prod' | 'test';
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';
  const interval = toPostgresInterval(range);

  // Check cache for this specific env+range combination
  const cacheKey = `${env}-${range}`;
  const cached = dbCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Run all queries in parallel
    const [
      countStats,
      jobStats,
      recentUsers,
      recentJobs,
      dbHealth,
      connectionStats,
      cacheStats,
      tableSizes,
      slowQueries,
      queryStats,
      indexUsage,
      lockStats,
      // Time-based metrics
      newUsersInRange,
      newJobsInRange,
      newConversationsInRange,
      newMessagesInRange,
      newKUsInRange,
    ] = await Promise.all([
      // Entity counts (absolute totals)
      runQuery(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM organizations) as total_orgs,
          (SELECT COUNT(*) FROM workspaces) as total_workspaces,
          (SELECT COUNT(*) FROM knowledge_units) as total_kus,
          (SELECT COUNT(*) FROM chat_conversations) as total_conversations,
          (SELECT COUNT(*) FROM chat_messages) as total_messages,
          (SELECT COUNT(*) FROM processing_jobs) as total_jobs
      `, env),
      
      // Job stats by status (absolute)
      runQuery(`
        SELECT status, COUNT(*) as count 
        FROM processing_jobs 
        GROUP BY status 
        ORDER BY count DESC
      `, env),
      
      // Recent users trend (for chart - last 7 days regardless of range)
      runQuery(`
        SELECT DATE(created_at)::text, COUNT(*) 
        FROM users 
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) 
        ORDER BY DATE(created_at) DESC
      `, env),
      
      // Jobs in time range
      runQuery(`
        SELECT status, COUNT(*) 
        FROM processing_jobs 
        WHERE created_at > NOW() - INTERVAL '${interval}'
        GROUP BY status
      `, env),
      
      // Database health (current state) - filtered by current database
      runQuery(`
        SELECT 
          pg_database_size(current_database()) / 1024 / 1024 as db_size_mb,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active_queries,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as total_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') as idle_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type IS NOT NULL) as waiting_queries,
          (SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int / 3600) as uptime_hours
      `, env),
      
      // Connection pool stats (current state)
      runQuery(`
        SELECT 
          state,
          COUNT(*) as count,
          COALESCE(MAX(EXTRACT(EPOCH FROM (now() - state_change)))::int, 0) as max_duration_sec
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
        ORDER BY count DESC
      `, env),
      
      // Cache hit ratio (cumulative since DB start - shown as current state)
      runQuery(`
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
      `, env),
      
      // Table sizes (current state)
      runQuery(`
        SELECT 
          relname as table_name,
          pg_size_pretty(pg_total_relation_size(relid)) as total_size,
          pg_total_relation_size(relid) / 1024 / 1024 as size_mb,
          n_live_tup as row_count,
          n_dead_tup as dead_tuples,
          CASE WHEN (n_live_tup + n_dead_tup) > 0 THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2) ELSE 0 END as dead_tuple_ratio
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 15
      `, env),
      
      // Slow queries (cumulative from pg_stat_statements)
      runQuery(`
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
        LIMIT 10
      `, env).catch(() => ''),
      
      // Query statistics (cumulative)
      runQuery(`
        SELECT 
          (SELECT count(*) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as total_query_types,
          (SELECT ROUND(sum(calls)::numeric) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as total_calls,
          (SELECT ROUND(sum(total_exec_time)::numeric / 1000 / 60, 2) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as total_exec_minutes,
          (SELECT ROUND(avg(mean_exec_time)::numeric, 2) FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) as avg_query_time_ms
      `, env).catch(() => ''),
      
      // Index usage (cumulative)
      runQuery(`
        SELECT 
          relname as table_name,
          indexrelname as index_name,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 10
      `, env),
      
      // Lock stats (current state)
      runQuery(`
        SELECT 
          mode,
          COUNT(*) as count
        FROM pg_locks
        WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
        GROUP BY mode
        ORDER BY count DESC
      `, env),
      
      // === TIME-BASED METRICS (respect range) ===
      
      // New users in range
      runQuery(`
        SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '${interval}'
      `, env),
      
      // New jobs in range
      runQuery(`
        SELECT COUNT(*) FROM processing_jobs WHERE created_at > NOW() - INTERVAL '${interval}'
      `, env),
      
      // New conversations in range
      runQuery(`
        SELECT COUNT(*) FROM chat_conversations WHERE created_at > NOW() - INTERVAL '${interval}'
      `, env),
      
      // New messages in range
      runQuery(`
        SELECT COUNT(*) FROM chat_messages WHERE created_at > NOW() - INTERVAL '${interval}'
      `, env),
      
      // New KUs in range
      runQuery(`
        SELECT COUNT(*) FROM knowledge_units WHERE created_at > NOW() - INTERVAL '${interval}'
      `, env),
    ]);

    // Parse entity counts
    const counts = countStats.split('|');
    const parsedCounts = {
      users: parseInt(counts[0]) || 0,
      organizations: parseInt(counts[1]) || 0,
      workspaces: parseInt(counts[2]) || 0,
      knowledgeUnits: parseInt(counts[3]) || 0,
      conversations: parseInt(counts[4]) || 0,
      messages: parseInt(counts[5]) || 0,
      totalJobs: parseInt(counts[6]) || 0,
    };

    // Parse job stats
    const jobStatsParsed: Record<string, number> = {};
    parseRows(jobStats).forEach(([status, count]) => {
      jobStatsParsed[status] = parseInt(count) || 0;
    });

    // Parse recent users
    const recentUsersParsed = parseRows(recentUsers).map(([date, count]) => ({
      date,
      count: parseInt(count) || 0,
    }));

    // Parse recent jobs
    const recentJobsParsed: Record<string, number> = {};
    parseRows(recentJobs).forEach(([status, count]) => {
      recentJobsParsed[status] = parseInt(count) || 0;
    });

    // Parse DB health
    const healthParts = dbHealth.split('|');
    const health = {
      dbSizeMb: parseInt(healthParts[0]) || 0,
      activeQueries: parseInt(healthParts[1]) || 0,
      totalConnections: parseInt(healthParts[2]) || 0,
      idleConnections: parseInt(healthParts[3]) || 0,
      waitingQueries: parseInt(healthParts[4]) || 0,
      uptimeHours: parseInt(healthParts[5]) || 0,
    };

    // Parse connection stats
    const connectionStatsParsed = parseRows(connectionStats).map(([state, count, maxDuration]) => ({
      state: state || 'unknown',
      count: parseInt(count) || 0,
      maxDurationSec: parseInt(maxDuration) || 0,
    }));

    // Parse cache stats
    const cacheParts = cacheStats.split('|');
    const cache = {
      hitRatio: parseFloat(cacheParts[0]) || 0,
      hits: parseInt(cacheParts[1]) || 0,
      diskReads: parseInt(cacheParts[2]) || 0,
      rowsReturned: parseInt(cacheParts[3]) || 0,
      rowsFetched: parseInt(cacheParts[4]) || 0,
      rowsInserted: parseInt(cacheParts[5]) || 0,
      rowsUpdated: parseInt(cacheParts[6]) || 0,
      rowsDeleted: parseInt(cacheParts[7]) || 0,
    };

    // Parse table sizes
    const tablesParsed = parseRows(tableSizes).map(([name, sizeStr, sizeMb, rowCount, deadTuples, deadRatio]) => ({
      name,
      size: sizeStr,
      sizeMb: parseInt(sizeMb) || 0,
      rowCount: parseInt(rowCount) || 0,
      deadTuples: parseInt(deadTuples) || 0,
      deadTupleRatio: parseFloat(deadRatio) || 0,
    }));

    // Parse slow queries
    const slowQueriesParsed = parseRows(slowQueries).map(([query, calls, totalTime, avgTime, maxTime, rows]) => ({
      query: query || '',
      calls: parseInt(calls) || 0,
      totalTimeMs: parseFloat(totalTime) || 0,
      avgTimeMs: parseFloat(avgTime) || 0,
      maxTimeMs: parseFloat(maxTime) || 0,
      rows: parseInt(rows) || 0,
    }));

    // Parse query stats
    const queryStatParts = queryStats.split('|');
    const queryStatsObj = {
      totalQueryTypes: parseInt(queryStatParts[0]) || 0,
      totalCalls: parseInt(queryStatParts[1]) || 0,
      totalExecMinutes: parseFloat(queryStatParts[2]) || 0,
      avgQueryTimeMs: parseFloat(queryStatParts[3]) || 0,
    };

    // Parse index usage
    const indexUsageParsed = parseRows(indexUsage).map(([table, index, scans, tuplesRead, tuplesFetched, size]) => ({
      table,
      index,
      scans: parseInt(scans) || 0,
      tuplesRead: parseInt(tuplesRead) || 0,
      tuplesFetched: parseInt(tuplesFetched) || 0,
      size,
    }));

    // Parse lock stats
    const lockStatsParsed = parseRows(lockStats).map(([mode, count]) => ({
      mode,
      count: parseInt(count) || 0,
    }));

    // Parse time-based metrics
    const activity = {
      newUsers: parseInt(newUsersInRange) || 0,
      newJobs: parseInt(newJobsInRange) || 0,
      newConversations: parseInt(newConversationsInRange) || 0,
      newMessages: parseInt(newMessagesInRange) || 0,
      newKUs: parseInt(newKUsInRange) || 0,
    };

    // Calculate health score
    const healthScore = Math.min(100, Math.round(
      (cache.hitRatio > 95 ? 30 : cache.hitRatio > 90 ? 20 : 10) +
      (health.activeQueries < 10 ? 30 : health.activeQueries < 50 ? 20 : 10) +
      (health.waitingQueries < 5 ? 20 : health.waitingQueries < 20 ? 10 : 0) +
      (health.totalConnections < 50 ? 20 : health.totalConnections < 100 ? 10 : 0)
    ));

    const data = {
      timestamp: new Date().toISOString(),
      environment: env,
      timeRange: range,
      
      // Entity counts (absolute totals)
      counts: parsedCounts,
      
      // Activity in time range (time-based)
      activity,
      
      // Job breakdown (absolute)
      jobs: {
        total: parsedCounts.totalJobs,
        completed: jobStatsParsed['completed'] || 0,
        failed: jobStatsParsed['failed'] || 0,
        processing: jobStatsParsed['processing'] || 0,
        pending: jobStatsParsed['pending'] || 0,
        byStatus: Object.entries(jobStatsParsed).map(([status, count]) => ({ status, count })),
      },
      
      // Jobs in time range
      jobsInRange: {
        byStatus: recentJobsParsed,
        total: Object.values(recentJobsParsed).reduce((a, b) => a + b, 0),
      },
      
      // Trends (7-day for chart)
      trends: {
        usersLast7Days: recentUsersParsed,
      },
      
      // Database health (current state)
      health: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
        dbSizeMb: health.dbSizeMb,
        uptimeHours: health.uptimeHours,
        activeQueries: health.activeQueries,
        totalConnections: health.totalConnections,
        idleConnections: health.idleConnections,
        waitingQueries: health.waitingQueries,
      },
      
      // Connection pool (current state)
      connections: {
        total: health.totalConnections,
        byState: connectionStatsParsed,
      },
      
      // Cache performance (cumulative since start)
      cache: {
        hitRatio: cache.hitRatio,
        hits: cache.hits,
        diskReads: cache.diskReads,
        status: cache.hitRatio >= 99 ? 'excellent' : cache.hitRatio >= 95 ? 'good' : cache.hitRatio >= 90 ? 'fair' : 'poor',
      },
      
      // Row operations (cumulative since start)
      operations: {
        returned: cache.rowsReturned,
        fetched: cache.rowsFetched,
        inserted: cache.rowsInserted,
        updated: cache.rowsUpdated,
        deleted: cache.rowsDeleted,
      },
      
      // Table stats (current state)
      tables: tablesParsed,
      
      // Query performance (cumulative)
      queryStats: queryStatsObj,
      slowQueries: slowQueriesParsed,
      
      // Index usage (cumulative)
      indexes: indexUsageParsed,
      
      // Locks (current state)
      locks: {
        total: lockStatsParsed.reduce((sum, l) => sum + l.count, 0),
        byMode: lockStatsParsed,
      },
    };

    dbCache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch database metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch database metrics' }, { status: 500 });
  }
}
