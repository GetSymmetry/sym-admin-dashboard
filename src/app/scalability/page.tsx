'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BarChart } from '@/components/charts/BarChart';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, formatBytes, formatNumber } from '@/lib/utils';
import {
  Gauge,
  Server,
  Database,
  AlertTriangle,
  HardDrive,
  Cpu,
  MemoryStick,
} from 'lucide-react';

/* ── Types ── */

interface ServiceResource {
  name: string;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  replica_count: number;
  max_replicas: number;
  requests_per_min: number;
}

interface QuotaInfo {
  resource: string;
  current: number;
  limit: number;
  unit: string;
  usage_percent: number;
}

interface Bottleneck {
  component: string;
  metric: string;
  current_value: number;
  threshold: number;
  severity: string;
  recommendation: string;
}

interface DatabasePerf {
  metric: string;
  value: number;
  unit: string;
  status: string;
  details: string;
}

/* ── Skeleton ── */

function ScalabilitySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
    </div>
  );
}

/* ── Content ── */

function ScalabilityContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: services, isLoading: svcLoading, refresh } =
    useDebugger<ServiceResource[]>('/debug/scale/services');

  const { data: quotas, isLoading: qLoading } =
    useDebugger<QuotaInfo[]>('/debug/scale/quotas');

  const { data: bottlenecks, isLoading: bLoading } =
    useDebugger<Bottleneck[]>('/debug/scale/bottlenecks');

  const { data: dbPerf, isLoading: dbLoading } =
    useDebugger<DatabasePerf[]>('/debug/scale/database');

  const isLoading = svcLoading && !services;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const criticalBottlenecks = bottlenecks?.filter((b) => b.severity === 'critical').length ?? 0;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Scalability"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || svcLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <ScalabilitySkeleton />
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Services"
                  value={services?.length ?? '—'}
                  icon={Server}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Quotas Near Limit"
                  value={quotas?.filter((q) => q.usage_percent > 80).length ?? 0}
                  icon={Gauge}
                  iconColor="text-status-warning"
                />
                <MetricCard
                  title="Bottlenecks"
                  value={bottlenecks?.length ?? 0}
                  icon={AlertTriangle}
                  iconColor={criticalBottlenecks > 0 ? 'text-status-error' : 'text-status-success'}
                  subtitle={criticalBottlenecks > 0 ? `${criticalBottlenecks} critical` : 'None critical'}
                />
                <MetricCard
                  title="DB Metrics"
                  value={dbPerf?.length ?? '—'}
                  icon={Database}
                  iconColor="text-brand-blue"
                />
              </div>

              {/* Service Resources */}
              <Card title="Service Resources" subtitle="CPU, memory, and replica utilization">
                <div className="space-y-3">
                  {services && services.length > 0 ? (
                    services.map((svc) => (
                      <div key={svc.name} className="p-4 bg-surface-tertiary rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Server size={16} className="text-brand-blue" />
                            <span className="text-sm font-medium text-text-primary">{svc.name}</span>
                          </div>
                          <span className="text-xs text-text-muted">
                            {svc.replica_count}/{svc.max_replicas} replicas &middot; {svc.requests_per_min} req/min
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {/* CPU bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-text-muted">CPU</span>
                              <span className="text-xs font-mono text-text-secondary">{svc.cpu_usage_percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-surface rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  svc.cpu_usage_percent > 80 ? 'bg-status-error' : svc.cpu_usage_percent > 60 ? 'bg-status-warning' : 'bg-status-success'
                                )}
                                style={{ width: `${Math.min(svc.cpu_usage_percent, 100)}%` }}
                              />
                            </div>
                          </div>
                          {/* Memory bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-text-muted">Memory</span>
                              <span className="text-xs font-mono text-text-secondary">{svc.memory_usage_percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-surface rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  svc.memory_usage_percent > 80 ? 'bg-status-error' : svc.memory_usage_percent > 60 ? 'bg-status-warning' : 'bg-status-success'
                                )}
                                style={{ width: `${Math.min(svc.memory_usage_percent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted text-center py-8">No service data</p>
                  )}
                </div>
              </Card>

              {/* Quotas + Bottlenecks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quotas */}
                <Card title="Resource Quotas" subtitle="Usage vs limits">
                  <div className="space-y-3">
                    {quotas && quotas.length > 0 ? (
                      quotas.map((q) => (
                        <div key={q.resource} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{q.resource}</p>
                            <p className="text-xs text-text-muted">
                              {formatNumber(q.current)} / {formatNumber(q.limit)} {q.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-surface rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  q.usage_percent > 90 ? 'bg-status-error' : q.usage_percent > 70 ? 'bg-status-warning' : 'bg-status-success'
                                )}
                                style={{ width: `${Math.min(q.usage_percent, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-text-secondary w-12 text-right">
                              {q.usage_percent.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-muted text-center py-8">No quota data</p>
                    )}
                  </div>
                </Card>

                {/* Bottlenecks */}
                <Card title="Bottlenecks" subtitle="Performance constraints">
                  <div className="space-y-3">
                    {bottlenecks && bottlenecks.length > 0 ? (
                      bottlenecks.map((b, i) => (
                        <div
                          key={i}
                          className={cn(
                            'p-3 rounded-lg border',
                            b.severity === 'critical'
                              ? 'bg-status-error/5 border-status-error/20'
                              : b.severity === 'warning'
                              ? 'bg-status-warning/5 border-status-warning/20'
                              : 'bg-surface-tertiary border-border-subtle'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-text-primary">{b.component}</span>
                            <StatusBadge status={b.severity} />
                          </div>
                          <p className="text-xs text-text-muted mb-1">
                            {b.metric}: {b.current_value} (threshold: {b.threshold})
                          </p>
                          <p className="text-xs text-text-secondary">{b.recommendation}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-status-success text-center py-8">No bottlenecks detected</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Database Performance */}
              <Card title="Database Performance" subtitle="PostgreSQL & Neo4j metrics">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Metric</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Value</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Unit</th>
                        <th className="text-center py-2 px-3 text-text-muted font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbPerf && dbPerf.length > 0 ? (
                        dbPerf.map((m, i) => (
                          <tr key={i} className="border-b border-border-subtle/50">
                            <td className="py-2 px-3 text-text-primary font-medium">{m.metric}</td>
                            <td className="py-2 px-3 text-right font-mono text-text-secondary">{m.value}</td>
                            <td className="py-2 px-3 text-text-muted">{m.unit}</td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge status={m.status} />
                            </td>
                            <td className="py-2 px-3 text-text-muted text-xs">{m.details}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-muted">
                            No database metrics available
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

export default function ScalabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <ScalabilityContent />
    </Suspense>
  );
}
