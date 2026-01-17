'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Gauge } from '@/components/ui/Gauge';
import { cn, timeAgo, displayValue } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
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

const fetcher = (url: string) => fetch(url).then(res => res.json());

function DatabaseContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR(
    `/api/database?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
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
          title="Database Health"
          environment={environment}
          lastUpdated={data?.timestamp ? timeAgo(data.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showTimeRange={true}
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
                  value={data?.health?.dbSizeMb != null ? `${data.health.dbSizeMb} MB` : '—'}
                  icon={HardDrive}
                  iconColor="text-brand-blue"
                  subtitle="Total storage"
                />
                <MetricCard
                  title="Cache Hit Ratio"
                  value={data?.cache?.hitRatio != null ? `${data.cache.hitRatio}%` : '—'}
                  icon={Zap}
                  iconColor={getStatusColor(data?.cache?.status || '')}
                  subtitle={data?.cache?.status || '—'}
                />
                <MetricCard
                  title="Active Queries"
                  value={displayValue(data?.health?.activeQueries)}
                  icon={Search}
                  iconColor="text-brand-blue"
                  subtitle={data?.health?.waitingQueries != null ? `${data.health.waitingQueries} waiting` : '—'}
                />
                <MetricCard
                  title="Uptime"
                  value={data?.health?.uptimeHours != null 
                    ? `${Math.floor(data.health.uptimeHours / 24)}d ${data.health.uptimeHours % 24}h` 
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
                      {displayValue(data?.activity?.newUsers)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">New Users</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <MessageSquare className="w-5 h-5 text-success" />
                    </div>
                    <p className="text-2xl font-mono text-success">
                      {displayValue(data?.activity?.newConversations)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Conversations</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-2xl font-mono text-info">
                      {displayValue(data?.activity?.newMessages)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Messages</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Database className="w-5 h-5 text-info" />
                    </div>
                    <p className="text-2xl font-mono text-info">
                      {displayValue(data?.activity?.newKUs)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Knowledge Units</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Briefcase className="w-5 h-5 text-warning" />
                    </div>
                    <p className="text-2xl font-mono text-warning">
                      {displayValue(data?.activity?.newJobs)}
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
                          value={data?.health?.totalConnections != null ? data.health.totalConnections / 100 : 0}
                          size={60}
                          color={getGaugeColor(100 - (data?.health?.totalConnections ?? 0), { good: 50, warning: 20 })}
                        />
                        <div>
                          <p className="text-2xl font-bold text-text-primary">{displayValue(data?.health?.totalConnections)}</p>
                          <p className="text-xs text-text-muted">Total Connections</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {data?.connections?.byState?.length ? (
                        data.connections.byState.map((conn: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-text-muted capitalize">{conn.state || 'unknown'}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-text-primary font-mono">{conn.count}</span>
                              {conn.maxDurationSec > 60 && (
                                <span className="text-xs text-warning">
                                  max {Math.round(conn.maxDurationSec / 60)}m
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-text-muted text-sm text-center py-2">No connection data</p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Cache Performance */}
                <Card title="Cache Performance">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center">
                      <Gauge
                        value={data?.cache?.hitRatio ?? 0}
                        max={100}
                        size={120}
                        label="Hit Ratio"
                        color={getGaugeColor(data?.cache?.hitRatio ?? 0, { good: 95, warning: 90 })}
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
                          {data?.cache?.diskReads != null ? `${(data.cache.diskReads / 1000).toFixed(1)}K` : '—'}
                        </p>
                        <p className="text-xs text-text-muted">Disk Reads</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Query Stats */}
                <Card title="Query Statistics">
                  {data?.queryStats?.totalQueryTypes != null ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-brand-blue">
                            {displayValue(data?.queryStats?.totalQueryTypes)}
                          </p>
                          <p className="text-xs text-text-muted">Query Types</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-info">
                            {data?.queryStats?.totalCalls != null ? `${(data.queryStats.totalCalls / 1000).toFixed(1)}K` : '—'}
                          </p>
                          <p className="text-xs text-text-muted">Total Calls</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-info">
                            {data?.queryStats?.avgQueryTimeMs != null ? `${data.queryStats.avgQueryTimeMs.toFixed(1)}ms` : '—'}
                          </p>
                          <p className="text-xs text-text-muted">Avg Time</p>
                        </div>
                        <div className="p-3 bg-surface-tertiary rounded-lg text-center">
                          <p className="text-xl font-mono text-warning">
                            {data?.queryStats?.totalExecMinutes != null ? `${data.queryStats.totalExecMinutes.toFixed(0)}m` : '—'}
                          </p>
                          <p className="text-xs text-text-muted">Total Exec</p>
                        </div>
                      </div>
                      
                      {/* Locks */}
                      <div className="pt-2 border-t border-border-subtle">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-muted flex items-center gap-2">
                            <Lock size={14} />
                            Active Locks
                          </span>
                          <span className="text-text-primary font-mono">{displayValue(data?.locks?.total)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-muted">
                      <p>No query statistics available</p>
                      <p className="text-xs mt-1">(pg_stat_statements may not be enabled)</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Row Operations */}
              <Card title="Row Operations (Since DB Start)">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <p className="text-2xl font-mono text-brand-blue">
                      {data?.operations?.returned != null ? `${(data.operations.returned / 1000000).toFixed(1)}M` : '—'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Rows Returned</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <p className="text-2xl font-mono text-info">
                      {data?.operations?.fetched != null ? `${(data.operations.fetched / 1000000).toFixed(1)}M` : '—'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Rows Fetched</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <p className="text-2xl font-mono text-success">
                      {data?.operations?.inserted != null ? `${(data.operations.inserted / 1000).toFixed(1)}K` : '—'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Rows Inserted</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <p className="text-2xl font-mono text-warning">
                      {data?.operations?.updated != null ? `${(data.operations.updated / 1000).toFixed(1)}K` : '—'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Rows Updated</p>
                  </div>
                  <div className="p-4 bg-surface-tertiary rounded-xl text-center">
                    <p className="text-2xl font-mono text-error">
                      {data?.operations?.deleted != null ? `${(data.operations.deleted / 1000).toFixed(1)}K` : '—'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Rows Deleted</p>
                  </div>
                </div>
              </Card>

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
                            <th className="pb-3 font-medium text-right">Dead %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {data.tables.slice(0, 10).map((table: any, i: number) => (
                            <tr key={i} className="text-text-secondary">
                              <td className="py-2 font-mono text-xs">{table.name}</td>
                              <td className="py-2 text-right font-mono">
                                {table.rowCount?.toLocaleString() ?? '—'}
                              </td>
                              <td className="py-2 text-right text-text-muted">{table.size ?? '—'}</td>
                              <td className={cn(
                                "py-2 text-right font-mono",
                                table.deadTupleRatio > 10 ? 'text-error' : 
                                table.deadTupleRatio > 5 ? 'text-warning' : 'text-text-muted'
                              )}>
                                {table.deadTupleRatio?.toFixed(1) ?? '—'}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No table data available</p>
                  )}
                </Card>

                {/* Slow Queries */}
                <Card title="Slowest Queries">
                  <div className="space-y-3">
                    {data?.slowQueries?.length ? (
                      data.slowQueries.slice(0, 5).map((query: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 bg-surface-tertiary rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "text-xs font-mono",
                              query.avgTimeMs > 1000 ? 'text-error' :
                              query.avgTimeMs > 100 ? 'text-warning' : 'text-text-muted'
                            )}>
                              avg {query.avgTimeMs?.toFixed(0)}ms
                            </span>
                            <span className="text-xs text-text-muted">
                              {query.calls?.toLocaleString()} calls
                            </span>
                          </div>
                          <p className="text-xs text-text-muted font-mono truncate">
                            {query.query}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-muted text-center py-8">
                        No slow query data available
                        <br />
                        <span className="text-xs">(pg_stat_statements may not be enabled)</span>
                      </p>
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
                        {data.indexes.map((idx: any, i: number) => (
                          <tr key={i} className="text-text-secondary">
                            <td className="py-2 font-mono text-xs text-brand-blue">{idx.index}</td>
                            <td className="py-2 font-mono text-xs text-text-muted">{idx.table}</td>
                            <td className="py-2 text-right font-mono">
                              {idx.scans?.toLocaleString() ?? '—'}
                            </td>
                            <td className="py-2 text-right font-mono text-text-muted">
                              {idx.tuplesRead?.toLocaleString() ?? '—'}
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
