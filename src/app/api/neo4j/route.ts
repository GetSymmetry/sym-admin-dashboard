import { NextResponse } from 'next/server';
import {
  type Environment,
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  neo4jCache,
  queryAppInsights,
  queryLogAnalytics,
  getNeo4jVmName,
  APP_INSIGHTS_QUERIES,
  LOG_ANALYTICS_QUERIES,
} from '@/lib/api';
import type { Neo4jResponse } from '@/types/metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = getCacheKey(env, `neo4j-${range}`);
  const cached = checkCache<Neo4jResponse>(neo4jCache, cacheKey, forceRefresh);
  if (cached) return NextResponse.json(cached);

  try {
    const timeRange = parseTimeRange(range);
    const vmName = getNeo4jVmName(env);

    // Run all queries in parallel
    const [
      cpuData,
      memoryData,
      diskData,
      backupData,
      connectionErrors,
      queryPerformance,
    ] = await Promise.all([
      queryLogAnalytics(LOG_ANALYTICS_QUERIES.neo4jCpu(vmName, timeRange), env, timeRange.isoDuration),
      queryLogAnalytics(LOG_ANALYTICS_QUERIES.neo4jMemory(vmName, timeRange), env, timeRange.isoDuration),
      queryLogAnalytics(LOG_ANALYTICS_QUERIES.neo4jDisk(vmName, timeRange), env, timeRange.isoDuration),
      queryLogAnalytics(LOG_ANALYTICS_QUERIES.neo4jLastBackup(vmName), env, 'P7D'),
      queryAppInsights(APP_INSIGHTS_QUERIES.neo4jConnectionErrors(timeRange), env, timeRange.isoDuration),
      queryAppInsights(APP_INSIGHTS_QUERIES.neo4jQueryPerformance(timeRange), env, timeRange.isoDuration),
    ]);

    // Parse CPU
    const cpuPercent = cpuData.length > 0 ? Number(cpuData[0][0]) || 0 : 0;

    // Parse memory
    const memoryPercent = memoryData.length > 0 ? Number(memoryData[0][0]) || 0 : 0;

    // Parse disk
    const diskPercent = diskData.length > 0 ? Number(diskData[0][0]) || 0 : 0;

    // Parse last backup
    const lastBackupTime = backupData.length > 0 ? String(backupData[0][0] || 'Unknown') : 'Unknown';

    // Parse connection errors
    const connErrors = Array.isArray(connectionErrors)
      ? connectionErrors.map(row => ({
          timestamp: String(row[0] || ''),
          message: String(row[1] || '').substring(0, 200),
          service: String(row[2] || 'Unknown'),
        }))
      : [];

    // Parse query performance
    const queriesPerHour = queryPerformance.length > 0 ? Number(queryPerformance[0][0]) || 0 : 0;
    const avgResponseMs = queryPerformance.length > 0 ? Number(queryPerformance[0][1]) || 0 : 0;

    const data: Neo4jResponse = {
      timestamp: new Date().toISOString(),
      environment: env,
      vmName,
      health: {
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        memoryPercent: Math.round(memoryPercent * 10) / 10,
        diskPercent: Math.round(diskPercent * 10) / 10,
        connectionErrors: connErrors.length,
        lastBackupTime,
      },
      connectionErrors: connErrors,
      performance: {
        boltQueriesPerHour: Math.round(queriesPerHour),
        avgResponseMs: Math.round(avgResponseMs * 10) / 10,
      },
    };

    setCache(neo4jCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch Neo4j metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch Neo4j metrics' }, { status: 500 });
  }
}
