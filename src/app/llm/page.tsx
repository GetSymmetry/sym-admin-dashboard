'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { cn, formatCurrency, formatDuration, timeAgo, displayValue } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { DollarSign, Cpu, Clock, Zap, AlertTriangle, TrendingUp } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function LLMContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR(`/api/llm?env=${environment}&range=${timeRange}`, fetcher, {
    refreshInterval: 60000,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Format time range for display
  const formatTimeRange = (range: string) => {
    const match = range.match(/(\d+)([hdm])/);
    if (!match) return range;
    const [, num, unit] = match;
    return `${num}${unit === 'h' ? 'h' : unit === 'd' ? 'd' : 'm'}`;
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
          title="LLM & Costs"
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
                <div className="w-12 h-12 border-4 border-warning/30 border-t-warning rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading LLM metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title={`Total Cost (${formatTimeRange(timeRange)})`}
                  value={data?.totals?.totalCost != null ? formatCurrency(data.totals.totalCost) : '—'}
                  icon={DollarSign}
                  iconColor="text-warning"
                />
                <MetricCard
                  title={`Total Tokens (${formatTimeRange(timeRange)})`}
                  value={displayValue(data?.totals?.totalTokens)}
                  icon={Cpu}
                  iconColor="text-info"
                />
                <MetricCard
                  title={`Total Calls (${formatTimeRange(timeRange)})`}
                  value={displayValue(data?.totals?.totalCalls)}
                  icon={Zap}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Models Used"
                  value={displayValue(data?.byModel?.length)}
                  icon={TrendingUp}
                  iconColor="text-success"
                />
              </div>

              {/* Cost Over Time Chart */}
              <Card title="Cost Over Time" subtitle="Hourly breakdown (24h)">
                <AreaChart
                  data={data?.overTime || []}
                  xField="time"
                  yFields={[
                    { key: 'cost', color: '#f59e0b', name: 'Cost ($)' },
                  ]}
                  height={250}
                />
              </Card>

              {/* Usage by Model */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Usage by Model" subtitle="Cost breakdown">
                  <div className="space-y-3">
                    {data?.byModel?.map((model: { model: string; calls: number; totalCost: number; inputTokens: number; outputTokens: number }, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-surface-tertiary rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            index === 0 ? 'bg-warning/20 text-warning' :
                            index === 1 ? 'bg-brand-blue/20 text-brand-blue' :
                            'bg-surface-secondary text-text-muted'
                          )}>
                            <Zap size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {model.model || 'Unknown'}
                            </p>
                            <p className="text-xs text-text-muted">
                              {model.calls?.toLocaleString()} calls
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono font-semibold text-warning">
                            {formatCurrency(model.totalCost || 0)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {((model.inputTokens || 0) + (model.outputTokens || 0)).toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-text-muted text-center py-8">No LLM data available</p>
                    )}
                  </div>
                </Card>

                <Card title="Latency by Model" subtitle="Response times">
                  <div className="space-y-3">
                    {data?.latency?.map((model: { model: string; avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number }, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-surface-tertiary rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-text-primary">
                            {model.model || 'Unknown'}
                          </span>
                          <span className={cn(
                            'text-sm font-mono',
                            model.avgMs > 5000 ? 'text-error' :
                            model.avgMs > 2000 ? 'text-warning' :
                            'text-success'
                          )}>
                            avg {formatDuration(model.avgMs || 0)}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-text-muted" />
                            <span className="text-text-muted">P50:</span>
                            <span className="text-text-secondary font-mono">{formatDuration(model.p50Ms || 0)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-text-muted">P95:</span>
                            <span className="text-text-secondary font-mono">{formatDuration(model.p95Ms || 0)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-text-muted">P99:</span>
                            <span className="text-text-secondary font-mono">{formatDuration(model.p99Ms || 0)}</span>
                          </div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-text-muted text-center py-8">No latency data available</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Top Operations & Errors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Top Operations" subtitle="By cost (24h)">
                  <BarChart
                    data={data?.topOperations?.slice(0, 8) || []}
                    xField="operation"
                    yField="cost"
                    height={250}
                    horizontal
                    colors={['#f59e0b']}
                  />
                </Card>

                <Card title="LLM Errors" subtitle="By model (24h)">
                  {data?.errors?.length > 0 ? (
                    <div className="space-y-2">
                      {data.errors.map((error: { model: string; errorType: string; count: number }, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-error-light border border-error rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-error" />
                            <span className="text-sm text-text-secondary">{error.model}</span>
                            <span className="text-xs text-text-muted">• {error.errorType}</span>
                          </div>
                          <span className="text-sm font-mono text-error">{error.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48">
                      <p className="text-success">No LLM errors 🎉</p>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function LLMPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <LLMContent />
    </Suspense>
  );
}
