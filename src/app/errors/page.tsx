'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AreaChart } from '@/components/charts/AreaChart';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, timeAgo } from '@/lib/utils';
import {
  AlertTriangle,
  Server,
  Layers,
} from 'lucide-react';

/* ── Types ── */

interface TimelinePoint {
  timestamp: string;
  cloud_RoleName: string;
  count_: number;
}

interface ErrorCluster {
  problemId: string;
  type: string;
  outerMessage: string;
  cloud_RoleName: string;
  count_: number;
  earliest: string;
  latest: string;
}

interface FailedJob {
  id: string;
  job_type: string;
  status: string;
  retry_count: number;
  created_at: string;
  completed_at: string;
  workspace_name: string;
}

/* ── Skeleton ── */

function ErrorsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="h-52 bg-surface rounded-card border border-border-subtle" />
      <div className="h-80 bg-surface rounded-card border border-border-subtle" />
    </div>
  );
}

/* ── Content ── */

function ErrorsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: timeline, isLoading: tlLoading, refresh } =
    useDebugger<TimelinePoint[]>('/debug/errors/timeline', { timeRange });

  const { data: clusters, isLoading: clLoading } =
    useDebugger<ErrorCluster[]>('/debug/errors/clusters', { timeRange });

  const { data: failedJobs, isLoading: fjLoading } =
    useDebugger<FailedJob[]>('/debug/errors/failed-jobs', { timeRange, limit: '25' });

  const isLoading = tlLoading && !timeline;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const totalErrors = timeline?.reduce((sum, p) => sum + (p.count_ ?? 0), 0) ?? 0;
  const uniqueServices = clusters
    ? new Set(clusters.map((c) => c.cloud_RoleName)).size
    : 0;
  const topClusterCount = clusters?.[0]?.count_ ?? 0;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Errors"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || tlLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <ErrorsSkeleton />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title={`Total Errors (${timeRange})`}
                  value={totalErrors}
                  icon={AlertTriangle}
                  iconColor={totalErrors > 0 ? 'text-status-error' : 'text-status-success'}
                />
                <MetricCard
                  title="Top Cluster"
                  value={topClusterCount}
                  icon={AlertTriangle}
                  iconColor={topClusterCount > 10 ? 'text-status-error' : 'text-status-warning'}
                />
                <MetricCard
                  title="Error Clusters"
                  value={clusters?.length ?? '—'}
                  icon={Layers}
                  iconColor="text-status-warning"
                />
                <MetricCard
                  title="Services Affected"
                  value={uniqueServices}
                  icon={Server}
                  iconColor="text-brand-blue"
                />
              </div>

              {/* Timeline Chart */}
              <Card title="Error Timeline" subtitle={`${timeRange} — by service`}>
                {timeline && timeline.length > 0 ? (
                  <AreaChart
                    data={timeline}
                    xField="timestamp"
                    yFields={[
                      { key: 'count_', color: '#ef4444', name: 'Errors' },
                    ]}
                    height={200}
                  />
                ) : (
                  <p className="text-status-success text-center py-8">No errors in this timeframe</p>
                )}
              </Card>

              {/* Error Clusters Table */}
              <Card title="Error Clusters" subtitle="Grouped by problem ID">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Message</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Service</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Count</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Latest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clusters && clusters.length > 0 ? (
                        clusters.map((c) => (
                          <tr key={c.problemId} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                            <td className="py-2 px-3 font-mono text-text-secondary text-xs">{c.type}</td>
                            <td className="py-2 px-3 text-text-primary max-w-xs truncate">{c.outerMessage}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded text-xs font-medium">
                                {c.cloud_RoleName}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-status-error font-semibold">{c.count_}</td>
                            <td className="py-2 px-3 text-right text-text-muted text-xs">{timeAgo(c.latest)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-muted">
                            No error clusters found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Failed Jobs */}
              <Card title="Failed Jobs" subtitle={`Recent failures (${timeRange})`}>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {failedJobs && failedJobs.length > 0 ? (
                    failedJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-start justify-between p-3 bg-status-error/5 border border-status-error/20 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono text-text-primary truncate">{job.job_type} — {job.workspace_name ?? 'unknown'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-surface-tertiary rounded text-text-muted">
                              {job.job_type}
                            </span>
                            <span className="text-xs text-text-muted font-mono">
                              {job.workspace_name ?? 'N/A'}
                            </span>
                            <span className="text-xs text-text-muted">
                              {job.retry_count} retr{job.retry_count !== 1 ? 'ies' : 'y'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-text-muted shrink-0 ml-4">{timeAgo(job.created_at)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-status-success text-center py-8">No failed jobs</p>
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
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <ErrorsContent />
    </Suspense>
  );
}
