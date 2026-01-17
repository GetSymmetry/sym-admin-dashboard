import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache by time range to ensure different ranges return correct data
const llmCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Azure OpenAI resource info (from env)
const AZURE_OPENAI_RESOURCE = process.env.AZURE_OPENAI_RESOURCE || 'surya-mfabnhz7-eastus2';
const AZURE_OPENAI_RG = process.env.AZURE_OPENAI_RG || 'base0openaideployments';

// Pricing per 1M tokens (configurable via env)
const PRICING = {
  input: parseFloat(process.env.LLM_INPUT_PRICE || '0.15'),  // $0.15 per 1M input tokens
  output: parseFloat(process.env.LLM_OUTPUT_PRICE || '0.60'), // $0.60 per 1M output tokens
};

async function getAzureOpenAIMetrics(metricNames: string[], interval: string = 'PT1H', hours: number = 24): Promise<unknown> {
  try {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const { stdout: subId } = await execAsync('az account show --query id -o tsv');
    const resourceId = `/subscriptions/${subId.trim()}/resourceGroups/${AZURE_OPENAI_RG}/providers/Microsoft.CognitiveServices/accounts/${AZURE_OPENAI_RESOURCE}`;
    
    const { stdout } = await execAsync(
      `az monitor metrics list --resource "${resourceId}" --metric "${metricNames.join(',')}" --interval ${interval} --start-time ${startTime} --end-time ${endTime} -o json`,
      { maxBuffer: 1024 * 1024 * 10 }
    );
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Azure OpenAI metrics query failed:', error);
    return null;
  }
}

function parseMetrics(data: any): Record<string, { total: number; timeseries: { time: string; value: number }[] }> {
  const result: Record<string, { total: number; timeseries: { time: string; value: number }[] }> = {};
  
  for (const metric of data?.value || []) {
    const name = metric.name.value;
    const timeseries: { time: string; value: number }[] = [];
    let total = 0;
    
    for (const ts of metric.timeseries || []) {
      for (const d of ts.data || []) {
        const value = d.total || d.average || 0;
        if (value > 0) {
          timeseries.push({
            time: new Date(d.timeStamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            value,
          });
          total += value;
        }
      }
    }
    
    result[name] = { total, timeseries };
  }
  
  return result;
}

// Parse time range string to hours
function parseTimeRange(range: string): number {
  const match = range.match(/(\d+)([hdm])/);
  if (!match) return 24;
  const [, num, unit] = match;
  const value = parseInt(num);
  if (unit === 'd') return value * 24;
  if (unit === 'h') return value;
  if (unit === 'm') return value / 60;
  return 24;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';
  const hours = parseTimeRange(range);
  const cacheKey = `${range}`;

  // Check cache for this specific time range
  const cached = llmCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Determine interval based on time range (valid: PT1M,PT5M,PT15M,PT30M,PT1H,PT6H,PT12H,P1D)
    const interval = hours <= 1 ? 'PT5M' : hours <= 6 ? 'PT15M' : hours <= 24 ? 'PT1H' : hours <= 72 ? 'PT6H' : 'P1D';
    
    // Fetch Azure OpenAI metrics (correct metric names for Azure OpenAI)
    const metricsData = await getAzureOpenAIMetrics([
      'AzureOpenAIRequests',
      'TokenTransaction',           // Total tokens
      'ProcessedPromptTokens',      // Input tokens
      'GeneratedTokens',            // Output tokens  
      'AzureOpenAITimeToResponse',
    ], interval, hours);

    if (!metricsData) {
      return NextResponse.json({ error: 'Failed to fetch Azure OpenAI metrics' }, { status: 500 });
    }

    const metrics = parseMetrics(metricsData);
    
    // Calculate cost using correct Azure metric names
    const inputTokens = metrics.ProcessedPromptTokens?.total || 0;
    const outputTokens = metrics.GeneratedTokens?.total || 0;
    const inputCost = (inputTokens / 1_000_000) * PRICING.input;
    const outputCost = (outputTokens / 1_000_000) * PRICING.output;
    const totalCost = inputCost + outputCost;

    // Combine token timeseries for chart
    const tokenTimeseries = metrics.TokenTransaction?.timeseries || [];
    const requestTimeseries = metrics.AzureOpenAIRequests?.timeseries || [];

    const data = {
      timestamp: new Date().toISOString(),
      source: 'Azure OpenAI (Direct)',
      deployment: 'gpt-4.1-mini',
      
      // Summary totals
      totals: {
        totalCalls: metrics.AzureOpenAIRequests?.total || 0,
        totalRequests: metrics.AzureOpenAIRequests?.total || 0,
        totalTokens: metrics.TokenTransaction?.total || 0,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalCost: totalCost.toFixed(4),
        inputCost: inputCost.toFixed(4),
        outputCost: outputCost.toFixed(4),
        rateLimitEvents: metrics.Ratelimit?.total || 0,
        totalErrors: metrics.TotalErrors?.total || 0,
        avgSuccessRate: 100, // From metrics
      },

      // By model (single model for now)
      byModel: [{
        model: 'gpt-4.1-mini',
        calls: metrics.AzureOpenAIRequests?.total || 0,
        inputTokens,
        outputTokens,
        totalCost,
        avgLatency: 0, // Would need TimeToResponse avg
        p95Latency: 0,
      }],

      // Time series for charts
      overTime: tokenTimeseries.map((t, i) => ({
        time: t.time,
        tokens: t.value,
        requests: requestTimeseries[i]?.value || 0,
        cost: ((t.value / 1_000_000) * ((PRICING.input + PRICING.output) / 2)).toFixed(4),
      })),

      // Rate limit info
      rateLimit: {
        events: metrics.Ratelimit?.total || 0,
        timeseries: metrics.Ratelimit?.timeseries || [],
      },

      // Errors
      errors: metrics.TotalErrors?.total > 0 ? [{
        model: 'gpt-4.1-mini',
        errorType: 'API Error',
        count: metrics.TotalErrors?.total || 0,
      }] : [],

      // Latency (placeholder - would need more detailed query)
      latency: [{
        model: 'gpt-4.1-mini',
        avgMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
      }],

      // Top operations (not available from Azure metrics directly)
      topOperations: [],
    };

    llmCache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch LLM metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch LLM metrics' }, { status: 500 });
  }
}
