'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  TrendingUp,
  Users,
} from 'lucide-react';

/* ── Types ── */

interface GrowthPoint {
  date: string;
  new_users: number;
}

interface EngagementMetrics {
  dau: number;
  wau: number;
  mau: number;
  total: number;
}

interface FeatureAdoption {
  total_workspaces: number;
  auto_connect_enabled: number;
  knowledge_active_30d: number;
  conversation_active_30d: number;
}

interface RetentionCohort {
  cohort_week: string;
  cohort_size: number;
  retained: number;
}

interface UnitEconomics {
  total_cost_30d: number;
  cost_per_user: number;
  cost_per_workspace: number;
  total_users: number;
  total_workspaces: number;
}

/* ── Skeleton ── */

function InsightsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-surface rounded-card border border-border-subtle" />
        <div className="h-64 bg-surface rounded-card border border-border-subtle" />
      </div>
    </div>
  );
}

/* ── Content ── */

function InsightsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: growth, isLoading: growthLoading, refresh } =
    useDebugger<GrowthPoint[]>('/debug/insights/growth', { timeRange });

  const { data: engagement, isLoading: engLoading } =
    useDebugger<EngagementMetrics>('/debug/insights/engagement', { timeRange });

  const { data: features, isLoading: featLoading } =
    useDebugger<FeatureAdoption>('/debug/insights/feature-adoption', { timeRange });

  const { data: retention, isLoading: retLoading } =
    useDebugger<RetentionCohort[]>('/debug/insights/retention');

  const { data: economics, isLoading: econLoading } =
    useDebugger<UnitEconomics>('/debug/insights/unit-economics', { timeRange });

  const isLoading = growthLoading && !growth;
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
          title="Insights"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || growthLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <InsightsSkeleton />
          ) : (
            <>
              {/* Growth Chart */}
              <Card title="User Growth" subtitle={`New user registrations (${timeRange})`}>
                {growth && growth.length > 0 ? (
                  <AreaChart
                    data={growth}
                    xField="date"
                    yFields={[
                      { key: 'new_users', color: '#4077ed', name: 'New Users' },
                    ]}
                    height={260}
                  />
                ) : (
                  <p className="text-text-muted text-center py-12">No growth data available</p>
                )}
              </Card>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="DAU"
                  value={engagement?.dau ?? '—'}
                  icon={Users}
                  subtitle="Daily active users"
                />
                <MetricCard
                  title="WAU"
                  value={engagement?.wau ?? '—'}
                  icon={Users}
                  subtitle="Weekly active users"
                />
                <MetricCard
                  title="MAU"
                  value={engagement?.mau ?? '—'}
                  icon={Users}
                  subtitle="Monthly active users"
                />
                <MetricCard
                  title="DAU/WAU"
                  value={engagement?.dau != null && engagement?.wau ? `${((engagement.dau / engagement.wau) * 100).toFixed(1)}%` : '—'}
                  format="raw"
                  icon={TrendingUp}
                  subtitle="Stickiness ratio"
                />
              </div>

              {/* Feature Adoption + Retention */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Feature Adoption" subtitle="Active workspaces by feature (30d)">
                  {features ? (
                    <BarChart
                      data={[
                        { feature: 'Auto-Connect', count: features.auto_connect_enabled ?? 0 },
                        { feature: 'Knowledge', count: features.knowledge_active_30d ?? 0 },
                        { feature: 'Conversation', count: features.conversation_active_30d ?? 0 },
                      ]}
                      xField="feature"
                      yField="count"
                      height={240}
                      horizontal
                    />
                  ) : (
                    <p className="text-text-muted text-center py-8">No feature data</p>
                  )}
                </Card>

                <Card title="Retention Cohorts" subtitle="Weekly cohort retention">
                  {retention && retention.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-subtle">
                            <th className="text-left py-2 px-3 text-text-muted font-medium">Cohort Week</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Size</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Retained</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {retention.map((row) => {
                            const rate = row.cohort_size > 0 ? (row.retained / row.cohort_size * 100) : 0;
                            return (
                              <tr key={row.cohort_week} className="border-b border-border-subtle/50">
                                <td className="py-2 px-3 text-text-primary font-mono">{row.cohort_week}</td>
                                <td className="py-2 px-3 text-right text-text-secondary">{row.cohort_size}</td>
                                <td className="py-2 px-3 text-right text-text-secondary">{row.retained}</td>
                                <td className="py-2 px-3 text-right text-text-secondary font-semibold">{rate.toFixed(0)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No retention data</p>
                  )}
                </Card>
              </div>

              {/* Unit Economics */}
              <Card title="Unit Economics" subtitle="30-day cost efficiency">
                {economics ? (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Total (30d)</p>
                      <p className="text-lg font-mono font-semibold text-status-warning">
                        {formatCurrency(economics.total_cost_30d)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Cost/User</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatCurrency(economics.cost_per_user)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Cost/Workspace</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatCurrency(economics.cost_per_workspace)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Total Users</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatNumber(economics.total_users)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Total Workspaces</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatNumber(economics.total_workspaces)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-muted text-center py-8">No economics data</p>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <InsightsContent />
    </Suspense>
  );
}
