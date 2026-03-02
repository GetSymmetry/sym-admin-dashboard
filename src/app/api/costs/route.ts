import { NextResponse } from 'next/server';
import {
  type Environment,
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  costsCache,
  queryAppInsights,
  BUDGET_THRESHOLDS,
  LLM_PRICING,
} from '@/lib/api';
import type { CostsResponse } from '@/types/metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const range = searchParams.get('range') || '30d';
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = getCacheKey(env, `costs-${range}`);
  const cached = checkCache<CostsResponse>(costsCache, cacheKey, forceRefresh);
  if (cached) return NextResponse.json(cached);

  try {
    const timeRange = parseTimeRange(range);

    // Query LLM cost data from App Insights
    const [llmByModel, llmOverTime] = await Promise.all([
      queryAppInsights(
        `traces
        | where timestamp > ago(${timeRange.raw})
        | where customDimensions.event_type == "llm_request_complete"
        | extend
            tokens = toint(customDimensions.total_tokens),
            inputTokens = toint(customDimensions.input_tokens),
            outputTokens = toint(customDimensions.output_tokens),
            model = tostring(customDimensions.model)
        | summarize
            Calls = count(),
            TotalTokens = sum(tokens),
            InputTokens = sum(inputTokens),
            OutputTokens = sum(outputTokens)
          by model`,
        env,
        timeRange.isoDuration
      ),
      queryAppInsights(
        `traces
        | where timestamp > ago(${timeRange.raw})
        | where customDimensions.event_type == "llm_request_complete"
        | extend tokens = toint(customDimensions.total_tokens)
        | summarize DailyTokens = sum(tokens), DailyCalls = count() by bin(timestamp, 1d)
        | order by timestamp asc`,
        env,
        timeRange.isoDuration
      ),
    ]);

    // Parse LLM by model
    const byModel = Array.isArray(llmByModel)
      ? llmByModel.map(row => {
          const inputTokens = Number(row[3]) || 0;
          const outputTokens = Number(row[4]) || 0;
          const cost = (inputTokens / 1_000_000) * LLM_PRICING.input + (outputTokens / 1_000_000) * LLM_PRICING.output;
          return {
            model: String(row[0] || 'Unknown'),
            calls: Number(row[1]) || 0,
            tokens: Number(row[2]) || 0,
            cost: Math.round(cost * 100) / 100,
          };
        })
      : [];

    // Parse daily costs
    const dailyCosts = Array.isArray(llmOverTime)
      ? llmOverTime.map(row => {
          const tokens = Number(row[1]) || 0;
          // Estimate cost using average input/output ratio (assume 60/40)
          const estimatedInputTokens = tokens * 0.6;
          const estimatedOutputTokens = tokens * 0.4;
          const cost = (estimatedInputTokens / 1_000_000) * LLM_PRICING.input +
                       (estimatedOutputTokens / 1_000_000) * LLM_PRICING.output;
          return {
            date: String(row[0] || ''),
            cost: Math.round(cost * 100) / 100,
            tokens,
          };
        })
      : [];

    // Totals
    const totalTokens = byModel.reduce((sum, m) => sum + m.tokens, 0);
    const totalCost = byModel.reduce((sum, m) => sum + m.cost, 0);
    const totalCalls = byModel.reduce((sum, m) => sum + m.calls, 0);

    // Project monthly cost based on daily average
    const daysInRange = Math.max(1, timeRange.hours / 24);
    const dailyAvgCost = totalCost / daysInRange;
    const projectedMonthlyCost = dailyAvgCost * 30;

    const budget = BUDGET_THRESHOLDS[env];

    const data: CostsResponse = {
      timestamp: new Date().toISOString(),
      environment: env,
      timeRange: range,
      llm: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalTokens,
        totalCalls,
        byModel,
        dailyCosts,
      },
      budget: {
        overallLimit: budget.overall,
        openaiLimit: budget.openai,
        estimatedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
        openaiMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
        overallUsedPercent: Math.round((projectedMonthlyCost / budget.overall) * 100),
        openaiUsedPercent: Math.round((projectedMonthlyCost / budget.openai) * 100),
      },
    };

    setCache(costsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch cost data:', error);
    return NextResponse.json({ error: 'Failed to fetch cost data' }, { status: 500 });
  }
}
