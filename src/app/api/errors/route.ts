import { NextResponse } from 'next/server';
import {
  type Environment,
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  errorsCache,
  queryAppInsights,
  mapServiceName,
  APP_INSIGHTS_QUERIES,
} from '@/lib/api';

// Get appropriate bin size for time series based on range
function getBinSize(hours: number): string {
  if (hours <= 1) return '5m';
  if (hours <= 6) return '15m';
  if (hours <= 24) return '1h';
  if (hours <= 168) return '6h'; // 7 days
  return '1d';
}

interface ErrorsData {
  timestamp: string;
  environment: string;
  timeRange: string;
  summary: {
    totalErrors: number;
    servicesAffected: number;
    errorTypes: number;
    trend: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
  byService: Array<{ service: string; count: number }>;
  byType: Array<{ type: string; service: string; count: number }>;
  overTime: Array<{ time: string; count: number }>;
  recent: Array<{
    timestamp: string;
    message: string;
    service: string;
    path: string;
    userId: string;
    correlationId: string;
    severity: number;
  }>;
  topEndpoints: Array<{ path: string; count: number }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const range = searchParams.get('range') || '1h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache
  const cacheKey = getCacheKey(env, range);
  const cached = checkCache<ErrorsData>(errorsCache, cacheKey, forceRefresh);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const timeRange = parseTimeRange(range);
    const binSize = getBinSize(timeRange.hours);

    // Build queries
    const errorsByServiceQuery = `
      traces
      | where timestamp > ago(${timeRange.raw})
      | where severityLevel >= 3
      | where message !contains 'export-jobs'
      | where message !contains 'staging'
      | extend app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown')
      | summarize Count = count() by app
      | order by Count desc
    `;

    const errorsByTypeQuery = `
      exceptions
      | where timestamp > ago(${timeRange.raw})
      | where message !contains 'export-jobs'
      | where message !contains 'staging'
      | extend type = tostring(type), app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown')
      | summarize Count = count() by type, app
      | order by Count desc
      | take 20
    `;

    const errorsOverTimeQuery = `
      traces
      | where timestamp > ago(${timeRange.raw})
      | where severityLevel >= 3
      | where message !contains 'export-jobs'
      | where message !contains 'staging'
      | summarize Count = count() by bin(timestamp, ${binSize})
      | order by timestamp asc
    `;

    const recentErrorsQuery = `
      traces
      | where timestamp > ago(${timeRange.raw})
      | where severityLevel >= 3
      | where message !contains 'export-jobs'
      | where message !contains 'staging'
      | extend app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown'),
               path = tostring(customDimensions.path),
               user_id = tostring(customDimensions.user_id),
               correlation_id = tostring(customDimensions.correlation_id)
      | project timestamp, message, app, path, user_id, correlation_id, severityLevel
      | order by timestamp desc
      | take 50
    `;

    const topEndpointsQuery = `
      traces
      | where timestamp > ago(${timeRange.raw})
      | where severityLevel >= 3
      | where message !contains 'export-jobs'
      | where message !contains 'staging'
      | extend path = tostring(customDimensions.path)
      | where isnotempty(path)
      | summarize Count = count() by path
      | order by Count desc
      | take 10
    `;

    const errorTrendQuery = `
      traces
      | where timestamp > ago(2h)
      | where severityLevel >= 3
      | where message !contains 'export-jobs'
      | where message !contains 'staging'
      | extend hour = iff(timestamp > ago(1h), "current", "previous")
      | summarize Count = count() by hour
    `;

    const [
      errorsByService,
      errorsByType,
      errorsOverTime,
      recentErrors,
      topEndpoints,
      errorTrend,
    ] = await Promise.all([
      queryAppInsights(errorsByServiceQuery, env, timeRange.isoDuration),
      queryAppInsights(errorsByTypeQuery, env, timeRange.isoDuration),
      queryAppInsights(errorsOverTimeQuery, env, timeRange.isoDuration),
      queryAppInsights(recentErrorsQuery, env, timeRange.isoDuration),
      queryAppInsights(topEndpointsQuery, env, timeRange.isoDuration),
      queryAppInsights(errorTrendQuery, env, 'PT2H'),
    ]);

    // Calculate trend
    const currentErrors = (errorTrend.find(r => r[0] === 'current')?.[1] as number) || 0;
    const previousErrors = (errorTrend.find(r => r[0] === 'previous')?.[1] as number) || 1;
    const trendPercent = ((currentErrors - previousErrors) / previousErrors) * 100;

    const data: ErrorsData = {
      timestamp: new Date().toISOString(),
      environment: env,
      timeRange: range,
      summary: {
        totalErrors: errorsByService.reduce((sum, row) => sum + ((row[1] as number) || 0), 0),
        servicesAffected: errorsByService.filter(row => (row[1] as number) > 0).length,
        errorTypes: new Set(errorsByType.map(row => row[0])).size,
        trend: trendPercent,
        trendDirection: trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'stable',
      },
      byService: errorsByService.map((row) => ({
        service: mapServiceName(row[0] as string),
        count: (row[1] as number) || 0,
      })),
      byType: errorsByType.map((row) => ({
        type: (row[0] as string) || 'Unknown',
        service: mapServiceName(row[1] as string),
        count: (row[2] as number) || 0,
      })),
      overTime: errorsOverTime.map((row) => ({
        time: new Date(row[0] as string).toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }),
        count: (row[1] as number) || 0,
      })),
      recent: recentErrors.map((row) => ({
        timestamp: row[0] as string,
        message: ((row[1] as string) || '').substring(0, 200),
        service: mapServiceName(row[2] as string),
        path: (row[3] as string) || '',
        userId: (row[4] as string) || '',
        correlationId: (row[5] as string) || '',
        severity: (row[6] as number) || 3,
      })),
      topEndpoints: topEndpoints.map((row) => ({
        path: (row[0] as string) || 'Unknown',
        count: (row[1] as number) || 0,
      })),
    };

    setCache(errorsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch error metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch error metrics' }, { status: 500 });
  }
}
