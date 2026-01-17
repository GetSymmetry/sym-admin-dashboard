'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { cn, timeAgo } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { AlertTriangle, TrendingUp, TrendingDown, Server, ExternalLink } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function ErrorsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR(
    `/api/errors?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 30000 }
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
          title="Errors"
          environment={environment}
          lastUpdated={data?.timestamp ? timeAgo(data.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            {['1h', '6h', '24h', '7d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  timeRange === range
                    ? 'bg-error-light text-error border border-error'
                    : 'bg-surface text-text-muted border border-border-subtle hover:border-border'
                )}
              >
                {range}
              </button>
            ))}
          </div>

          {isLoading && !data ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-error/30 border-t-error rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading error data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title={`Total Errors (${timeRange})`}
                  value={data?.summary?.totalErrors || 0}
                  icon={AlertTriangle}
                  iconColor={data?.summary?.totalErrors > 0 ? 'text-error' : 'text-success'}
                />
                <MetricCard
                  title="Trend vs Previous"
                  value={`${data?.summary?.trend > 0 ? '+' : ''}${data?.summary?.trend?.toFixed(1) || 0}%`}
                  format="raw"
                  icon={data?.summary?.trend > 0 ? TrendingUp : TrendingDown}
                  iconColor={data?.summary?.trend > 0 ? 'text-error' : 'text-success'}
                />
                <MetricCard
                  title="Services Affected"
                  value={data?.byService?.length || 0}
                  format="raw"
                  icon={Server}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Error Types"
                  value={new Set(data?.byType?.map((e: { type: string }) => e.type)).size || 0}
                  format="raw"
                  icon={AlertTriangle}
                  iconColor="text-warning"
                />
              </div>

              {/* Errors Over Time */}
              <Card title="Errors Over Time" subtitle="Last 24 hours">
                <AreaChart
                  data={data?.overTime || []}
                  xField="time"
                  yFields={[
                    { key: 'count', color: '#ef4444', name: 'Errors' },
                  ]}
                  height={200}
                />
              </Card>

              {/* Errors by Service & Top Endpoints */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Errors by Service" subtitle={`Last ${timeRange}`}>
                  <BarChart
                    data={data?.byService || []}
                    xField="service"
                    yField="count"
                    height={200}
                    horizontal
                    colors={['#ef4444', '#f59e0b', '#f59e0b', '#22c55e']}
                  />
                </Card>

                <Card title="Top Error Endpoints" subtitle={`Last ${timeRange}`}>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {data?.topEndpoints?.length > 0 ? (
                      data.topEndpoints.map((endpoint: { path: string; count: number }, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg"
                        >
                          <span className="text-sm font-mono text-text-secondary truncate max-w-[200px]">
                            {endpoint.path}
                          </span>
                          <span className="text-sm font-mono text-error ml-2">
                            {endpoint.count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <p className="text-success text-sm">No error endpoints! 🎉</p>
                        <p className="text-text-tertiary text-xs mt-1">All endpoints healthy</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Recent Errors List */}
              <Card title="Recent Errors" subtitle={`Last ${timeRange} (showing 50)`}>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {data?.recent?.length > 0 ? (
                    data.recent.map((error: {
                      timestamp: string;
                      message: string;
                      service: string;
                      path: string;
                      userId: string;
                      correlationId: string;
                      severity: number;
                    }, index: number) => (
                      <div
                        key={index}
                        className={cn(
                          'p-4 rounded-lg border transition-colors cursor-pointer',
                          error.severity >= 4
                            ? 'bg-error-light border-error hover:border-error'
                            : 'bg-surface-tertiary border-border-subtle hover:border-border'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-secondary font-mono break-words">
                              {error.message}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                              <span className={cn(
                                'px-2 py-0.5 rounded',
                                error.severity >= 4 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                              )}>
                                {error.service || 'Unknown'}
                              </span>
                              {error.path && (
                                <span className="text-text-muted font-mono truncate max-w-[200px]">
                                  {error.path}
                                </span>
                              )}
                              {error.correlationId && (
                                <span className="text-text-tertiary font-mono">
                                  ID: {error.correlationId.substring(0, 8)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-muted">
                              {timeAgo(error.timestamp)}
                            </span>
                            <ExternalLink size={14} className="text-text-tertiary" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-48">
                      <div className="text-center">
                        <p className="text-success text-lg font-medium">No errors! 🎉</p>
                        <p className="text-text-muted text-sm mt-1">All systems running smoothly</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ErrorsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <ErrorsContent />
    </Suspense>
  );
}
