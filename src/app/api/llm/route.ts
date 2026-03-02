import { NextResponse } from 'next/server';
import { MetricsQueryClient } from '@azure/monitor-query';
import { ClientSecretCredential, DefaultAzureCredential, TokenCredential } from '@azure/identity';
import {
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  llmCache,
  getAzureOpenAIConfig,
  LLM_PRICING,
} from '@/lib/api';
import type { LLMMetricsResponse, LLMOverTimeData } from '@/types/metrics';

// Singleton credential — uses ClientSecretCredential on Vercel, DefaultAzureCredential locally
let credential: TokenCredential | null = null;
let metricsClient: MetricsQueryClient | null = null;

function getCredential(): TokenCredential {
  if (!credential) {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (tenantId && clientId && clientSecret) {
      credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    } else {
      credential = new DefaultAzureCredential();
    }
  }
  return credential;
}

function getMetricsClient(): MetricsQueryClient {
  if (!metricsClient) {
    metricsClient = new MetricsQueryClient(getCredential());
  }
  return metricsClient;
}

interface MetricTimeseries {
  total: number;
  timeseries: Array<{ time: string; value: number }>;
}

async function getAzureOpenAIMetrics(
  metricNames: string[],
  interval: string,
  startTime: Date,
  endTime: Date
): Promise<Record<string, MetricTimeseries>> {
  try {
    const config = getAzureOpenAIConfig();
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    if (!subscriptionId) {
      console.error('AZURE_SUBSCRIPTION_ID is required for LLM metrics');
      return {};
    }
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${config.resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${config.resourceName}`;

    const client = getMetricsClient();
    const result = await client.queryResource(resourceId, metricNames, {
      granularity: interval,
      timespan: { startTime, endTime },
    });

    const metrics: Record<string, MetricTimeseries> = {};

    for (const metric of result.metrics) {
      const name = metric.name;
      const timeseries: Array<{ time: string; value: number }> = [];
      let total = 0;

      for (const ts of metric.timeseries || []) {
        for (const d of ts.data || []) {
          const value = d.total ?? d.average ?? 0;
          if (value > 0) {
            timeseries.push({
              time: new Date(d.timeStamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
              value,
            });
            total += value;
          }
        }
      }

      metrics[name] = { total, timeseries };
    }

    return metrics;
  } catch (error) {
    console.error('Azure OpenAI metrics query failed:', error);
    return {};
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache
  const cacheKey = getCacheKey('llm', range);
  const cached = checkCache<LLMMetricsResponse>(llmCache, cacheKey, forceRefresh);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const timeRange = parseTimeRange(range);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeRange.hours * 60 * 60 * 1000);

    // Fetch Azure OpenAI metrics
    const metrics = await getAzureOpenAIMetrics(
      [
        'AzureOpenAIRequests',
        'TokenTransaction',
        'ProcessedPromptTokens',
        'GeneratedTokens',
        'AzureOpenAITimeToResponse',
      ],
      timeRange.azureInterval,
      startTime,
      endTime
    );

    // Calculate costs
    const inputTokens = metrics.ProcessedPromptTokens?.total || 0;
    const outputTokens = metrics.GeneratedTokens?.total || 0;
    const inputCost = (inputTokens / 1_000_000) * LLM_PRICING.input;
    const outputCost = (outputTokens / 1_000_000) * LLM_PRICING.output;
    const totalCost = inputCost + outputCost;

    // Combine token timeseries for chart
    const tokenTimeseries = metrics.TokenTransaction?.timeseries || [];
    const requestTimeseries = metrics.AzureOpenAIRequests?.timeseries || [];

    const overTime: LLMOverTimeData[] = tokenTimeseries.map((t, i) => ({
      time: t.time,
      tokens: t.value,
      requests: requestTimeseries[i]?.value || 0,
      cost: ((t.value / 1_000_000) * ((LLM_PRICING.input + LLM_PRICING.output) / 2)).toFixed(4),
    }));

    const data: LLMMetricsResponse = {
      timestamp: new Date().toISOString(),
      source: 'Azure OpenAI (SDK)',
      deployment: 'gpt-4.1-mini',
      totals: {
        totalCalls: metrics.AzureOpenAIRequests?.total || 0,
        totalRequests: metrics.AzureOpenAIRequests?.total || 0,
        totalTokens: metrics.TokenTransaction?.total || 0,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalCost: totalCost.toFixed(4),
        inputCost: inputCost.toFixed(4),
        outputCost: outputCost.toFixed(4),
        rateLimitEvents: 0,
        totalErrors: 0,
        avgSuccessRate: 100,
      },
      byModel: [
        {
          model: 'gpt-4.1-mini',
          calls: metrics.AzureOpenAIRequests?.total || 0,
          tokens: metrics.TokenTransaction?.total || 0,
          cost: totalCost,
          inputTokens,
          outputTokens,
          avgLatency: 0,
          p95Latency: 0,
        },
      ],
      overTime,
      rateLimit: {
        events: 0,
        timeseries: [],
      },
      errors: [],
      latency: [
        {
          model: 'gpt-4.1-mini',
          avgMs: 0,
          p50Ms: 0,
          p95Ms: 0,
          p99Ms: 0,
        },
      ],
      topOperations: [],
    };

    setCache(llmCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch LLM metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch LLM metrics' }, { status: 500 });
  }
}
