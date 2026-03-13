'use client';

import { useState, useMemo, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Gauge } from '@/components/ui/Gauge';
import { cn, timeAgo, displayValue } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import {
  Database,
  HardDrive,
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  Table,
  Search,
  Lock,
  TrendingUp,
  Server,
  Users,
  MessageSquare,
  Briefcase,
  FileText,
} from 'lucide-react';

/* ── Types for debugger response ── */

interface DatabaseCounts {
  users: number;
  organizations: number;
  workspaces: number;
  knowledge_sections: number;
  conversations: number;
  total_jobs: number;
}

interface DatabaseActivity {
  new_users: number;
  new_jobs: number;
  new_conversations: number;
  new_knowledge_sections: number;
}

interface DatabaseJobs {
  by_status: Record<string, number>;
  total: number;
  details: unknown[];
}

interface DatabaseHealth {
  healthy: boolean;
  version: string;
  db_size: string;
  db_size_bytes: number;
  total_connections: number;
  active_connections: number;
  active_queries?: number;
  waiting_queries?: number;
  uptime_hours?: number;
  score?: number;
  status?: string;
}

interface DatabaseCache {
  hit_ratio: number;
  hits: number;
  disk_reads: number;
}

interface DatabaseUsers {
  total_users: number;
  whitelisted_users: number;
}

interface DatabaseTable {
  table_name: string;
  total_size: string;
  row_estimate: number;
  size_bytes?: number;
  dead_tuple_ratio?: number;
}

interface DatabaseSlowQuery {
  table_name: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  idx_tup_fetch: number;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
}

interface DatabaseIndex {
  table: string;
  index: string;
  scans: number;
  tuples_read: number;
  tuples_fetched: number;
  size: string;
}

interface DatabaseLock {
  mode: string;
  count: number;
}

interface DatabaseConnections {
  total_connections: number;
  active: number;
  idle: number;
  by_state?: Array<{ state: string; count: number; max_duration_sec?: number }>;
}

interface DatabaseMetrics {
  counts: DatabaseCounts;
  activity: DatabaseActivity;
  jobs: DatabaseJobs;
  health: DatabaseHealth;
  cache: DatabaseCache;
  users: DatabaseUsers;
  tables: DatabaseTable[];
  slow_queries: DatabaseSlowQuery[];
  indexes: DatabaseIndex[];
  locks: DatabaseLock[];
  connections: DatabaseConnections;
}

/* ── Helpers ── */

/** Convert time range key (e.g. '24h', '7d') to hours string */
function timeRangeToHours(range: string): string {
  const match = range.match(/(\d+)([hdm])/);
  if (!match) return '24';
  const [, num, unit] = match;
  switch (unit) {
    case 'd': return String(Number(num) * 24);
    case 'h': return num;
    case 'm': return String(Number(num) / 60);
    default: return '24';
  }
}

function DatabaseContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const hours = useMemo(() => timeRangeToHours(timeRange), [timeRange]);

  const { data, isLoading, refresh, metadata } = useDebugger<DatabaseMetrics>(
    '/debug/infra/database/metrics',
    { hours },
    { refreshInterval: 60000 }
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Format time range for display
  const formatTimeRange = (range: string) => {
    const match = range.match(/(\d+)([hdm])/);
    if (!match) return range;
    const [, num, unit] = match;
    return `${num}${unit === 'h' ? 'h' : unit === 'd' ? 'd' : 'm'}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'excellent':
      case 'good':
        return 'text-success';
      case 'warning':
      case 'fair':
        return 'text-warning';
      case 'critical':
      case 'poor':
        return 'text-error';
      default:
        return 'text-text-muted';
    }
  };

  const getGaugeColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'rgb(34 197 94)'; // success
    if (value >= thresholds.warning) return 'rgb(245 158 11)'; // warning
    return 'rgb(239 68 68)'; // error
  };

  // Compute locks total from the locks array
  const locksTotal = data?.locks?.reduce((sum, l) => sum + l.count, 0) ?? 0;

  // Compute cache status from hit ratio
  const cacheStatus = data?.cache
    ? data.cache.hit_ratio >= 95 ? 'excellent'
      : data.cache.hit_ratio >= 90 ? 'good'
      : data.cache.hit_ratio >= 80 ? 'fair'
      : 'poor'
    : '';

  // Compute db size in MB from bytes
  const dbSizeMb = data?.health?.db_size_bytes != null
    ? (data.health.db_size_bytes / (1024 * 1024)).toFixed(1)
    : null;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Database Health"
          environment="prod"
          lastUpdated={metadata?.timestamp ? timeAgo(metadata.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showTimeRange={true}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading && !data ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading database metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Health Overview (Current State) */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="Health Score"
                  value={displayValue(data?.health?.score)}
                  icon={Activity}
                  iconColor={getStatusColor(data?.health?.status || '')}
                  subtitle={data?.health?.status?.toUpperCase() || '—'}
                />
                <MetricCard
                  title="Database Size"
                  value={dbSizeMb != null ? `${dbSizeMb} MB` : (data?.health?.db_size || '—')}
                  icon={HardDrive}
                  iconColor="text-brand-blue"
                  subtitle="Total storage"
                />
                <MetricCard
                  title="Cache Hit Ratio"
                  value={data?.cache?.hit_ratio != null ? `${data.cache.hit_ratio}%` : '—'}
                  icon={Zap}
                  iconColor={getStatusColor(cacheStatus)}
                  subtitle={cacheStatus || '—'}
                />
                <MetricCard
                  title="Active Queries"
                  value={displayValue(data?.health?.active_queries ?? data?.connections?.active)}
                  icon={Search}
                  iconColor="text-brand-blue"
                  subtitle={data?.health?.waiting_queries != null ? `${data.health.waiting_queries} waiting` : '—'}
                />
                <MetricCard
                  title="Uptime"
                  value={data?.health?.uptime_hours != null
                    ? `${Math.floor(data.health.uptime_hours / 24)}d ${data.health.uptime_hours % 24}h`
                    : '—'}
                  icon={Clock}
                  iconColor="text-info"
                  subtitle="Since restart"
                />
              </div>

              {/* Activity in Time Range */}
              <Card title={`Activity (${formatTimeRange(timeRange)})`}>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="w-5 h-5 text-brand-blue" />
                    </div>
                    <p className="text-2xl font-mono text-brand-blue">
                      {displayValue(data?.activity?.new_users)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">New Users</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <MessageSquare className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-2xl font-mono text-success">
                      {displayValue(data?.activity?.new_conversations)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Conversations</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-2xl font-mono text-info">
                      {displayValue(data?.activity?.new_knowledge_sections)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Knowledge Sections</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Database className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-2xl font-mono text-info">
                      {displayValue(data?.counts?.knowledge_sections)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Total Sections</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Briefcase className="w-5 h-5 text-warning" />
                    </div>
                    <p className="text-2xl font-mono text-warning">
                      {displayValue(data?.activity?.new_jobs)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Jobs Created</p>
                  </div>
                </div>
              </Card>

              {/* Connections & Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Connection Pool */}
                <Card title="Connection Pool">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Gauge
                          value={data?.connections?.total_connections != null ? data.connections.total_connections / 100 : 0}
                          size={60}
                          color={getGaugeColor(100 - (data?.connections?.total_connections ?? 0), { good: 50, warning: 20 })}
                        />
                        <div>
                          <p className="text-2xl font-bold text-text-primary">{displayValue(data?.connections?.total_connections)}</p>
                          <p className="text-xs text-text-muted">Total Connections</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {data?.connections?.by_state?.length ? (
                        data.connections.by_state.map((conn, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-text-muted capitalize">{conn.state || 'unknown'}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-text-primary font-mono">{conn.count}</span>
                              {(conn.max_duration_sec ?? 0) > 60 && (
                                <span className="text-xs text-warning">
                                  max {Math.round((conn.max_duration_sec ?? 0) / 60)}m
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
                          {data?.connections ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">Active</span>
                                <span className="text-text-primary font-mono">{data.connections.active}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">Idle</span>
                                <span className="text-text-primary font-mono">{data.connections.idle}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-text-muted text-sm text-center py-2">No connection data</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Cache Performance */}
                <Card title="Cache Performance">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <Gauge
                        value={data?.cache?.hit_ratio ?? 0}
                        max={100}
                        size={120}
                        label="Hit Ratio"
                        color={getGaugeColor(data?.cache?.hit_ratio ?? 0, { good: 95, warning: 90 })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-surface-tertiary rounded-lg">
                        <p className="text-lg font-mono text-success">
                          {data?.cache?.hits != null ? `${(data.cache.hits / 1000000).toFixed(1)}M` : '—'}
                        </p>
                        <p className="text-xs text-text-muted">Cache Hits</p>
                      </div>
                      <div className="p-3 bg-surface-tertiary rounded-lg">
                        <p className="text-lg font-mono text-warning">
                          {data?.cache?.disk_reads != null ? `${(data.cache.disk_reads / 1000).toFixed(1)}K` : '—'}
                        </p>
                        <p className="text-xs text-text-muted">Disk Reads</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Table Activity Stats */}
                <Card title="Table Activity">
                  {data?.slow_queries?.length ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-brand-blue">
                            {displayValue(data.slow_queries.length)}
                          </p>
                          <p className="text-xs text-text-muted">Active Tables</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-info">
                            {(() => {
                              const total = data.slow_queries.reduce((s, q) => s + (q.seq_scan ?? 0), 0);
                              return total > 1000 ? `${(total / 1000).toFixed(1)}K` : String(total);
                            })()}
                          </p>
                          <p className="text-xs text-text-muted">Seq Scans</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-success">
                            {(() => {
                              const total = data.slow_queries.reduce((s, q) => s + (q.idx_scan ?? 0), 0);
                              return total > 1000 ? `${(total / 1000).toFixed(1)}K` : String(total);
                            })()}
                          </p>
                          <p className="text-xs text-text-muted">Index Scans</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-warning">
                            {(() => {
                              const total = data.slow_queries.reduce((s, q) => s + (q.n_tup_ins ?? 0) + (q.n_tup_upd ?? 0) + (q.n_tup_del ?? 0), 0);
                              return total > 1000 ? `${(total / 1000).toFixed(1)}K` : String(total);
                            })()}
                          </p>
                          <p className="text-xs text-text-muted">DML Ops</p>
                        </div>
                      </div>

                      {/* Locks */}
                      <div className="pt-2 border-t border-border-subtle">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-muted flex items-center gap-2">
                            <Lock size={14} />
                            Active Locks
                          </span>
                          <span className="text-text-primary font-mono">{displayValue(locksTotal)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-muted">
                      <p>No table activity data available</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Table Stats & Slow Queries */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table Sizes */}
                <Card title="Table Statistics">
                  {data?.tables?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-text-muted text-left">
                            <th className="pb-3 font-medium">Table</th>
                            <th className="pb-3 font-medium text-right">Rows</th>
                            <th className="pb-3 font-medium text-right">Size</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {data.tables.slice(0, 10).map((table, i: number) => (
                            <tr key={i} className="text-text-secondary">
                              <td className="py-2 font-mono text-xs">{table.table_name}</td>
                              <td className="py-2 text-right font-mono">
                                {table.row_estimate?.toLocaleString() ?? '—'}
                              </td>
                              <td className="py-2 text-right text-text-muted">{table.total_size ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No table data available</p>
                  )}
                </Card>

                {/* Hot Tables (high seq scan) */}
                <Card title="Busiest Tables">
                  <div className="space-y-3">
                    {data?.slow_queries?.length ? (
                      data.slow_queries.slice(0, 8).map((tbl, i: number) => {
                        const seqRatio = (tbl.seq_scan ?? 0) + (tbl.idx_scan ?? 0) > 0
                          ? ((tbl.seq_scan ?? 0) / ((tbl.seq_scan ?? 0) + (tbl.idx_scan ?? 0))) * 100
                          : 0;
                        return (
                          <div
                            key={i}
                            className="p-3 bg-surface-tertiary rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-mono text-text-primary">{tbl.table_name}</span>
                              <span className={cn(
                                "text-xs font-mono",
                                seqRatio > 50 ? 'text-warning' : 'text-success'
                              )}>
                                {seqRatio.toFixed(0)}% seq
                              </span>
                            </div>
                            <div className="flex gap-3 text-xs text-text-muted">
                              <span>seq: {(tbl.seq_scan ?? 0).toLocaleString()}</span>
                              <span>idx: {(tbl.idx_scan ?? 0).toLocaleString()}</span>
                              <span>ins: {(tbl.n_tup_ins ?? 0).toLocaleString()}</span>
                              <span>upd: {(tbl.n_tup_upd ?? 0).toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-text-muted text-center py-8">No table activity data</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Index Usage */}
              <Card title="Index Usage">
                {data?.indexes?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-muted text-left">
                          <th className="pb-3 font-medium">Index</th>
                          <th className="pb-3 font-medium">Table</th>
                          <th className="pb-3 font-medium text-right">Scans</th>
                          <th className="pb-3 font-medium text-right">Tuples Read</th>
                          <th className="pb-3 font-medium text-right">Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {data.indexes.map((idx, i: number) => (
                          <tr key={i} className="text-text-secondary">
                            <td className="py-2 font-mono text-xs text-brand-blue">{idx.index}</td>
                            <td className="py-2 font-mono text-xs text-text-muted">{idx.table}</td>
                            <td className="py-2 text-right font-mono">
                              {idx.scans?.toLocaleString() ?? '—'}
                            </td>
                            <td className="py-2 text-right font-mono text-text-muted">
                              {idx.tuples_read?.toLocaleString() ?? '—'}
                            </td>
                            <td className="py-2 text-right text-text-muted">{idx.size ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-text-muted text-center py-8">No index data available</p>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DatabasePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <DatabaseContent />
    </Suspense>
  );
}
