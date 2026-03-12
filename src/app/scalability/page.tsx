'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, formatBytes, formatNumber } from '@/lib/utils';
import {
  Gauge,
  Server,
  Database,
  AlertTriangle,
} from 'lucide-react';

/* ── Types (matching actual backend response shapes) ── */

interface ServiceResource {
  name: string;
  location: string;
  provisioning_state: string;
  running_status: string | null;
  latest_revision: string;
}

interface QuotaData {
  connections: {
    total_connections: number;
    active: number;
    idle: number;
    idle_in_transaction: number;
  };
  total_db_size_bytes: number;
  table_count: number;
}

interface BottleneckEntry {
  name: string;
  cloud_RoleName: string;
  p95_duration: number;
  p99_duration: number;
  count_: number;
}

interface TableSize {
  table_name: string;
  total_size: string;
  size_bytes: number;
  row_estimate: number;
}

interface DatabasePerfData {
  table_sizes: TableSize[];
  connections: {
    total_connections: number;
    active: number;
    idle: number;
    idle_in_transaction: number;
  };
  slow_queries: SlowQuery[];
}

interface SlowQuery {
  query: string;
  calls: number;
  mean_exec_time: number;
  total_exec_time: number;
  rows: number;
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
    useDebugger<QuotaData>('/debug/scale/quotas');

  const { data: bottlenecks, isLoading: bLoading } =
    useDebugger<BottleneckEntry[]>('/debug/scale/bottlenecks');

  const { data: dbPerf, isLoading: dbLoading } =
    useDebugger<DatabasePerfData>('/debug/scale/database');

  const isLoading = svcLoading && !services;
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
                  title="DB Connections"
                  value={quotas?.connections?.total_connections ?? '—'}
                  icon={Gauge}
                  iconColor="text-status-warning"
                />
                <MetricCard
                  title="Slow Endpoints"
                  value={bottlenecks?.length ?? 0}
                  icon={AlertTriangle}
                  iconColor={bottlenecks && bottlenecks.length > 0 ? 'text-status-error' : 'text-status-success'}
                  subtitle={bottlenecks && bottlenecks.length > 0 ? `${bottlenecks.length} above 1s p95` : 'None detected'}
                />
                <MetricCard
                  title="DB Size"
                  value={quotas?.total_db_size_bytes != null ? formatBytes(quotas.total_db_size_bytes) : '—'}
                  icon={Database}
                  iconColor="text-brand-blue"
                />
              </div>

              {/* Service Resources */}
              <Card title="Service Resources" subtitle="Container Apps provisioning status">
                <div className="space-y-3">
                  {services && services.length > 0 ? (
                    services.map((svc) => (
                      <div key={svc.name} className="p-4 bg-surface-tertiary rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server size={16} className="text-brand-blue" />
                            <span className="text-sm font-medium text-text-primary">{svc.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <StatusBadge status={svc.provisioning_state ?? 'unknown'} />
                            <span className="text-xs text-text-muted">
                              {svc.latest_revision ?? '—'}
                            </span>
                            {svc.location && (
                              <span className="text-xs text-text-muted">{svc.location}</span>
                            )}
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
                {/* Quotas (connection stats + DB summary) */}
                <Card title="Resource Quotas" subtitle="Database connections and storage">
                  <div className="space-y-3">
                    {quotas ? (
                      <>
                        {/* Connection breakdown */}
                        <div className="p-3 bg-surface-tertiary rounded-lg">
                          <p className="text-sm font-medium text-text-primary mb-2">Connections</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="text-xs text-text-muted">
                              Active: <span className="font-mono text-text-secondary">{quotas.connections?.active ?? 0}</span>
                            </div>
                            <div className="text-xs text-text-muted">
                              Idle: <span className="font-mono text-text-secondary">{quotas.connections?.idle ?? 0}</span>
                            </div>
                            <div className="text-xs text-text-muted">
                              Idle in Txn: <span className="font-mono text-text-secondary">{quotas.connections?.idle_in_transaction ?? 0}</span>
                            </div>
                            <div className="text-xs text-text-muted">
                              Total: <span className="font-mono text-text-secondary">{quotas.connections?.total_connections ?? 0}</span>
                            </div>
                          </div>
                        </div>
                        {/* DB size + table count */}
                        <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-text-primary">Database Size</p>
                            <p className="text-xs text-text-muted">
                              {quotas.total_db_size_bytes != null ? formatBytes(quotas.total_db_size_bytes) : '—'}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-text-secondary">
                            {quotas.table_count ?? 0} tables
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-text-muted text-center py-8">No quota data</p>
                    )}
                  </div>
                </Card>

                {/* Bottlenecks (slow endpoints from App Insights) */}
                <Card title="Bottlenecks" subtitle="Slow endpoints (p95 > 1s)">
                  <div className="space-y-3">
                    {bottlenecks && bottlenecks.length > 0 ? (
                      bottlenecks.map((b, i) => (
                        <div
                          key={i}
                          className={cn(
                            'p-3 rounded-lg border',
                            (b.p95_duration ?? 0) > 5000
                              ? 'bg-status-error/5 border-status-error/20'
                              : (b.p95_duration ?? 0) > 2000
                              ? 'bg-status-warning/5 border-status-warning/20'
                              : 'bg-surface-tertiary border-border-subtle'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-text-primary truncate max-w-[60%]">{b.name ?? '—'}</span>
                            <span className="text-xs text-text-muted">{b.cloud_RoleName ?? '—'}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-muted">
                            <span>P95: <span className="font-mono text-text-secondary">{b.p95_duration != null ? `${b.p95_duration.toFixed(0)}ms` : '—'}</span></span>
                            <span>P99: <span className="font-mono text-text-secondary">{b.p99_duration != null ? `${b.p99_duration.toFixed(0)}ms` : '—'}</span></span>
                            <span>Count: <span className="font-mono text-text-secondary">{b.count_ != null ? formatNumber(b.count_) : '—'}</span></span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-status-success text-center py-8">No bottlenecks detected</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Database Performance */}
              <Card title="Database Performance" subtitle="Table sizes, connections, and slow queries">
                {dbPerf ? (
                  <div className="space-y-6">
                    {/* Table Sizes */}
                    <div>
                      <h4 className="text-sm font-medium text-text-primary mb-2">Table Sizes</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border-subtle">
                              <th className="text-left py-2 px-3 text-text-muted font-medium">Table</th>
                              <th className="text-right py-2 px-3 text-text-muted font-medium">Size</th>
                              <th className="text-right py-2 px-3 text-text-muted font-medium">Rows (est.)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dbPerf.table_sizes && dbPerf.table_sizes.length > 0 ? (
                              dbPerf.table_sizes.map((t, i) => (
                                <tr key={i} className="border-b border-border-subtle/50">
                                  <td className="py-2 px-3 text-text-primary font-medium font-mono text-xs">{t.table_name ?? '—'}</td>
                                  <td className="py-2 px-3 text-right text-text-secondary">{t.total_size ?? '—'}</td>
                                  <td className="py-2 px-3 text-right font-mono text-text-muted">
                                    {t.row_estimate != null ? formatNumber(t.row_estimate) : '—'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-text-muted">No table data</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Connection Stats */}
                    <div>
                      <h4 className="text-sm font-medium text-text-primary mb-2">Connection Stats</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xs text-text-muted">Total</p>
                          <p className="text-lg font-mono text-text-primary">{dbPerf.connections?.total_connections ?? '—'}</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xs text-text-muted">Active</p>
                          <p className="text-lg font-mono text-status-success">{dbPerf.connections?.active ?? '—'}</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xs text-text-muted">Idle</p>
                          <p className="text-lg font-mono text-text-secondary">{dbPerf.connections?.idle ?? '—'}</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xs text-text-muted">Idle in Txn</p>
                          <p className="text-lg font-mono text-status-warning">{dbPerf.connections?.idle_in_transaction ?? '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Slow Queries */}
                    <div>
                      <h4 className="text-sm font-medium text-text-primary mb-2">Slow Queries</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border-subtle">
                              <th className="text-left py-2 px-3 text-text-muted font-medium">Query</th>
                              <th className="text-right py-2 px-3 text-text-muted font-medium">Calls</th>
                              <th className="text-right py-2 px-3 text-text-muted font-medium">Mean (ms)</th>
                              <th className="text-right py-2 px-3 text-text-muted font-medium">Total (ms)</th>
                              <th className="text-right py-2 px-3 text-text-muted font-medium">Rows</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dbPerf.slow_queries && dbPerf.slow_queries.length > 0 ? (
                              dbPerf.slow_queries.map((q, i) => (
                                <tr key={i} className="border-b border-border-subtle/50">
                                  <td className="py-2 px-3 text-text-primary font-mono text-xs max-w-md truncate">{q.query ?? '—'}</td>
                                  <td className="py-2 px-3 text-right font-mono text-text-secondary">
                                    {q.calls != null ? formatNumber(q.calls) : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-text-secondary">
                                    {q.mean_exec_time != null ? q.mean_exec_time.toFixed(1) : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-text-secondary">
                                    {q.total_exec_time != null ? q.total_exec_time.toFixed(0) : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-text-muted">
                                    {q.rows != null ? formatNumber(q.rows) : '—'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-4 text-center text-text-muted">
                                  No slow queries (or pg_stat_statements not enabled)
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-muted text-center py-8">No database metrics available</p>
                )}
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
