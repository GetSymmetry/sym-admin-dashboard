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
  Server,
  Database,
  HardDrive,
  Cpu,
  Activity,
  Box,
  CircleDot,
  CheckCircle,
  XCircle,
} from 'lucide-react';

/* ── Types ── */

interface ContainerAppInfo {
  name: string;
  display_name: string;
  provisioning_state: string;
  running_status: string;
  replica_count: number;
  cpu: string;
  memory: string;
  latest_revision: string;
}

interface PostgreSQLInfo {
  server_name: string;
  status: string;
  version: string;
  sku: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  connections_active: number;
  connections_max: number;
  cpu_percent: number;
  memory_percent: number;
}

interface Neo4jInfo {
  status: string;
  version: string;
  vm_name: string;
  node_count: number;
  relationship_count: number;
  store_size_bytes: number;
  heap_used_percent: number;
  page_cache_hit_ratio: number;
}

interface ServiceBusInfo {
  namespace: string;
  status: string;
  queues: {
    name: string;
    active_messages: number;
    dead_letter_messages: number;
    status: string;
  }[];
}

interface StorageInfo {
  account_name: string;
  status: string;
  containers: number;
  total_size_bytes: number;
  blob_count: number;
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
  const totalDLQ = serviceBus?.queues?.reduce((sum, q) => sum + q.dead_letter_messages, 0) ?? 0;

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
                  value={postgresql?.status ?? '—'}
                  format="raw"
                  icon={Database}
                  iconColor={postgresql?.status === 'Ready' ? 'text-status-success' : 'text-status-warning'}
                />
                <MetricCard
                  title="Neo4j"
                  value={neo4j?.status ?? '—'}
                  format="raw"
                  icon={CircleDot}
                  iconColor={neo4j?.status === 'running' || neo4j?.status === 'healthy' ? 'text-status-success' : 'text-status-warning'}
                />
                <MetricCard
                  title="Service Bus"
                  value={serviceBus?.status ?? '—'}
                  format="raw"
                  icon={HardDrive}
                  iconColor={totalDLQ > 0 ? 'text-status-warning' : 'text-status-success'}
                  subtitle={totalDLQ > 0 ? `${totalDLQ} DLQ msgs` : 'Clean'}
                />
                <MetricCard
                  title="Storage"
                  value={storage ? formatBytes(storage.total_size_bytes) : '—'}
                  format="raw"
                  icon={HardDrive}
                  iconColor="text-brand-blue"
                  subtitle={storage ? `${storage.blob_count} blobs` : undefined}
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
                              <p className="text-sm font-medium text-text-primary">{app.display_name}</p>
                              <p className="text-xs text-text-muted font-mono">{app.name}</p>
                              <p className="text-xs text-text-muted">
                                {app.replica_count} replicas &middot; {app.cpu} vCPU &middot; {app.memory}
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
                <Card title="PostgreSQL" subtitle={postgresql?.server_name}>
                  {postgresql ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Version</span>
                        <span className="text-sm font-mono text-text-primary">{postgresql.version}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">SKU</span>
                        <span className="text-sm text-text-primary">{postgresql.sku}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Storage</span>
                        <span className="text-sm font-mono text-text-primary">
                          {formatBytes(postgresql.storage_used_bytes)} / {formatBytes(postgresql.storage_limit_bytes)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Connections</span>
                        <span className="text-sm font-mono text-text-primary">
                          {postgresql.connections_active} / {postgresql.connections_max}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-muted">CPU</span>
                          <span className="text-xs font-mono text-text-secondary">{postgresql.cpu_percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-surface rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              postgresql.cpu_percent > 80 ? 'bg-status-error' : postgresql.cpu_percent > 60 ? 'bg-status-warning' : 'bg-status-success'
                            )}
                            style={{ width: `${Math.min(postgresql.cpu_percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No PostgreSQL data</p>
                  )}
                </Card>

                {/* Neo4j */}
                <Card title="Neo4j" subtitle={neo4j?.vm_name}>
                  {neo4j ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Version</span>
                        <span className="text-sm font-mono text-text-primary">{neo4j.version}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Nodes</span>
                        <span className="text-sm font-mono text-text-primary">{formatNumber(neo4j.node_count)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Relationships</span>
                        <span className="text-sm font-mono text-text-primary">{formatNumber(neo4j.relationship_count)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Store Size</span>
                        <span className="text-sm font-mono text-text-primary">{formatBytes(neo4j.store_size_bytes)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Page Cache Hit Ratio</span>
                        <span className={cn(
                          'text-sm font-mono',
                          neo4j.page_cache_hit_ratio > 0.95 ? 'text-status-success' : 'text-status-warning'
                        )}>
                          {(neo4j.page_cache_hit_ratio * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-muted">Heap Used</span>
                          <span className="text-xs font-mono text-text-secondary">{neo4j.heap_used_percent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-surface rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              neo4j.heap_used_percent > 80 ? 'bg-status-error' : neo4j.heap_used_percent > 60 ? 'bg-status-warning' : 'bg-status-success'
                            )}
                            style={{ width: `${Math.min(neo4j.heap_used_percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-text-muted text-center py-8">No Neo4j data</p>
                  )}
                </Card>
              </div>

              {/* Service Bus Queues */}
              <Card title="Service Bus Queues" subtitle={serviceBus?.namespace}>
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
                        serviceBus.queues.map((q) => (
                          <tr key={q.name} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                            <td className="py-2 px-3 font-medium text-text-primary">{q.name}</td>
                            <td className="py-2 px-3 text-right font-mono text-text-secondary">
                              {formatNumber(q.active_messages)}
                            </td>
                            <td className={cn(
                              'py-2 px-3 text-right font-mono',
                              q.dead_letter_messages > 0 ? 'text-status-error font-semibold' : 'text-text-secondary'
                            )}>
                              {formatNumber(q.dead_letter_messages)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge status={q.status === 'Active' ? 'healthy' : q.status} />
                            </td>
                          </tr>
                        ))
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
