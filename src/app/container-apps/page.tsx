'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Gauge } from '@/components/ui/Gauge';
import { cn, timeAgo, formatBytes } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { Box, Cpu, MemoryStick, RotateCcw, Activity, Layers } from 'lucide-react';
import type { ContainerAppsResponse } from '@/types/metrics';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function ContainerAppsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR<ContainerAppsResponse>(
    `/api/container-apps?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
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
          title="Container Apps"
          environment={environment}
          lastUpdated={data?.timestamp ? timeAgo(data.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
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
                  value={data?.summary?.totalApps || 0}
                  icon={Box}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Running"
                  value={data?.summary?.runningApps || 0}
                  icon={Activity}
                  iconColor="text-status-success"
                />
                <MetricCard
                  title="Total Replicas"
                  value={data?.summary?.totalReplicas || 0}
                  icon={Layers}
                  iconColor="text-info"
                />
                <MetricCard
                  title="Total Restarts"
                  value={data?.summary?.totalRestarts || 0}
                  icon={RotateCcw}
                  iconColor={
                    (data?.summary?.totalRestarts || 0) > 0
                      ? 'text-status-warning'
                      : 'text-status-success'
                  }
                />
              </div>

              {/* Per-App Details */}
              {data?.apps?.map((app) => (
                <Card
                  key={app.name}
                  title={app.displayName}
                  subtitle={app.name}
                  action={
                    <StatusBadge
                      status={app.provisioningState === 'Succeeded' ? 'healthy' : app.provisioningState}
                      pulse={app.provisioningState === 'Succeeded'}
                    />
                  }
                >
                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <div className="text-center">
                      <Gauge
                        value={Math.min(app.metrics.cpuUsage, 100)}
                        label="CPU"
                        size={80}
                        thresholds={[
                          { value: 80, color: 'rgb(239 68 68)' },
                          { value: 50, color: 'rgb(245 158 11)' },
                          { value: 0, color: 'rgb(34 197 94)' },
                        ]}
                      />
                      <p className="text-body-xs text-text-muted mt-1">
                        {app.metrics.cpuUsage.toFixed(1)}% of {app.cpu} vCPU
                      </p>
                    </div>
                    <div className="text-center">
                      <Gauge
                        value={Math.min(
                          app.memory
                            ? (app.metrics.memoryUsage / (parseFloat(app.memory) * 1024)) * 100
                            : 0,
                          100
                        )}
                        label="Memory"
                        size={80}
                        thresholds={[
                          { value: 85, color: 'rgb(239 68 68)' },
                          { value: 60, color: 'rgb(245 158 11)' },
                          { value: 0, color: 'rgb(34 197 94)' },
                        ]}
                      />
                      <p className="text-body-xs text-text-muted mt-1">
                        {formatBytes(app.metrics.memoryUsage * 1024 * 1024)} / {app.memory}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold font-mono text-text-primary">
                        {Math.round(app.metrics.replicaCount)}
                      </div>
                      <p className="text-body-xs text-text-muted">
                        Replicas ({app.minReplicas}-{app.maxReplicas})
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className={cn(
                        'text-2xl font-bold font-mono',
                        app.metrics.restartCount > 0 ? 'text-status-warning' : 'text-status-success'
                      )}>
                        {app.metrics.restartCount}
                      </div>
                      <p className="text-body-xs text-text-muted">Restarts</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold font-mono text-text-primary">
                        {app.metrics.requestCount}
                      </div>
                      <p className="text-body-xs text-text-muted">Requests</p>
                    </div>
                  </div>

                  {/* Container Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-body-small">
                    <div className="p-3 bg-surface-tertiary rounded-lg">
                      <p className="text-text-muted mb-1">Container Image</p>
                      <p className="font-mono text-body-xs text-text-primary break-all">{app.image}</p>
                    </div>
                    <div className="p-3 bg-surface-tertiary rounded-lg">
                      <p className="text-text-muted mb-1">Active Revision</p>
                      <p className="font-mono text-body-xs text-text-primary">{app.activeRevision}</p>
                    </div>
                  </div>

                  {/* Recent Revisions */}
                  {app.recentRevisions?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-body-small font-medium text-text-secondary mb-2">
                        Recent Revisions
                      </h4>
                      <div className="space-y-2">
                        {app.recentRevisions.map((rev) => (
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
                              <StatusBadge status={rev.runningState} />
                              {rev.trafficWeight > 0 && (
                                <span className="text-brand-blue font-medium">
                                  {rev.trafficWeight}% traffic
                                </span>
                              )}
                              <span className="text-text-muted">
                                {rev.createdTime !== 'unknown' ? timeAgo(rev.createdTime) : 'unknown'}
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
                    <p>No container apps found in {environment.toUpperCase()} environment.</p>
                    <p className="text-body-xs mt-1">
                      Ensure the service principal has Reader access to the resource group.
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
