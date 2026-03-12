'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, formatNumber, formatBytes } from '@/lib/utils';
import {
  Database,
  HardDrive,
  Box,
  CircleDot,
  CheckCircle,
  XCircle,
} from 'lucide-react';

/* ── Types ── */

interface ContainerAppInfo {
  name: string;
  location: string;
  provisioning_state: string;
  running_status: string | null;
  latest_revision: string;
}

interface PostgreSQLInfo {
  health: { healthy: boolean; message: string };
  connections: {
    total_connections: number;
    active: number;
    idle: number;
    idle_in_transaction: number;
  };
  tables: {
    table_name: string;
    total_size: string;
    size_bytes: number;
    row_estimate: number;
  }[];
}

interface Neo4jInfo {
  health: { healthy: boolean; message: string };
  stats: { node_count: number; edge_count: number };
  node_counts: { label: string; count: number }[];
  indexes: { name: string; type: string; labelsOrTypes: string[]; properties: string[]; state: string }[];
}

interface ServiceBusQueue {
  name: string;
  status: string;
  max_size_mb: number;
  requires_session: boolean;
}

interface ServiceBusMetric {
  name: string;
  active_message_count: number;
  dead_letter_message_count: number;
  scheduled_message_count: number;
  transfer_message_count: number;
  transfer_dead_letter_message_count: number;
  total_message_count: number;
  size_in_bytes: number;
}

interface ServiceBusInfo {
  queues: ServiceBusQueue[];
  metrics: ServiceBusMetric[];
}

interface StorageContainerInfo {
  name: string;
  last_modified: string | null;
}

interface StorageInfo {
  containers: StorageContainerInfo[];
  total_size: { total_bytes: number; blob_count: number };
}

/* ── Skeleton ── */

function InfraSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
    </div>
  );
}

/* ── Content ── */

function InfrastructureContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: containerApps, isLoading: caLoading, refresh } =
    useDebugger<ContainerAppInfo[]>('/debug/infra/container-apps');

  const { data: postgresql, isLoading: pgLoading } =
    useDebugger<PostgreSQLInfo>('/debug/infra/postgresql');

  const { data: neo4j, isLoading: neoLoading } =
    useDebugger<Neo4jInfo>('/debug/infra/neo4j');

  const { data: serviceBus, isLoading: sbLoading } =
    useDebugger<ServiceBusInfo>('/debug/infra/service-bus');

  const { data: storage, isLoading: stLoading } =
    useDebugger<StorageInfo>('/debug/infra/storage');

  const isLoading = caLoading && !containerApps;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const healthyApps = containerApps?.filter((a) => a.provisioning_state === 'Succeeded').length ?? 0;
  const totalApps = containerApps?.length ?? 0;
  const totalDLQ = serviceBus?.metrics?.reduce((sum, m) => sum + (m.dead_letter_message_count ?? 0), 0) ?? 0;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Infrastructure"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || caLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <InfraSkeleton />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="Container Apps"
                  value={`${healthyApps}/${totalApps}`}
                  format="raw"
                  icon={Box}
                  iconColor={healthyApps === totalApps ? 'text-status-success' : 'text-status-warning'}
                />
                <MetricCard
                  title="PostgreSQL"
                  value={postgresql?.health?.healthy ? 'Healthy' : postgresql?.health?.message ?? '—'}
                  format="raw"
                  icon={Database}
                  iconColor={postgresql?.health?.healthy ? 'text-status-success' : 'text-status-warning'}
                />
                <MetricCard
                  title="Neo4j"
                  value={neo4j?.health?.healthy ? 'Healthy' : neo4j?.health?.message ?? '—'}
                  format="raw"
                  icon={CircleDot}
                  iconColor={neo4j?.health?.healthy ? 'text-status-success' : 'text-status-warning'}
                />
                <MetricCard
                  title="Service Bus"
                  value={serviceBus?.queues ? `${serviceBus.queues.length} queues` : '—'}
                  format="raw"
                  icon={HardDrive}
                  iconColor={totalDLQ > 0 ? 'text-status-warning' : 'text-status-success'}
                  subtitle={totalDLQ > 0 ? `${totalDLQ} DLQ msgs` : 'Clean'}
                />
                <MetricCard
                  title="Storage"
                  value={storage?.total_size ? formatBytes(storage.total_size.total_bytes) : '—'}
                  format="raw"
                  icon={HardDrive}
                  iconColor="text-brand-blue"
                  subtitle={storage?.total_size ? `${storage.total_size.blob_count} blobs` : undefined}
                />
              </div>

              {/* Container Apps */}
              <Card title="Container Apps" subtitle={`${totalApps} apps deployed`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {containerApps && containerApps.length > 0 ? (
                    containerApps.map((app) => {
                      const isHealthy = app.provisioning_state === 'Succeeded';
                      return (
                        <div
                          key={app.name}
                          className={cn(
                            'flex items-center justify-between p-4 rounded-lg border',
                            isHealthy
                              ? 'bg-status-success/5 border-status-success/20'
                              : 'bg-status-error/5 border-status-error/20'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center',
                              isHealthy ? 'bg-status-success/20 text-status-success' : 'bg-status-error/20 text-status-error'
                            )}>
                              <Box size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text-primary">{app.name}</p>
                              <p className="text-xs text-text-muted font-mono">{app.latest_revision ?? '—'}</p>
                              <p className="text-xs text-text-muted">
                                {app.location ?? 'unknown'}
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            'flex items-center gap-1.5 text-xs font-medium',
                            isHealthy ? 'text-status-success' : 'text-status-error'
                          )}>
                            {isHealthy ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {app.running_status || app.provisioning_state}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-text-muted text-center py-8 col-span-2">No container apps data</p>
                  )}
                </div>
              </Card>

              {/* PostgreSQL + Neo4j */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PostgreSQL */}
                <Card title="PostgreSQL" subtitle={postgresql?.health?.healthy ? 'Connected' : postgresql?.health?.message}>
                  {postgresql ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Status</span>
                        <span className={cn(
                          'text-sm font-medium',
                          postgresql.health?.healthy ? 'text-status-success' : 'text-status-error'
                        )}>
                          {postgresql.health?.healthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Total Connections</span>
                        <span className="text-sm font-mono text-text-primary">
                          {postgresql.connections?.total_connections ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Active / Idle</span>
                        <span className="text-sm font-mono text-text-primary">
                          {postgresql.connections?.active ?? 0} / {postgresql.connections?.idle ?? 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Idle in Transaction</span>
                        <span className="text-sm font-mono text-text-primary">
                          {postgresql.connections?.idle_in_transaction ?? 0}
                        </span>
                      </div>
                      {postgresql.tables && postgresql.tables.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-text-muted font-medium">Top Tables</span>
                          {postgresql.tables.slice(0, 5).map((t) => (
                            <div key={t.table_name} className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg text-xs">
                              <span className="font-mono text-text-primary truncate mr-2">{t.table_name}</span>
                              <span className="text-text-secondary whitespace-nowrap">
                                {t.total_size} &middot; ~{formatNumber(t.row_estimate ?? 0)} rows
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No PostgreSQL data</p>
                  )}
                </Card>

                {/* Neo4j */}
                <Card title="Neo4j" subtitle={neo4j?.health?.healthy ? 'Connected' : neo4j?.health?.message}>
                  {neo4j ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Status</span>
                        <span className={cn(
                          'text-sm font-medium',
                          neo4j.health?.healthy ? 'text-status-success' : 'text-status-error'
                        )}>
                          {neo4j.health?.healthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Total Nodes</span>
                        <span className="text-sm font-mono text-text-primary">{formatNumber(neo4j.stats?.node_count ?? 0)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Total Edges</span>
                        <span className="text-sm font-mono text-text-primary">{formatNumber(neo4j.stats?.edge_count ?? 0)}</span>
                      </div>
                      {neo4j.node_counts && neo4j.node_counts.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-text-muted font-medium">Node Labels</span>
                          {neo4j.node_counts.slice(0, 6).map((nc) => (
                            <div key={nc.label} className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg text-xs">
                              <span className="font-mono text-text-primary">{nc.label}</span>
                              <span className="text-text-secondary">{formatNumber(nc.count ?? 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {neo4j.indexes && neo4j.indexes.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs text-text-muted font-medium">Indexes ({neo4j.indexes.length})</span>
                          {neo4j.indexes.slice(0, 4).map((idx) => (
                            <div key={idx.name} className="flex items-center justify-between p-2 bg-surface-tertiary rounded-lg text-xs">
                              <span className="font-mono text-text-primary truncate mr-2">{idx.name}</span>
                              <span className={cn(
                                'text-xs font-medium',
                                idx.state === 'ONLINE' ? 'text-status-success' : 'text-status-warning'
                              )}>{idx.state}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No Neo4j data</p>
                  )}
                </Card>
              </div>

              {/* Service Bus Queues */}
              <Card title="Service Bus Queues" subtitle={serviceBus?.queues ? `${serviceBus.queues.length} queues` : undefined}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Queue</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Active</th>
                        <th className="text-right py-2 px-3 text-text-muted font-medium">Dead Letter</th>
                        <th className="text-center py-2 px-3 text-text-muted font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceBus?.queues && serviceBus.queues.length > 0 ? (
                        serviceBus.queues.map((q) => {
                          const metric = serviceBus.metrics?.find((m) => m.name === q.name);
                          return (
                            <tr key={q.name} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                              <td className="py-2 px-3 font-medium text-text-primary">{q.name}</td>
                              <td className="py-2 px-3 text-right font-mono text-text-secondary">
                                {formatNumber(metric?.active_message_count ?? 0)}
                              </td>
                              <td className={cn(
                                'py-2 px-3 text-right font-mono',
                                (metric?.dead_letter_message_count ?? 0) > 0 ? 'text-status-error font-semibold' : 'text-text-secondary'
                              )}>
                                {formatNumber(metric?.dead_letter_message_count ?? 0)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <StatusBadge status={q.status === 'Active' ? 'healthy' : q.status} />
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-text-muted">
                            No queue data available
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

export default function InfrastructurePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <InfrastructureContent />
    </Suspense>
  );
}
