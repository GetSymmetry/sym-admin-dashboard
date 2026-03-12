'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
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
  TrendingUp,
  TrendingDown,
  Server,
  ExternalLink,
  Layers,
} from 'lucide-react';

/* ── Types ── */

interface TimelinePoint {
  time: string;
  count: number;
  severity_3: number;
  severity_4: number;
}

interface ErrorCluster {
  problem_id: string;
  type: string;
  message: string;
  service: string;
  count: number;
  earliest: string;
  latest: string;
}

interface FailedJob {
  id: string;
  job_type: string;
  workspace_id: string;
  error_message: string;
  failed_at: string;
  attempts: number;
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

  const totalErrors = timeline?.reduce((sum, p) => sum + p.count, 0) ?? 0;
  const totalSev4 = timeline?.reduce((sum, p) => sum + (p.severity_4 ?? 0), 0) ?? 0;
  const uniqueServices = clusters
    ? new Set(clusters.map((c) => c.service)).size
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
                  title="Critical (Sev 4)"
                  value={totalSev4}
                  icon={AlertTriangle}
                  iconColor={totalSev4 > 0 ? 'text-status-error' : 'text-status-success'}
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
              <Card title="Error Timeline" subtitle={`${timeRange} — by severity`}>
                {timeline && timeline.length > 0 ? (
                  <AreaChart
                    data={timeline}
                    xField="time"
                    yFields={[
                      { key: 'severity_3', color: '#f59e0b', name: 'Warning (3)' },
                      { key: 'severity_4', color: '#ef4444', name: 'Error (4)' },
                    ]}
                    height={200}
                    stacked
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
                          <tr key={c.problem_id} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                            <td className="py-2 px-3 font-mono text-text-secondary text-xs">{c.type}</td>
                            <td className="py-2 px-3 text-text-primary max-w-xs truncate">{c.message}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded text-xs font-medium">
                                {c.service}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-status-error font-semibold">{c.count}</td>
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
                          <p className="text-sm font-mono text-text-primary truncate">{job.error_message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-surface-tertiary rounded text-text-muted">
                              {job.job_type}
                            </span>
                            <span className="text-xs text-text-muted font-mono">
                              ws:{job.workspace_id.substring(0, 8)}
                            </span>
                            <span className="text-xs text-text-muted">
                              {job.attempts} attempt{job.attempts !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-text-muted shrink-0 ml-4">{timeAgo(job.failed_at)}</span>
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
