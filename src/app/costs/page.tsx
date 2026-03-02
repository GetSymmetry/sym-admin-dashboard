'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Gauge } from '@/components/ui/Gauge';
import { BarChart } from '@/components/charts/BarChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { cn, timeAgo, formatCurrency } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { DollarSign, TrendingUp, Wallet, PiggyBank, Coins, BarChart3 } from 'lucide-react';
import type { CostsResponse } from '@/types/metrics';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function CostsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR<CostsResponse>(
    `/api/costs?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 300000 } // 5 minutes
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment={environment}
        onEnvironmentChange={setEnvironment}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Costs & Budget"
          environment={environment}
          lastUpdated={data?.timestamp ? timeAgo(data.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
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
                  value={formatCurrency(data?.llm?.totalCost || 0)}
                  format="raw"
                  icon={DollarSign}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="LLM Calls"
                  value={data?.llm?.totalCalls || 0}
                  icon={Coins}
                  iconColor="text-info"
                />
                <MetricCard
                  title="Projected Monthly"
                  value={formatCurrency(data?.budget?.estimatedMonthlyCost || 0)}
                  format="raw"
                  icon={TrendingUp}
                  iconColor={
                    (data?.budget?.overallUsedPercent || 0) > 80
                      ? 'text-status-error'
                      : 'text-status-success'
                  }
                />
                <MetricCard
                  title="Monthly Budget"
                  value={formatCurrency(data?.budget?.overallLimit || 0)}
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
                      value={Math.min(data?.budget?.overallUsedPercent || 0, 100)}
                      label="Overall"
                      thresholds={[
                        { value: 90, color: 'rgb(239 68 68)' },
                        { value: 75, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                    <p className="text-body-xs text-text-muted mt-2">
                      {formatCurrency(data?.budget?.estimatedMonthlyCost || 0)} / {formatCurrency(data?.budget?.overallLimit || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <Gauge
                      value={Math.min(data?.budget?.openaiUsedPercent || 0, 100)}
                      label="OpenAI"
                      thresholds={[
                        { value: 90, color: 'rgb(239 68 68)' },
                        { value: 75, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                    <p className="text-body-xs text-text-muted mt-2">
                      {formatCurrency(data?.budget?.openaiMonthlyCost || 0)} / {formatCurrency(data?.budget?.openaiLimit || 0)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Cost Over Time */}
              {data?.llm?.dailyCosts && data.llm.dailyCosts.length > 0 && (
                <Card title="LLM Cost Over Time" subtitle="Daily spend">
                  <AreaChart
                    data={data.llm.dailyCosts.map(d => ({
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
              {data?.llm?.byModel && data.llm.byModel.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="Cost by Model">
                    <BarChart
                      data={data.llm.byModel.map(m => ({
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
                      {data.llm.byModel.map((model) => (
                        <div
                          key={model.model}
                          className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg"
                        >
                          <div>
                            <p className="text-body-small font-medium text-text-primary">{model.model}</p>
                            <p className="text-body-xs text-text-muted">
                              {model.calls.toLocaleString()} calls &middot; {(model.tokens / 1000).toFixed(1)}K tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-body-base font-bold font-mono text-text-primary">
                              {formatCurrency(model.cost)}
                            </p>
                            <p className="text-body-xs text-text-muted">
                              ${(model.tokens > 0 ? (model.cost / model.tokens * 1_000_000) : 0).toFixed(2)}/1M tokens
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Token Usage Over Time */}
              {data?.llm?.dailyCosts && data.llm.dailyCosts.length > 0 && (
                <Card title="Token Usage Over Time" subtitle="Daily token consumption">
                  <AreaChart
                    data={data.llm.dailyCosts.map(d => ({
                      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      tokens: d.tokens,
                    }))}
                    xField="name"
                    yFields={[{ key: 'tokens', color: '#10b981', name: 'Tokens' }]}
                    height={200}
                  />
                </Card>
              )}

              {(!data?.llm?.byModel || data.llm.byModel.length === 0) && (
                <Card>
                  <div className="text-center py-8 text-text-muted">
                    <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No LLM cost data found for selected time range.</p>
                    <p className="text-body-xs mt-1">Try selecting a longer time range (e.g., 30d).</p>
                  </div>
                </Card>
              )}
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
