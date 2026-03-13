'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatNumber } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import {
  Database,
  CircleDot,
  GitFork,
  HardDrive,
  ShieldCheck,
  List,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

/* ── Types matching debugger endpoint response ── */

interface Neo4jHealth {
  healthy: boolean;
  version: string;
  edition: string;
  uptime: string;
}

interface Neo4jStats {
  node_count: number;
  edge_count: number;
  store_size: string;
}

interface Neo4jNodeCount {
  label: string;
  count: number;
}

interface Neo4jIndex {
  name: string;
  type: string;
  entity_type: string;
  labelsOrTypes: string[];
  properties: string[];
  state: string;
}

interface Neo4jData {
  health: Neo4jHealth;
  stats: Neo4jStats;
  node_counts: Neo4jNodeCount[];
  indexes: Neo4jIndex[];
}

/* ── Skeleton ── */

function Neo4jSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-surface rounded-card border border-border-subtle" />
        <div className="h-64 bg-surface rounded-card border border-border-subtle" />
      </div>
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
    </div>
  );
}

/* ── Content ── */

function Neo4jContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data, isLoading, refresh } = useDebugger<Neo4jData>(
    '/debug/infra/neo4j',
    undefined,
    { refreshInterval: 60000 }
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const isHealthy = data?.health?.healthy ?? false;
  const onlineIndexes = data?.indexes?.filter((idx) => idx.state === 'ONLINE').length ?? 0;
  const totalIndexes = data?.indexes?.length ?? 0;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Neo4j Graph Database"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading && !data ? (
            <Neo4jSkeleton />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="Status"
                  value={isHealthy ? 'Healthy' : 'Unhealthy'}
                  format="raw"
                  icon={Database}
                  iconColor={isHealthy ? 'text-status-success' : 'text-status-error'}
                />
                <MetricCard
                  title="Total Nodes"
                  value={formatNumber(data?.stats?.node_count ?? 0)}
                  format="raw"
                  icon={CircleDot}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Total Relationships"
                  value={formatNumber(data?.stats?.edge_count ?? 0)}
                  format="raw"
                  icon={GitFork}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Store Size"
                  value={data?.stats?.store_size ?? '--'}
                  format="raw"
                  icon={HardDrive}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Indexes"
                  value={`${onlineIndexes}/${totalIndexes}`}
                  format="raw"
                  icon={List}
                  iconColor={onlineIndexes === totalIndexes ? 'text-status-success' : 'text-status-warning'}
                  subtitle={onlineIndexes === totalIndexes ? 'All online' : 'Some offline'}
                />
              </div>

              {/* Health + Node Counts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Database Health */}
                <Card title="Database Health" subtitle={data?.health?.version ? `v${data.health.version}` : undefined}>
                  {data?.health ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Status</span>
                        <span className={cn(
                          'text-sm font-medium',
                          isHealthy ? 'text-status-success' : 'text-status-error'
                        )}>
                          {isHealthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Version</span>
                        <span className="text-sm font-mono text-text-primary">
                          {data.health.version || '--'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Edition</span>
                        <span className="text-sm font-mono text-text-primary">
                          {data.health.edition || '--'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Uptime</span>
                        <span className="text-sm font-mono text-text-primary">
                          {data.health.uptime || '--'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                        <span className="text-sm text-text-muted">Store Size</span>
                        <span className="text-sm font-mono text-text-primary">
                          {data.stats?.store_size || '--'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-muted">
                      <Database size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-body-small">No health data available</p>
                    </div>
                  )}
                </Card>

                {/* Node Counts */}
                <Card
                  title="Node Counts"
                  subtitle={`${data?.node_counts?.length ?? 0} labels, ${formatNumber(data?.stats?.node_count ?? 0)} total`}
                >
                  {data?.node_counts && data.node_counts.length > 0 ? (
                    <div className="space-y-1.5">
                      {data.node_counts.map((nc) => (
                        <div
                          key={nc.label}
                          className="flex items-center justify-between p-2.5 bg-surface-tertiary rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <CircleDot size={14} className="text-brand-blue shrink-0" />
                            <span className="text-sm font-mono text-text-primary">{nc.label}</span>
                          </div>
                          <span className="text-sm font-mono text-text-secondary">
                            {formatNumber(nc.count)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-muted">
                      <CircleDot size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-body-small">No node data available</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Indexes Table */}
              <Card title="Indexes" subtitle={`${totalIndexes} indexes configured`}>
                {data?.indexes && data.indexes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Name</th>
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Entity</th>
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Labels/Types</th>
                          <th className="text-left py-2 px-3 text-text-muted font-medium">Properties</th>
                          <th className="text-center py-2 px-3 text-text-muted font-medium">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.indexes.map((idx) => (
                          <tr
                            key={idx.name}
                            className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50"
                          >
                            <td className="py-2 px-3 font-mono text-text-primary">{idx.name}</td>
                            <td className="py-2 px-3 text-text-secondary">{idx.type}</td>
                            <td className="py-2 px-3 text-text-secondary">{idx.entity_type}</td>
                            <td className="py-2 px-3 text-text-secondary font-mono text-xs">
                              {idx.labelsOrTypes?.join(', ') || '--'}
                            </td>
                            <td className="py-2 px-3 text-text-secondary font-mono text-xs">
                              {idx.properties?.join(', ') || '--'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 text-xs font-medium',
                                idx.state === 'ONLINE' ? 'text-status-success' : 'text-status-warning'
                              )}>
                                {idx.state === 'ONLINE' ? (
                                  <CheckCircle size={12} />
                                ) : (
                                  <AlertTriangle size={12} />
                                )}
                                {idx.state}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-muted">
                    <ShieldCheck size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-body-small">No index data available</p>
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Neo4jPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <Neo4jContent />
    </Suspense>
  );
}
