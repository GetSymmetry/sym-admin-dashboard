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
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  Users,
  MousePointerClick,
  Layers,
  Repeat,
  DollarSign,
} from 'lucide-react';

/* ── Types ── */

interface GrowthPoint {
  date: string;
  users: number;
  workspaces: number;
  conversations: number;
}

interface EngagementMetrics {
  dau: number;
  wau: number;
  mau: number;
  dau_wau_ratio: number;
  avg_session_duration_secs: number;
  avg_conversations_per_user: number;
}

interface FeatureAdoption {
  feature: string;
  adoption_percent: number;
  total_uses: number;
}

interface RetentionMetrics {
  cohort: string;
  week_1: number;
  week_2: number;
  week_4: number;
  week_8: number;
}

interface UnitEconomics {
  cost_per_user: number;
  cost_per_conversation: number;
  llm_cost_per_query: number;
  infra_cost_per_user: number;
  total_monthly_cost: number;
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
    useDebugger<FeatureAdoption[]>('/debug/insights/feature-adoption', { timeRange });

  const { data: retention, isLoading: retLoading } =
    useDebugger<RetentionMetrics[]>('/debug/insights/retention');

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
              <Card title="Growth" subtitle={`Users, workspaces & conversations (${timeRange})`}>
                {growth && growth.length > 0 ? (
                  <AreaChart
                    data={growth}
                    xField="date"
                    yFields={[
                      { key: 'users', color: '#4077ed', name: 'Users' },
                      { key: 'workspaces', color: '#22c55e', name: 'Workspaces' },
                      { key: 'conversations', color: '#f59e0b', name: 'Conversations' },
                    ]}
                    height={260}
                  />
                ) : (
                  <p className="text-text-muted text-center py-12">No growth data available</p>
                )}
              </Card>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                  title="DAU/WAU Ratio"
                  value={engagement?.dau_wau_ratio != null ? `${(engagement.dau_wau_ratio * 100).toFixed(1)}%` : '—'}
                  format="raw"
                  icon={TrendingUp}
                  subtitle="Stickiness"
                />
                <MetricCard
                  title="Avg Session"
                  value={engagement?.avg_session_duration_secs != null ? `${(engagement.avg_session_duration_secs / 60).toFixed(1)}m` : '—'}
                  format="raw"
                  icon={MousePointerClick}
                  subtitle="Average duration"
                />
                <MetricCard
                  title="Convos/User"
                  value={engagement?.avg_conversations_per_user != null ? engagement.avg_conversations_per_user.toFixed(1) : '—'}
                  format="raw"
                  icon={Layers}
                  subtitle="Per active user"
                />
              </div>

              {/* Feature Adoption + Retention */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Feature Adoption" subtitle="Usage across features">
                  {features && features.length > 0 ? (
                    <BarChart
                      data={features.map((f) => ({ feature: f.feature, adoption: f.adoption_percent }))}
                      xField="feature"
                      yField="adoption"
                      height={240}
                      horizontal
                    />
                  ) : (
                    <p className="text-text-muted text-center py-8">No feature data</p>
                  )}
                </Card>

                <Card title="Retention Cohorts" subtitle="Weekly retention %">
                  {retention && retention.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-subtle">
                            <th className="text-left py-2 px-3 text-text-muted font-medium">Cohort</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Wk 1</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Wk 2</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Wk 4</th>
                            <th className="text-right py-2 px-3 text-text-muted font-medium">Wk 8</th>
                          </tr>
                        </thead>
                        <tbody>
                          {retention.map((row) => (
                            <tr key={row.cohort} className="border-b border-border-subtle/50">
                              <td className="py-2 px-3 text-text-primary font-mono">{row.cohort}</td>
                              <td className="py-2 px-3 text-right text-text-secondary">{row.week_1.toFixed(0)}%</td>
                              <td className="py-2 px-3 text-right text-text-secondary">{row.week_2.toFixed(0)}%</td>
                              <td className="py-2 px-3 text-right text-text-secondary">{row.week_4.toFixed(0)}%</td>
                              <td className="py-2 px-3 text-right text-text-secondary">{row.week_8.toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No retention data</p>
                  )}
                </Card>
              </div>

              {/* Unit Economics */}
              <Card title="Unit Economics" subtitle="Cost efficiency metrics">
                {economics ? (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Cost/User</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatCurrency(economics.cost_per_user)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Cost/Conversation</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatCurrency(economics.cost_per_conversation)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">LLM Cost/Query</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatCurrency(economics.llm_cost_per_query)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Infra/User</p>
                      <p className="text-lg font-mono font-semibold text-text-primary">
                        {formatCurrency(economics.infra_cost_per_user)}
                      </p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">Monthly Total</p>
                      <p className="text-lg font-mono font-semibold text-status-warning">
                        {formatCurrency(economics.total_monthly_cost)}
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
