'use client';

import { useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import {
  ArrowLeft,
  Users,
  Database,
  Clock,
} from 'lucide-react';

/* ── Types ── */

interface WorkspaceDetail {
  id: string;
  name: string;
  organization_id: string;
  organization_name: string;
  created_at: string;
  goal: string | null;
  member_count: number;
}

interface GraphStats {
  node_count: number;
  edge_count: number;
}

interface JobStat {
  status: string;
  job_type: string;
  count: number;
  avg_duration_secs: number | null;
}

interface WorkspaceHealth {
  workspace: WorkspaceDetail | null;
  job_stats: JobStat[];
  graph_stats: GraphStats;
  health_score: string;
  failed_jobs: number;
  total_jobs: number;
}

interface WorkspaceJob {
  id: string;
  job_type: string;
  status: string;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
  blob_path: string | null;
}

/* ── Content ── */

function WorkspaceDetailContent() {
  const params = useParams();
  const workspaceId = params.id as string;

  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: workspace, isLoading: wsLoading, refresh } =
    useDebugger<WorkspaceDetail>(`/debug/workspaces/${workspaceId}`);

  const { data: health, isLoading: healthLoading } =
    useDebugger<WorkspaceHealth>(`/debug/workspaces/${workspaceId}/health`);

  const { data: jobs, isLoading: jobsLoading } =
    useDebugger<WorkspaceJob[]>(`/debug/workspaces/${workspaceId}/jobs`, { limit: '20' });

  const isLoading = wsLoading && !workspace;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={workspace?.name || 'Workspace Detail'}
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || wsLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Back link */}
          <Link
            href="/workspaces"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Workspaces
          </Link>

          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-32 bg-surface rounded-card border border-border-subtle" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Workspace Info */}
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">{workspace?.name}</h2>
                    <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                      <span className="font-mono">{workspace?.id}</span>
                      <span>&middot;</span>
                      <span>{workspace?.organization_name}</span>
                    </div>
                    {workspace?.goal && (
                      <p className="text-sm text-text-secondary mt-2">{workspace.goal}</p>
                    )}
                  </div>
                  {health && (
                    <StatusBadge status={health.health_score} pulse={health.health_score !== 'healthy'} />
                  )}
                </div>
              </Card>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Members"
                  value={workspace?.member_count ?? '—'}
                  icon={Users}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Graph Nodes"
                  value={health?.graph_stats?.node_count ?? '—'}
                  icon={Database}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Graph Edges"
                  value={health?.graph_stats?.edge_count ?? '—'}
                  icon={Database}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Created"
                  value={workspace?.created_at ? timeAgo(workspace.created_at) : '—'}
                  format="raw"
                  icon={Clock}
                  iconColor="text-text-muted"
                />
              </div>

              {/* Health + Job Stats */}
              {health && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="Health Overview">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Health Score</span>
                        <StatusBadge status={health.health_score} />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Graph Nodes</span>
                        <span className="text-sm font-mono text-text-primary">{formatNumber(health.graph_stats?.node_count ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Graph Edges</span>
                        <span className="text-sm font-mono text-text-primary">{formatNumber(health.graph_stats?.edge_count ?? 0)}</span>
                      </div>
                    </div>
                  </Card>

                  <Card title="Job Summary">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Total Jobs</span>
                        <span className="text-sm font-mono text-text-primary">
                          {health.total_jobs}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Failed Jobs</span>
                        <span className={cn(
                          'text-sm font-mono',
                          health.failed_jobs > 0 ? 'text-status-error' : 'text-text-primary'
                        )}>
                          {health.failed_jobs}
                        </span>
                      </div>
                      {health.job_stats?.length > 0 && health.job_stats.map((stat, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                          <span className="text-sm text-text-muted">{stat.job_type} ({stat.status})</span>
                          <span className="text-sm font-mono text-text-primary">{stat.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Recent Jobs */}
              <Card title="Recent Jobs" subtitle="Last 20 jobs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                        <th className="text-center py-2 px-3 text-text-muted font-medium">Status</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Retries</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Created</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs && jobs.length > 0 ? (
                        jobs.map((job) => (
                          <tr key={job.id} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                            <td className="py-2 px-3 text-text-primary font-medium">{job.job_type}</td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge status={job.status} />
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-text-secondary">
                              {job.retry_count ?? 0}
                            </td>
                            <td className="py-2 px-3 text-right text-text-muted text-xs">
                              {timeAgo(job.created_at)}
                            </td>
                            <td className="py-2 px-3 text-right text-text-muted text-xs">
                              {job.completed_at ? timeAgo(job.completed_at) : '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-muted">
                            {jobsLoading ? 'Loading jobs...' : 'No jobs found'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function WorkspaceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <WorkspaceDetailContent />
    </Suspense>
  );
}
