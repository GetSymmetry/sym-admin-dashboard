import { NextResponse } from 'next/server';
import {
  type Environment,
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  databaseCache,
  queryDatabase,
  DATABASE_QUERIES,
} from '@/lib/api';
import type { DatabaseMetricsResponse } from '@/types/metrics';

interface CountsRow {
  total_users: string;
  total_orgs: string;
  total_workspaces: string;
  total_kus: string;
  total_conversations: string;
  total_messages: string;
  total_jobs: string;
}

interface JobStatusRow {
  status: string;
  count: string;
}

interface UserTrendRow {
  date: string;
  count: string;
}

interface HealthRow {
  db_size_mb: string;
  active_queries: string;
  total_connections: string;
  idle_connections: string;
  waiting_queries: string;
  uptime_hours: string;
}

interface ConnectionRow {
  state: string;
  count: string;
  max_duration_sec: string;
}

interface CacheRow {
  cache_hit_ratio: string;
  cache_hits: string;
  disk_reads: string;
  rows_returned: string;
  rows_fetched: string;
  rows_inserted: string;
  rows_updated: string;
  rows_deleted: string;
}

interface TableRow {
  table_name: string;
  total_size: string;
  size_mb: string;
  row_count: string;
  dead_tuples: string;
  dead_tuple_ratio: string;
}

interface SlowQueryRow {
  query_snippet: string;
  calls: string;
  total_time_ms: string;
  avg_time_ms: string;
  max_time_ms: string;
  rows: string;
}

interface QueryStatsRow {
  total_query_types: string;
  total_calls: string;
  total_exec_minutes: string;
  avg_query_time_ms: string;
}

interface IndexRow {
  table_name: string;
  index_name: string;
  scans: string;
  tuples_read: string;
  tuples_fetched: string;
  index_size: string;
}

interface LockRow {
  mode: string;
  count: string;
}

interface CountRow {
  count: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache
  const cacheKey = getCacheKey(env, range);
  const cached = checkCache<DatabaseMetricsResponse>(databaseCache, cacheKey, forceRefresh);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const timeRange = parseTimeRange(range);
    const interval = timeRange.postgresInterval;
    const activityQueries = DATABASE_QUERIES.activityInRange(interval);

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
      newUsersResult,
      newJobsResult,
      newConversationsResult,
      newMessagesResult,
      newKUsResult,
    ] = await Promise.all([
      queryDatabase<CountsRow>(DATABASE_QUERIES.entityCounts(), env),
      queryDatabase<JobStatusRow>(DATABASE_QUERIES.jobStatsByStatus(), env),
      queryDatabase<UserTrendRow>(DATABASE_QUERIES.recentUsersTrend(), env),
      queryDatabase<JobStatusRow>(DATABASE_QUERIES.jobsInRange(interval), env),
      queryDatabase<HealthRow>(DATABASE_QUERIES.databaseHealth(), env),
      queryDatabase<ConnectionRow>(DATABASE_QUERIES.connectionStats(), env),
      queryDatabase<CacheRow>(DATABASE_QUERIES.cacheStats(), env),
      queryDatabase<TableRow>(DATABASE_QUERIES.tableSizes(15), env),
      queryDatabase<SlowQueryRow>(DATABASE_QUERIES.slowQueries(10), env).catch(() => []),
      queryDatabase<QueryStatsRow>(DATABASE_QUERIES.queryStats(), env).catch(() => []),
      queryDatabase<IndexRow>(DATABASE_QUERIES.indexUsage(10), env),
      queryDatabase<LockRow>(DATABASE_QUERIES.lockStats(), env),
      queryDatabase<CountRow>(activityQueries.newUsers, env),
      queryDatabase<CountRow>(activityQueries.newJobs, env),
      queryDatabase<CountRow>(activityQueries.newConversations, env),
      queryDatabase<CountRow>(activityQueries.newMessages, env),
      queryDatabase<CountRow>(activityQueries.newKUs, env),
    ]);

    // Parse entity counts
    const counts = countStats[0] || {} as CountsRow;
    const parsedCounts = {
      users: parseInt(counts.total_users) || 0,
      organizations: parseInt(counts.total_orgs) || 0,
      workspaces: parseInt(counts.total_workspaces) || 0,
      knowledgeUnits: parseInt(counts.total_kus) || 0,
      conversations: parseInt(counts.total_conversations) || 0,
      messages: parseInt(counts.total_messages) || 0,
      totalJobs: parseInt(counts.total_jobs) || 0,
    };

    // Parse job stats
    const jobStatsParsed: Record<string, number> = {};
    jobStats.forEach((row) => {
      jobStatsParsed[row.status] = parseInt(row.count) || 0;
    });

    // Parse recent users trend
    const recentUsersParsed = recentUsers.map((row) => ({
      date: row.date,
      count: parseInt(row.count) || 0,
    }));

    // Parse recent jobs
    const recentJobsParsed: Record<string, number> = {};
    recentJobs.forEach((row) => {
      recentJobsParsed[row.status] = parseInt(row.count) || 0;
    });

    // Parse DB health
    const healthRow = dbHealth[0] || {} as HealthRow;
    const health = {
      dbSizeMb: parseInt(healthRow.db_size_mb) || 0,
      activeQueries: parseInt(healthRow.active_queries) || 0,
      totalConnections: parseInt(healthRow.total_connections) || 0,
      idleConnections: parseInt(healthRow.idle_connections) || 0,
      waitingQueries: parseInt(healthRow.waiting_queries) || 0,
      uptimeHours: parseInt(healthRow.uptime_hours) || 0,
    };

    // Parse connection stats
    const connectionStatsParsed = connectionStats.map((row) => ({
      state: row.state || 'unknown',
      count: parseInt(row.count) || 0,
      maxDurationSec: parseInt(row.max_duration_sec) || 0,
    }));

    // Parse cache stats
    const cacheRow = cacheStats[0] || {} as CacheRow;
    const cache = {
      hitRatio: parseFloat(cacheRow.cache_hit_ratio) || 0,
      hits: parseInt(cacheRow.cache_hits) || 0,
      diskReads: parseInt(cacheRow.disk_reads) || 0,
      rowsReturned: parseInt(cacheRow.rows_returned) || 0,
      rowsFetched: parseInt(cacheRow.rows_fetched) || 0,
      rowsInserted: parseInt(cacheRow.rows_inserted) || 0,
      rowsUpdated: parseInt(cacheRow.rows_updated) || 0,
      rowsDeleted: parseInt(cacheRow.rows_deleted) || 0,
    };

    // Parse table sizes
    const tablesParsed = tableSizes.map((row) => ({
      name: row.table_name,
      size: row.total_size,
      sizeMb: parseInt(row.size_mb) || 0,
      rowCount: parseInt(row.row_count) || 0,
      deadTuples: parseInt(row.dead_tuples) || 0,
      deadTupleRatio: parseFloat(row.dead_tuple_ratio) || 0,
    }));

    // Parse slow queries
    const slowQueriesParsed = slowQueries.map((row) => ({
      query: row.query_snippet || '',
      calls: parseInt(row.calls) || 0,
      totalTimeMs: parseFloat(row.total_time_ms) || 0,
      avgTimeMs: parseFloat(row.avg_time_ms) || 0,
      maxTimeMs: parseFloat(row.max_time_ms) || 0,
      rows: parseInt(row.rows) || 0,
    }));

    // Parse query stats
    const queryStatsRow = queryStats[0] || {} as QueryStatsRow;
    const queryStatsObj = {
      totalQueryTypes: parseInt(queryStatsRow.total_query_types) || 0,
      totalCalls: parseInt(queryStatsRow.total_calls) || 0,
      totalExecMinutes: parseFloat(queryStatsRow.total_exec_minutes) || 0,
      avgQueryTimeMs: parseFloat(queryStatsRow.avg_query_time_ms) || 0,
    };

    // Parse index usage
    const indexUsageParsed = indexUsage.map((row) => ({
      table: row.table_name,
      index: row.index_name,
      scans: parseInt(row.scans) || 0,
      tuplesRead: parseInt(row.tuples_read) || 0,
      tuplesFetched: parseInt(row.tuples_fetched) || 0,
      size: row.index_size,
    }));

    // Parse lock stats
    const lockStatsParsed = lockStats.map((row) => ({
      mode: row.mode,
      count: parseInt(row.count) || 0,
    }));

    // Parse activity counts
    const activity = {
      newUsers: parseInt(newUsersResult[0]?.count) || 0,
      newJobs: parseInt(newJobsResult[0]?.count) || 0,
      newConversations: parseInt(newConversationsResult[0]?.count) || 0,
      newMessages: parseInt(newMessagesResult[0]?.count) || 0,
      newKUs: parseInt(newKUsResult[0]?.count) || 0,
    };

    // Calculate health score
    const healthScore = Math.min(100, Math.round(
      (cache.hitRatio > 95 ? 30 : cache.hitRatio > 90 ? 20 : 10) +
      (health.activeQueries < 10 ? 30 : health.activeQueries < 50 ? 20 : 10) +
      (health.waitingQueries < 5 ? 20 : health.waitingQueries < 20 ? 10 : 0) +
      (health.totalConnections < 50 ? 20 : health.totalConnections < 100 ? 10 : 0)
    ));

    const data: DatabaseMetricsResponse = {
      timestamp: new Date().toISOString(),
      environment: env,
      timeRange: range,
      counts: parsedCounts,
      activity,
      jobs: {
        total: parsedCounts.totalJobs,
        completed: jobStatsParsed['completed'] || 0,
        failed: jobStatsParsed['failed'] || 0,
        processing: jobStatsParsed['processing'] || 0,
        pending: jobStatsParsed['pending'] || 0,
        byStatus: Object.entries(jobStatsParsed).map(([status, count]) => ({ status, count })),
      },
      jobsInRange: {
        byStatus: recentJobsParsed,
        total: Object.values(recentJobsParsed).reduce((a, b) => a + b, 0),
      },
      trends: {
        usersLast7Days: recentUsersParsed,
      },
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
      connections: {
        total: health.totalConnections,
        byState: connectionStatsParsed,
      },
      cache: {
        hitRatio: cache.hitRatio,
        hits: cache.hits,
        diskReads: cache.diskReads,
        status: cache.hitRatio >= 99 ? 'excellent' : cache.hitRatio >= 95 ? 'good' : cache.hitRatio >= 90 ? 'fair' : 'poor',
      },
      operations: {
        returned: cache.rowsReturned,
        fetched: cache.rowsFetched,
        inserted: cache.rowsInserted,
        updated: cache.rowsUpdated,
        deleted: cache.rowsDeleted,
      },
      tables: tablesParsed,
      queryStats: queryStatsObj,
      slowQueries: slowQueriesParsed,
      indexes: indexUsageParsed,
      locks: {
        total: lockStatsParsed.reduce((sum, l) => sum + l.count, 0),
        byMode: lockStatsParsed,
      },
    };

    setCache(databaseCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Failed to fetch database metrics:', errorMessage, errorStack);
    return NextResponse.json({ 
      error: 'Failed to fetch database metrics',
      details: errorMessage,
      env,
    }, { status: 500 });
  }
}
