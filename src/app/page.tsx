'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BarChart } from '@/components/charts/BarChart';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { formatCurrency, formatNumber, cn, timeAgo } from '@/lib/utils';
import {
  Activity,
  Users,
  Briefcase,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Zap,
} from 'lucide-react';

/* ── Response types ── */

interface PulseMetrics {
  total_users: number;
  active_users_7d: number;
  total_workspaces: number;
  total_conversations: number;
  error_rate: number;
  avg_latency_ms: number;
}

interface TopWorkspace {
  id: string;
  name: string;
  organization: string;
  conversations: number;
  knowledge_units: number;
  last_active: string;
}

interface PipelineStep {
  stage: string;
  status: string;
  jobs_pending: number;
  jobs_failed_24h: number;
  avg_duration_secs: number;
}

interface CostItem {
  service: string;
  cost: number;
  currency: string;
}

/* ── Skeleton ── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-surface rounded-card border border-border-subtle" />
        <div className="h-80 bg-surface rounded-card border border-border-subtle" />
      </div>
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
    </div>
  );
}

/* ── Main content ── */

function DashboardContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: pulse, isLoading: pulseLoading, refresh: refreshPulse } =
    useDebugger<PulseMetrics>('/debug/insights/pulse', { timeRange }, { refreshInterval: 60000 });

  const { data: topWorkspaces, isLoading: wsLoading } =
    useDebugger<TopWorkspace[]>('/debug/insights/top-workspaces', { timeRange, limit: '10' });

  const { data: pipeline, isLoading: pipeLoading } =
    useDebugger<PipelineStep[]>('/debug/insights/pipeline-health');

  const { data: costs, isLoading: costLoading } =
    useDebugger<CostItem[]>('/debug/insights/cost-breakdown', { timeRange });

  const isLoading = pulseLoading && !pulse;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPulse();
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
          title="System Overview"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || pulseLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Pulse Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Users"
                  value={pulse?.total_users ?? '—'}
                  icon={Users}
                  subtitle={pulse?.active_users_7d != null ? `${formatNumber(pulse.active_users_7d)} active 7d` : undefined}
                />
                <MetricCard
                  title="Workspaces"
                  value={pulse?.total_workspaces ?? '—'}
                  icon={Briefcase}
                  subtitle="Active workspaces"
                />
                <MetricCard
                  title="Conversations"
                  value={pulse?.total_conversations ?? '—'}
                  icon={Activity}
                  subtitle="Total sessions"
                />
                <MetricCard
                  title="Error Rate"
                  value={pulse?.error_rate != null ? `${pulse.error_rate.toFixed(2)}%` : '—'}
                  format="raw"
                  icon={AlertTriangle}
                  iconColor={pulse?.error_rate != null && pulse.error_rate > 1 ? 'text-status-error' : 'text-status-success'}
                  subtitle={pulse?.avg_latency_ms != null ? `${pulse.avg_latency_ms.toFixed(0)}ms avg latency` : undefined}
                />
              </div>

              {/* Two-column: Top Workspaces + Pipeline Health */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Workspaces */}
                <Card title="Top Workspaces" subtitle="By activity">
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {wsLoading && !topWorkspaces ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                      </div>
                    ) : topWorkspaces && topWorkspaces.length > 0 ? (
                      topWorkspaces.map((ws) => (
                        <div
                          key={ws.id}
                          className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg hover:bg-surface-hover transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                            <p className="text-xs text-text-muted truncate">{ws.organization}</p>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <p className="text-sm font-mono text-text-primary">
                              {ws.conversations.toLocaleString()} convos
                            </p>
                            <p className="text-xs text-text-muted">
                              {ws.knowledge_units.toLocaleString()} KUs
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-muted text-center py-8">No workspace data</p>
                    )}
                  </div>
                </Card>

                {/* Pipeline Health */}
                <Card title="Pipeline Health" subtitle="Processing stages">
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {pipeLoading && !pipeline ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                      </div>
                    ) : pipeline && pipeline.length > 0 ? (
                      pipeline.map((step) => (
                        <div
                          key={step.stage}
                          className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Zap size={16} className="text-brand-blue" />
                            <div>
                              <p className="text-sm font-medium text-text-primary">{step.stage}</p>
                              <p className="text-xs text-text-muted">
                                {step.jobs_pending} pending &middot; {step.avg_duration_secs.toFixed(1)}s avg
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {step.jobs_failed_24h > 0 && (
                              <span className="text-xs text-status-error font-mono">
                                {step.jobs_failed_24h} failed
                              </span>
                            )}
                            <StatusBadge status={step.status} pulse={step.status !== 'healthy'} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-muted text-center py-8">No pipeline data</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Cost Breakdown */}
              <Card title="Cost Breakdown" subtitle={`By service (${timeRange})`}>
                {costLoading && !costs ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                  </div>
                ) : costs && costs.length > 0 ? (
                  <BarChart
                    data={costs.map((c) => ({ service: c.service, cost: c.cost }))}
                    xField="service"
                    yField="cost"
                    height={240}
                    horizontal
                  />
                ) : (
                  <p className="text-text-muted text-center py-8">No cost data available</p>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
