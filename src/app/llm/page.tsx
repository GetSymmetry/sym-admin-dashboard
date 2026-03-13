'use client';

import { useState, Suspense, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { cn, formatDuration, displayValue } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { Cpu, Clock, Zap, AlertTriangle, TrendingUp } from 'lucide-react';

/* ── Types ── */

interface LLMTotals {
  total_calls: number;
  total_errors: number;
  avg_duration: number;
  p95_duration: number;
}

interface LLMOverTimePoint {
  timestamp: string;
  requests: number;
  errors: number;
  avg_duration: number;
}

interface LLMLatencyEntry {
  name: string;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

interface LLMTokenBreakdown {
  model: string;
  service: string;
  calls: number;
  total_input: number;
  total_output: number;
  avg_latency_ms: number;
}

interface LLMMetricsData {
  totals: LLMTotals;
  over_time: LLMOverTimePoint[];
  latency: LLMLatencyEntry[];
  token_breakdown?: LLMTokenBreakdown[];
}

/* ── Helpers ── */

/** Convert time range string (e.g. '24h', '7d') to hours for the debugger API. */
function timeRangeToHours(range: string): string {
  const match = range.match(/^(\d+)(h|d)$/);
  if (!match) return '24';
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return String(unit === 'd' ? value * 24 : value);
}

/** Format time range for display labels. */
function formatTimeRange(range: string): string {
  const match = range.match(/(\d+)([hdm])/);
  if (!match) return range;
  const [, num, unit] = match;
  return `${num}${unit === 'h' ? 'h' : unit === 'd' ? 'd' : 'm'}`;
}

/* ── Content ── */

function LLMContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const hours = useMemo(() => timeRangeToHours(timeRange), [timeRange]);

  const { data, isLoading, refresh } = useDebugger<LLMMetricsData>(
    '/debug/infra/llm/metrics',
    { hours },
    { refreshInterval: 60000 }
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const errorRate =
    data?.totals && data.totals.total_calls > 0
      ? ((data.totals.total_errors / data.totals.total_calls) * 100).toFixed(1)
      : '0';

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="LLM Metrics"
          environment="prod"
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
                <div className="w-12 h-12 border-4 border-warning/30 border-t-warning rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading LLM metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title={`Total Calls (${formatTimeRange(timeRange)})`}
                  value={displayValue(data?.totals?.total_calls)}
                  icon={Zap}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title={`Total Errors (${formatTimeRange(timeRange)})`}
                  value={displayValue(data?.totals?.total_errors)}
                  icon={AlertTriangle}
                  iconColor={data?.totals?.total_errors ? 'text-error' : 'text-success'}
                />
                <MetricCard
                  title="Avg Duration"
                  value={data?.totals?.avg_duration != null ? formatDuration(data.totals.avg_duration) : '--'}
                  icon={Clock}
                  iconColor="text-info"
                />
                <MetricCard
                  title="P95 Duration"
                  value={data?.totals?.p95_duration != null ? formatDuration(data.totals.p95_duration) : '--'}
                  icon={TrendingUp}
                  iconColor="text-warning"
                />
              </div>

              {/* Error Rate Banner */}
              {data?.totals && data.totals.total_errors > 0 && (
                <div className="flex items-center gap-3 p-4 bg-error/5 border border-error/20 rounded-lg">
                  <AlertTriangle size={18} className="text-error" />
                  <span className="text-sm text-text-secondary">
                    Error rate: <span className="font-mono font-semibold text-error">{errorRate}%</span>
                    {' '}({data.totals.total_errors.toLocaleString()} errors out of {data.totals.total_calls.toLocaleString()} calls)
                  </span>
                </div>
              )}

              {/* Requests Over Time Chart */}
              <Card title="Requests Over Time" subtitle={`Hourly breakdown (${formatTimeRange(timeRange)})`}>
                <AreaChart
                  data={data?.over_time || []}
                  xField="timestamp"
                  yFields={[
                    { key: 'requests', color: '#3b82f6', name: 'Requests' },
                    { key: 'errors', color: '#ef4444', name: 'Errors' },
                  ]}
                  height={250}
                />
              </Card>

              {/* Avg Duration Over Time + Latency by Model */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Avg Duration Over Time" subtitle="Response time trend">
                  <AreaChart
                    data={data?.over_time || []}
                    xField="timestamp"
                    yFields={[
                      { key: 'avg_duration', color: '#f59e0b', name: 'Avg Duration (ms)' },
                    ]}
                    height={250}
                  />
                </Card>

                <Card title="Latency by Model" subtitle="Response times">
                  <div className="space-y-3">
                    {data?.latency && data.latency.length > 0 ? (
                      data.latency.map((entry, index) => (
                        <div
                          key={index}
                          className="p-4 bg-surface-tertiary rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-text-primary">
                              {entry.name || 'Unknown'}
                            </span>
                            <span className={cn(
                              'text-sm font-mono',
                              entry.avg_ms > 5000 ? 'text-error' :
                              entry.avg_ms > 2000 ? 'text-warning' :
                              'text-success'
                            )}>
                              avg {formatDuration(entry.avg_ms || 0)}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-text-muted" />
                              <span className="text-text-muted">P50:</span>
                              <span className="text-text-secondary font-mono">{formatDuration(entry.p50_ms || 0)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted">P95:</span>
                              <span className="text-text-secondary font-mono">{formatDuration(entry.p95_ms || 0)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-text-muted">P99:</span>
                              <span className="text-text-secondary font-mono">{formatDuration(entry.p99_ms || 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-muted text-center py-8">No latency data available</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Token Usage by Model & Service */}
              {data?.token_breakdown && data.token_breakdown.length > 0 && (
                <Card title="Token Usage by Model & Service" subtitle="Breakdown of token consumption">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Model</th>
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Service</th>
                          <th className="text-right py-2 px-3 text-text-muted font-medium">Calls</th>
                          <th className="text-right py-2 px-3 text-text-muted font-medium">Input Tokens</th>
                          <th className="text-right py-2 px-3 text-text-muted font-medium">Output Tokens</th>
                          <th className="text-right py-2 px-3 text-text-muted font-medium">Avg Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.token_breakdown.map((row, i) => (
                          <tr key={i} className="border-b border-border-subtle/50">
                            <td className="py-2 px-3 text-text-primary font-mono text-xs">{row.model}</td>
                            <td className="py-2 px-3 text-text-secondary text-xs">{row.service}</td>
                            <td className="py-2 px-3 text-right text-text-primary font-mono">{row.calls.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-text-secondary font-mono">{row.total_input.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-text-secondary font-mono">{row.total_output.toLocaleString()}</td>
                            <td className={cn(
                              'py-2 px-3 text-right font-mono',
                              row.avg_latency_ms > 5000 ? 'text-error' :
                              row.avg_latency_ms > 2000 ? 'text-warning' :
                              'text-success'
                            )}>
                              {formatDuration(row.avg_latency_ms)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
