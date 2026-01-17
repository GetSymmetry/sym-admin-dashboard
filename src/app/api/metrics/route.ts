import { NextResponse } from 'next/server';
import {
  type Environment,
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  metricsCache,
  queryAppInsights,
  getServiceBusMetrics,
  getAllServicesStatus,
  mapServiceName,
  aggregateServiceMetrics,
  APP_INSIGHTS_QUERIES,
} from '@/lib/api';
import type { MetricsResponse, ServiceMetrics, LLMModelMetrics, RecentError, PerformanceMetrics } from '@/types/metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache
  const cacheKey = getCacheKey(env, range);
  const cached = checkCache<MetricsResponse>(metricsCache, cacheKey, forceRefresh);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const timeRange = parseTimeRange(range);

    // Run all queries in parallel
    const [
      requestsFromRequests,
      requestsByService,
      errorCount,
      llmMetrics,
      serviceBusQueues,
      services,
      recentErrors,
      performanceData,
      performanceAllRequests,
    ] = await Promise.all([
      // HTTP requests by service
      queryAppInsights(APP_INSIGHTS_QUERIES.requestsByService(timeRange), env, timeRange.isoDuration),
      // Traces by service (fallback)
      queryAppInsights(APP_INSIGHTS_QUERIES.tracesByService(timeRange), env, timeRange.isoDuration),
      // Error count
      queryAppInsights(APP_INSIGHTS_QUERIES.errorCount(timeRange), env, timeRange.isoDuration),
      // LLM metrics
      queryAppInsights(APP_INSIGHTS_QUERIES.llmMetrics(timeRange), env, timeRange.isoDuration),
      // Service Bus queues
      getServiceBusMetrics(env),
      // All services status
      getAllServicesStatus(env),
      // Recent errors
      queryAppInsights(APP_INSIGHTS_QUERIES.recentErrors(10), env, 'PT1H'),
      // Performance by endpoint
      queryAppInsights(APP_INSIGHTS_QUERIES.performanceByEndpoint(timeRange, 10), env, timeRange.isoDuration),
      // Fallback performance from requests
      queryAppInsights(APP_INSIGHTS_QUERIES.performanceFromRequests(timeRange, 10), env, timeRange.isoDuration),
    ]);

    // Transform requests data and aggregate by mapped service name
    const requestsDataRaw: ServiceMetrics[] = Array.isArray(requestsFromRequests)
      ? requestsFromRequests
          .filter((row) => row[0])
          .map((row) => ({
            service: mapServiceName(row[0] as string),
            count: Number(row[1]) || 0,
          }))
      : [];

    // Fallback to traces if no requests data
    const traceServiceDataRaw: ServiceMetrics[] = Array.isArray(requestsByService)
      ? requestsByService
          .filter((row) => row[0] && row[0] !== 'Unknown')
          .map((row) => ({
            service: mapServiceName(row[0] as string),
            count: Number(row[1]) || 0,
          }))
      : [];

    // Aggregate to combine duplicate mapped names (e.g., multiple raw names -> "Convo Processor")
    const requestsData = aggregateServiceMetrics(requestsDataRaw);
    const traceServiceData = aggregateServiceMetrics(traceServiceDataRaw);

    const finalRequestsData = requestsData.length > 0 ? requestsData : traceServiceData;

    // Transform error count
    const errorsTotal = Array.isArray(errorCount) && errorCount.length > 0
      ? (errorCount[0][0] as number) || 0
      : 0;

    // Transform LLM data
    const llmData: LLMModelMetrics[] = Array.isArray(llmMetrics)
      ? llmMetrics.map((row) => ({
          model: (row[0] as string) || 'Unknown',
          calls: Number(row[1]) || 0,
          tokens: Number(row[2]) || 0,
          cost: Number(row[3]) || 0,
        }))
      : [];

    const totalLLMCost = llmData.reduce((sum, m) => sum + m.cost, 0);
    const totalLLMTokens = llmData.reduce((sum, m) => sum + m.tokens, 0);
    const totalLLMCalls = llmData.reduce((sum, m) => sum + m.calls, 0);

    // Transform queues data
    const queuesData = serviceBusQueues.map((q) => ({
      name: q.name,
      active: q.active || 0,
      deadLetter: q.deadLetter || 0,
    }));

    // Transform services data
    const servicesData = services.map((s) => ({
      name: s.displayName || s.name,
      status: s.status,
    }));

    // Transform errors data
    const errorsData: RecentError[] = Array.isArray(recentErrors)
      ? recentErrors.map((row) => ({
          timestamp: row[0] as string,
          message: ((row[1] as string) || '').substring(0, 100),
          service: mapServiceName(row[2] as string) || 'Unknown',
          path: (row[3] as string) || '',
        }))
      : [];

    // Transform performance data
    const perfFromTraces: PerformanceMetrics[] = Array.isArray(performanceData)
      ? performanceData.map((row) => ({
          endpoint: (row[0] as string) || '',
          avgMs: Math.round((row[1] as number) || 0),
          p95Ms: Math.round((row[2] as number) || 0),
          count: (row[3] as number) || 0,
        }))
      : [];

    const perfFromRequests: PerformanceMetrics[] = Array.isArray(performanceAllRequests)
      ? performanceAllRequests.map((row) => ({
          endpoint: (row[0] as string) || '',
          avgMs: Math.round((row[1] as number) || 0),
          p95Ms: Math.round((row[2] as number) || 0),
          count: (row[3] as number) || 0,
        }))
      : [];

    const perfData = perfFromTraces.length > 0 ? perfFromTraces : perfFromRequests;

    // Build response
    const data: MetricsResponse = {
      timestamp: new Date().toISOString(),
      environment: env,
      overview: {
        totalRequests: finalRequestsData.reduce((sum, r) => sum + (r.count || 0), 0),
        totalErrors: errorsTotal,
        llmCost24h: totalLLMCost,
        llmTokens24h: totalLLMTokens,
        llmCalls24h: totalLLMCalls,
        queueDepth: queuesData.reduce((sum, q) => sum + (q.active || 0), 0),
        deadLetters: queuesData.reduce((sum, q) => sum + (q.deadLetter || 0), 0),
      },
      requestsByService: finalRequestsData,
      llmByModel: llmData,
      queues: queuesData,
      services: servicesData,
      recentErrors: errorsData,
      performance: perfData,
    };

    // Debug: Log if we got empty data from Azure (helpful for Vercel debugging)
    if (finalRequestsData.length === 0 && queuesData.length === 0 && servicesData.length === 0) {
      console.warn('All Azure queries returned empty data - authentication may have failed', {
        env,
        range,
        hasAzureCreds: !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET),
      });
    }

    // Cache and return
    setCache(metricsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
