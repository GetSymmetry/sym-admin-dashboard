'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Gauge } from '@/components/ui/Gauge';
import { cn, timeAgo, formatBytes } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { Box, Cpu, MemoryStick, RotateCcw, Activity, Layers } from 'lucide-react';

/* ── Types for debugger /debug/infra/container-apps/detailed response ── */

interface ContainerAppRevision {
  name: string;
  created: string;
  active: boolean;
  traffic_weight: number;
  provisioning_state: string;
  replicas: number;
}

interface ContainerAppMetrics {
  cpu_millicores: number | null;
  memory_mb: number | null;
  replicas: number | null;
  restarts: number | null;
}

interface ContainerAppDetail {
  name: string;
  location: string;
  provisioning_state: string;
  running_status: string | null;
  latest_revision: string;
  min_replicas: number;
  max_replicas: number;
  image: string;
  cpu: number;
  memory: string;
  recent_revisions: ContainerAppRevision[];
  metrics?: ContainerAppMetrics;
}

interface ContainerAppsData {
  apps: ContainerAppDetail[];
  summary: {
    total_apps: number;
    running_apps: number;
    total_replicas: number;
  };
}

function ContainerAppsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { region, setRegion, timeRange, setTimeRange, availableRegions } = useDebuggerDashboardState();
  const { data, metadata, error, isLoading, refresh } = useDebugger<ContainerAppsData>(
    '/debug/infra/container-apps/detailed',
    undefined,
    { refreshInterval: 30000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
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
          title="Container Apps"
          environment="prod"
          lastUpdated={metadata?.timestamp ? timeAgo(metadata.timestamp) : undefined}
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
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading container apps...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Container Apps"
                  value={data?.summary?.total_apps || 0}
                  icon={Box}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Running"
                  value={data?.summary?.running_apps || 0}
                  icon={Activity}
                  iconColor="text-status-success"
                />
                <MetricCard
                  title="Total Replicas"
                  value={data?.summary?.total_replicas || 0}
                  icon={Layers}
                  iconColor="text-info"
                />
              </div>

              {/* Per-App Details */}
              {data?.apps?.map((app) => (
                <Card
                  key={app.name}
                  title={app.name}
                  subtitle={app.location}
                  action={
                    <StatusBadge
                      status={app.provisioning_state === 'Succeeded' ? 'healthy' : app.provisioning_state}
                      pulse={app.provisioning_state === 'Succeeded'}
                    />
                  }
                >
                  {/* Info Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold font-mono text-text-primary">
                        {app.cpu}
                      </div>
                      <p className="text-body-xs text-text-muted">vCPU</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold font-mono text-text-primary">
                        {app.memory}
                      </div>
                      <p className="text-body-xs text-text-muted">Memory</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold font-mono text-text-primary">
                        {app.min_replicas}-{app.max_replicas}
                      </div>
                      <p className="text-body-xs text-text-muted">Replica Range</p>
                    </div>
                  </div>

                  {/* Container Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-body-small">
                    <div className="p-3 bg-surface-tertiary rounded-lg">
                      <p className="text-text-muted mb-1">Container Image</p>
                      <p className="font-mono text-body-xs text-text-primary break-all">{app.image}</p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg">
                      <p className="text-text-muted mb-1">Latest Revision</p>
                      <p className="font-mono text-body-xs text-text-primary">{app.latest_revision}</p>
                    </div>
                  </div>

                  {/* Runtime Metrics */}
                  {app.metrics && Object.keys(app.metrics).length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border-subtle">
                      <div>
                        <div className="text-xs text-text-muted">CPU</div>
                        <div className="text-sm font-semibold text-text-primary">{app.metrics.cpu_millicores ?? '—'}m</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Memory</div>
                        <div className="text-sm font-semibold text-text-primary">{app.metrics.memory_mb != null ? `${app.metrics.memory_mb.toFixed(0)} MB` : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Replicas</div>
                        <div className="text-sm font-semibold text-text-primary">{app.metrics.replicas ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-muted">Restarts</div>
                        <div className={`text-sm font-semibold ${(app.metrics.restarts || 0) > 0 ? 'text-status-warning' : 'text-text-primary'}`}>
                          {app.metrics.restarts ?? 0}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent Revisions */}
                  {app.recent_revisions?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-body-small font-medium text-text-secondary mb-2">
                        Recent Revisions
                      </h4>
                      <div className="space-y-2">
                        {app.recent_revisions.map((rev) => (
                          <div
                            key={rev.name}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-lg text-body-xs',
                              rev.active ? 'bg-status-success/5 border border-status-success/20' : 'bg-surface-tertiary'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'w-2 h-2 rounded-full',
                                rev.active ? 'bg-status-success' : 'bg-text-muted'
                              )} />
                              <span className="font-mono text-text-primary">{rev.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <StatusBadge status={rev.provisioning_state} />
                              {rev.traffic_weight > 0 && (
                                <span className="text-brand-blue font-medium">
                                  {rev.traffic_weight}% traffic
                                </span>
                              )}
                              <span className="text-text-muted">
                                {rev.replicas} replica{rev.replicas !== 1 ? 's' : ''}
                              </span>
                              <span className="text-text-muted">
                                {rev.created !== 'unknown' ? timeAgo(rev.created) : 'unknown'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              {(!data?.apps || data.apps.length === 0) && (
                <Card>
                  <div className="text-center py-8 text-text-muted">
                    <Box size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No container apps found.</p>
                    <p className="text-body-xs mt-1">
                      Ensure the debugger service has access to the infrastructure resources.
                    </p>
                  </div>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ContainerAppsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-surface-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <ContainerAppsContent />
    </Suspense>
  );
}
