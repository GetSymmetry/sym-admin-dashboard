'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Gauge } from '@/components/ui/Gauge';
import { BarChart } from '@/components/charts/BarChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { cn, timeAgo, formatCurrency } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { DollarSign, TrendingUp, Wallet, PiggyBank, Coins, BarChart3, Server, CalendarRange } from 'lucide-react';

/* ── Types ── */

interface ModelCost {
  model: string;
  calls: number;
  total_input: number;
  total_output: number;
  total_tokens: number;
  cost: number;
}

interface DailyCost {
  date: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
}

interface LLMCostsData {
  total_cost: number;
  total_tokens: number;
  total_calls: number;
  by_model: ModelCost[];
  daily_costs: DailyCost[];
  budget: {
    estimated_monthly: number;
    daily_average: number;
  };
}

/* ── Infra costs types ── */

interface InfraResourceCost {
  resource_name: string;
  resource_type: string;
  cost: number;
}

interface InfraCostsForecast {
  daily_average: number;
  projected_30d: number;
  projected_90d: number;
  based_on_days: number;
}

interface InfraCostsData {
  daily: any[];
  breakdown: any[];
  resource_costs: InfraResourceCost[];
  forecast: InfraCostsForecast;
}

/* ── Budget limits (not provided by debugger endpoint) ── */
const BUDGET_OVERALL_LIMIT = 500;
const BUDGET_OPENAI_LIMIT = 400;

function CostsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data, metadata, error, isLoading, refresh } = useDebugger<LLMCostsData>(
    '/debug/infra/llm/costs',
    { days: '30' },
    { refreshInterval: 300000 }
  );

  const { data: infraData, isLoading: infraLoading } = useDebugger<InfraCostsData>(
    '/debug/infra/costs',
    { days: '30' },
    { refreshInterval: 300000 }
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const estimatedMonthly = data?.budget?.estimated_monthly || 0;
  const overallUsedPercent = BUDGET_OVERALL_LIMIT > 0
    ? (estimatedMonthly / BUDGET_OVERALL_LIMIT) * 100
    : 0;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Costs & Budget"
          environment="prod"
          lastUpdated={metadata?.timestamp ? timeAgo(metadata.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading && !data ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading cost data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="LLM Cost (Period)"
                  value={formatCurrency(data?.total_cost || 0)}
                  format="raw"
                  icon={DollarSign}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="LLM Calls"
                  value={data?.total_calls || 0}
                  icon={Coins}
                  iconColor="text-info"
                />
                <MetricCard
                  title="Projected Monthly"
                  value={formatCurrency(estimatedMonthly)}
                  format="raw"
                  icon={TrendingUp}
                  iconColor={
                    overallUsedPercent > 80
                      ? 'text-status-error'
                      : 'text-status-success'
                  }
                />
                <MetricCard
                  title="Daily Average"
                  value={formatCurrency(data?.budget?.daily_average || 0)}
                  format="raw"
                  icon={PiggyBank}
                  iconColor="text-brand-blue"
                />
              </div>

              {/* Budget Gauges */}
              <Card title="Budget Utilization" subtitle="Projected monthly vs budget limits">
                <div className="flex justify-around items-center py-4">
                  <div className="text-center">
                    <Gauge
                      value={Math.min(overallUsedPercent, 100)}
                      label="Overall"
                      thresholds={[
                        { value: 90, color: 'rgb(239 68 68)' },
                        { value: 75, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                    <p className="text-body-xs text-text-muted mt-2">
                      {formatCurrency(estimatedMonthly)} / {formatCurrency(BUDGET_OVERALL_LIMIT)}
                    </p>
                  </div>
                  <div className="text-center">
                    <Gauge
                      value={Math.min(
                        BUDGET_OPENAI_LIMIT > 0
                          ? (estimatedMonthly / BUDGET_OPENAI_LIMIT) * 100
                          : 0,
                        100
                      )}
                      label="OpenAI"
                      thresholds={[
                        { value: 90, color: 'rgb(239 68 68)' },
                        { value: 75, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                    <p className="text-body-xs text-text-muted mt-2">
                      {formatCurrency(estimatedMonthly)} / {formatCurrency(BUDGET_OPENAI_LIMIT)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Cost Over Time */}
              {data?.daily_costs && data.daily_costs.length > 0 && (
                <Card title="LLM Cost Over Time" subtitle="Daily spend">
                  <AreaChart
                    data={data.daily_costs.map(d => ({
                      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      cost: d.cost,
                    }))}
                    xField="name"
                    yFields={[{ key: 'cost', color: '#3b82f6', name: 'Cost ($)' }]}
                    height={250}
                  />
                </Card>
              )}

              {/* Cost by Model */}
              {data?.by_model && data.by_model.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="Cost by Model">
                    <BarChart
                      data={data.by_model.map(m => ({
                        name: m.model,
                        cost: m.cost,
                      }))}
                      xField="name"
                      yField="cost"
                      height={250}
                    />
                  </Card>

                  <Card title="Usage by Model">
                    <div className="space-y-3">
                      {data.by_model.map((model) => (
                        <div
                          key={model.model}
                          className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg"
                        >
                          <div>
                            <p className="text-body-small font-medium text-text-primary">{model.model}</p>
                            <p className="text-body-xs text-text-muted">
                              {model.calls.toLocaleString()} calls &middot; {(model.total_tokens / 1000).toFixed(1)}K tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-body-base font-bold font-mono text-text-primary">
                              {formatCurrency(model.cost)}
                            </p>
                            <p className="text-body-xs text-text-muted">
                              ${(model.total_tokens > 0 ? (model.cost / model.total_tokens * 1_000_000) : 0).toFixed(2)}/1M tokens
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Token Usage Over Time */}
              {data?.daily_costs && data.daily_costs.length > 0 && (
                <Card title="Token Usage Over Time" subtitle="Daily token consumption">
                  <AreaChart
                    data={data.daily_costs.map(d => ({
                      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      tokens: d.total_tokens,
                    }))}
                    xField="name"
                    yFields={[{ key: 'tokens', color: '#10b981', name: 'Tokens' }]}
                    height={200}
                  />
                </Card>
              )}

              {(!data?.by_model || data.by_model.length === 0) && (
                <Card>
                  <div className="text-center py-8 text-text-muted">
                    <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No LLM cost data found for selected time range.</p>
                    <p className="text-body-xs mt-1">Try selecting a longer time range (e.g., 30d).</p>
                  </div>
                </Card>
              )}

              {/* ── Infrastructure Costs ── */}
              <div className="pt-4 border-t border-border-subtle">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Infrastructure Costs</h2>

                {infraLoading && !infraData ? (
                  <div className="text-center py-8 text-text-muted">Loading infra cost data...</div>
                ) : (
                  <>
                    {/* Forecast Cards */}
                    {infraData?.forecast && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <MetricCard
                          title="Daily Average"
                          value={formatCurrency(infraData.forecast.daily_average)}
                          format="raw"
                          icon={CalendarRange}
                          iconColor="text-info"
                        />
                        <MetricCard
                          title="Projected 30d"
                          value={formatCurrency(infraData.forecast.projected_30d)}
                          format="raw"
                          icon={TrendingUp}
                          iconColor="text-brand-blue"
                        />
                        <MetricCard
                          title="Projected 90d"
                          value={formatCurrency(infraData.forecast.projected_90d)}
                          format="raw"
                          icon={TrendingUp}
                          iconColor="text-status-warning"
                        />
                        <MetricCard
                          title="Based On"
                          value={`${infraData.forecast.based_on_days}d`}
                          format="raw"
                          icon={Server}
                          iconColor="text-text-muted"
                        />
                      </div>
                    )}

                    {/* Cost by Resource Table */}
                    {infraData?.resource_costs && infraData.resource_costs.length > 0 && (
                      <Card title="Cost by Resource" subtitle="Top 20 resources by cost (30d)">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border-subtle">
                                <th className="text-left py-2 px-3 text-text-muted font-medium">Resource</th>
                                <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                                <th className="text-right py-2 px-3 text-text-muted font-medium">Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {infraData.resource_costs.slice(0, 20).map((r, i) => (
                                <tr key={i} className="border-b border-border-subtle/50">
                                  <td className="py-2 px-3 text-text-primary font-mono text-xs">{r.resource_name}</td>
                                  <td className="py-2 px-3 text-text-secondary text-xs">{r.resource_type}</td>
                                  <td className="py-2 px-3 text-right text-text-primary font-mono font-semibold">
                                    {formatCurrency(r.cost)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}

                    {(!infraData?.resource_costs || infraData.resource_costs.length === 0) && !infraData?.forecast && (
                      <Card>
                        <div className="text-center py-8 text-text-muted">
                          <Server size={48} className="mx-auto mb-3 opacity-30" />
                          <p>No infrastructure cost data available.</p>
                        </div>
                      </Card>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function CostsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-surface-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <CostsContent />
    </Suspense>
  );
}
