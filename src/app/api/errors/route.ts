import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache by env+range for errors (2 min TTL)
const errorsCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 2 * 60 * 1000;

// Filter to exclude staging slot noise
const EXCLUDE_FILTER = `| where message !contains 'export-jobs' | where message !contains 'staging'`;

// Get appropriate bin size for time series based on range
function getBinSize(range: string): string {
  const match = range.match(/(\d+)([hdm])/);
  if (!match) return '1h';
  const [, num, unit] = match;
  const value = parseInt(num);
  
  if (unit === 'm') return '5m';  // For minutes, bin by 5 min
  if (unit === 'h') {
    if (value <= 1) return '5m';  // 1h -> 5min bins
    if (value <= 6) return '15m'; // 6h -> 15min bins
    return '1h';                  // Larger -> 1h bins
  }
  if (unit === 'd') {
    if (value <= 1) return '1h';  // 1d -> 1h bins
    if (value <= 7) return '6h';  // 7d -> 6h bins
    return '1d';                  // Larger -> 1d bins
  }
  return '1h';
}

async function getAppInsightsData(query: string, env: string = 'prod'): Promise<unknown> {
  const appInsights = env === 'prod'
    ? (process.env.PROD_APP_INSIGHTS || 'ai-asp-sym-prod-centralus')
    : (process.env.TEST_APP_INSIGHTS || 'ai-asp-sym-test-centralus');
  const rg = env === 'prod'
    ? (process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus')
    : (process.env.TEST_RESOURCE_GROUP || 'rg-sym-test-centralus');
  
  try {
    const { stdout } = await execAsync(
      `az monitor app-insights query --app ${appInsights} --resource-group ${rg} --analytics-query "${query.replace(/"/g, '\\"')}" -o json`,
      { maxBuffer: 1024 * 1024 * 10 }
    );
    
    const result = JSON.parse(stdout);
    return result?.tables?.[0]?.rows || [];
  } catch (error) {
    console.error('App Insights query failed:', error);
    return [];
  }
}

// Map raw service names to friendly names
function mapServiceName(rawName: string): string {
  if (!rawName) return 'Unknown';
  
  const mappings: Record<string, string> = {
    'uvicorn': 'Symmetry Backend',
    'symmetry-backend': 'Symmetry Backend',
    'ai-features-api': 'AI Features API',
    'ai-convo-processor': 'Convo Processor',
  };
  
  const lower = rawName.toLowerCase();
  if (mappings[lower]) return mappings[lower];
  
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }
  
  return rawName;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get('env') || 'prod';
  const timeRange = searchParams.get('range') || '1h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache for this specific env+range combination
  const cacheKey = `${env}-${timeRange}`;
  const cached = errorsCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const [
      errorsByService,
      errorsByType,
      errorsOverTime,
      recentErrors,
      topEndpoints,
      errorTrend,
    ] = await Promise.all([
      // Errors by service (FILTER: exclude staging)
      getAppInsightsData(`
        traces
        | where timestamp > ago(${timeRange})
        | where severityLevel >= 3
        ${EXCLUDE_FILTER}
        | extend app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown')
        | summarize Count = count() by app
        | order by Count desc
      `, env),
      
      // Errors by type/exception (FILTER: exclude staging)
      getAppInsightsData(`
        exceptions
        | where timestamp > ago(${timeRange})
        ${EXCLUDE_FILTER}
        | extend type = tostring(type), app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown')
        | summarize Count = count() by type, app
        | order by Count desc
        | take 20
      `, env),
      
      // Errors over time (FILTER: exclude staging) - use dynamic binning based on range
      getAppInsightsData(`
        traces
        | where timestamp > ago(${timeRange})
        | where severityLevel >= 3
        ${EXCLUDE_FILTER}
        | summarize Count = count() by bin(timestamp, ${getBinSize(timeRange)})
        | order by timestamp asc
      `, env),
      
      // Recent errors with details (FILTER: exclude staging)
      getAppInsightsData(`
        traces
        | where timestamp > ago(${timeRange})
        | where severityLevel >= 3
        ${EXCLUDE_FILTER}
        | extend app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown'),
                 path = tostring(customDimensions.path),
                 user_id = tostring(customDimensions.user_id),
                 correlation_id = tostring(customDimensions.correlation_id)
        | project timestamp, message, app, path, user_id, correlation_id, severityLevel
        | order by timestamp desc
        | take 50
      `, env),
      
      // Top error-producing endpoints (FILTER: exclude staging)
      getAppInsightsData(`
        traces
        | where timestamp > ago(${timeRange})
        | where severityLevel >= 3
        ${EXCLUDE_FILTER}
        | extend path = tostring(customDimensions.path)
        | where isnotempty(path)
        | summarize Count = count() by path
        | order by Count desc
        | take 10
      `, env),
      
      // Error trend (compare last hour to previous hour) (FILTER: exclude staging)
      getAppInsightsData(`
        traces
        | where timestamp > ago(2h)
        | where severityLevel >= 3
        ${EXCLUDE_FILTER}
        | extend hour = iff(timestamp > ago(1h), "current", "previous")
        | summarize Count = count() by hour
      `, env),
    ]);

    // Calculate trend
    const trendData = errorTrend as unknown[][];
    const currentErrors = trendData.find(r => r[0] === 'current')?.[1] || 0;
    const previousErrors = trendData.find(r => r[0] === 'previous')?.[1] || 1;
    const trendPercent = ((currentErrors as number - (previousErrors as number)) / (previousErrors as number)) * 100;

    const data = {
      timestamp: new Date().toISOString(),
      environment: env,
      timeRange,
      summary: {
        totalErrors: (errorsByService as unknown[][]).reduce((sum, row) => sum + ((row[1] as number) || 0), 0),
        servicesAffected: (errorsByService as unknown[][]).filter(row => (row[1] as number) > 0).length,
        errorTypes: new Set((errorsByType as unknown[][]).map(row => row[0])).size,
        trend: trendPercent,
        trendDirection: trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'stable',
      },
      byService: (errorsByService as unknown[][]).map((row) => ({
        service: mapServiceName(row[0] as string),
        count: row[1] || 0,
      })),
      byType: (errorsByType as unknown[][]).map((row) => ({
        type: row[0] || 'Unknown',
        service: mapServiceName(row[1] as string),
        count: row[2] || 0,
      })),
      overTime: (errorsOverTime as unknown[][]).map((row) => ({
        time: new Date(row[0] as string).toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }),
        count: row[1] || 0,
      })),
      recent: (recentErrors as unknown[][]).map((row) => ({
        timestamp: row[0],
        message: (row[1] as string)?.substring(0, 200) || '',
        service: mapServiceName(row[2] as string),
        path: row[3] || '',
        userId: row[4] || '',
        correlationId: row[5] || '',
        severity: row[6] || 3,
      })),
      topEndpoints: (topEndpoints as unknown[][]).map((row) => ({
        path: row[0] || 'Unknown',
        count: row[1] || 0,
      })),
    };

    errorsCache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch error metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch error metrics' }, { status: 500 });
  }
}
