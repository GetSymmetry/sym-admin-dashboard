'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ServiceStatus } from '@/components/dashboard/ServiceStatus';
import { QueueStatus } from '@/components/dashboard/QueueStatus';
import { Gauge } from '@/components/ui/Gauge';
import { cn, timeAgo } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { Server, Database, HardDrive, Cpu, Activity, Wifi, CheckCircle, XCircle, Box } from 'lucide-react';
import type { ContainerAppsResponse } from '@/types/metrics';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function InfrastructureContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR(`/api/metrics?env=${environment}&range=${timeRange}`, fetcher, {
    refreshInterval: 30000,
  });
  const { data: containerData, mutate: mutateContainers } = useSWR<ContainerAppsResponse>(
    `/api/container-apps?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([mutate(), mutateContainers()]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Calculate health status from both Container Apps and metrics services
  const containerApps = containerData?.apps || [];
  const metricsServices = data?.services || [];
  const healthyContainerApps = containerApps.filter(a => a.provisioningState === 'Succeeded').length;
  const healthyMetricsServices = metricsServices.filter(
    (s: { status: string }) => s.status === 'healthy' || s.status === 'Running'
  ).length;
  const totalServices = containerApps.length > 0 ? containerApps.length : metricsServices.length;
  const healthyServices = containerApps.length > 0 ? healthyContainerApps : healthyMetricsServices;
  const overallHealth = totalServices > 0 ? (healthyServices / totalServices) * 100 : 0;

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
          title="Infrastructure"
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
                <div className="w-12 h-12 border-4 border-success/30 border-t-success rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading infrastructure metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Health Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="Overall Health"
                  value={`${overallHealth.toFixed(0)}%`}
                  format="raw"
                  icon={Activity}
                  iconColor={overallHealth === 100 ? 'text-success' : 'text-warning'}
                />
                <MetricCard
                  title="Services Up"
                  value={`${healthyServices}/${totalServices}`}
                  format="raw"
                  icon={Server}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Queue Depth"
                  value={data?.overview?.queueDepth || 0}
                  icon={HardDrive}
                  iconColor="text-info"
                />
                <MetricCard
                  title="Dead Letters"
                  value={data?.overview?.deadLetters || 0}
                  icon={XCircle}
                  iconColor={data?.overview?.deadLetters > 0 ? 'text-error' : 'text-success'}
                />
                <MetricCard
                  title="Requests/hour"
                  value={data?.overview?.totalRequests || 0}
                  icon={Wifi}
                  iconColor="text-info"
                />
              </div>

              {/* Health Gauges */}
              <Card title="System Health" subtitle="Real-time status">
                <div className="flex justify-around items-center py-4">
                  <Gauge
                    value={overallHealth}
                    label="Services"
                    thresholds={[
                      { value: 90, color: 'rgb(34 197 94)' },
                      { value: 70, color: 'rgb(245 158 11)' },
                      { value: 0, color: 'rgb(239 68 68)' },
                    ]}
                  />
                  <Gauge
                    value={Math.min((data?.overview?.queueDepth || 0) / 100 * 100, 100)}
                    label="Queue Load"
                    thresholds={[
                      { value: 80, color: 'rgb(239 68 68)' },
                      { value: 50, color: 'rgb(245 158 11)' },
                      { value: 0, color: 'rgb(34 197 94)' },
                    ]}
                  />
                  <Gauge
                    value={data?.overview?.deadLetters > 0 ? 100 : 0}
                    label="DLQ Status"
                    thresholds={[
                      { value: 1, color: 'rgb(239 68 68)' },
                      { value: 0, color: 'rgb(34 197 94)' },
                    ]}
                  />
                </div>
              </Card>

              {/* Container Apps */}
              {containerApps.length > 0 && (
                <Card title="Container Apps" subtitle={`${containerApps.length} apps in ${environment.toUpperCase()}`}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {containerApps.map((app) => {
                      const isHealthy = app.provisioningState === 'Succeeded';
                      return (
                        <div
                          key={app.name}
                          className={cn(
                            'flex items-center justify-between p-4 rounded-lg border transition-colors',
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
                              <p className="text-sm font-medium text-text-primary">{app.displayName}</p>
                              <p className="text-xs text-text-muted font-mono">{app.name}</p>
                              <p className="text-xs text-text-muted">
                                {Math.round(app.metrics.replicaCount)} replicas &middot; {app.cpu} vCPU &middot; {app.memory}
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            'flex items-center gap-1.5 text-xs font-medium',
                            isHealthy ? 'text-status-success' : 'text-status-error'
                          )}>
                            {isHealthy ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {isHealthy ? 'Running' : app.provisioningState}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Services & Queues */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ServiceStatus services={data?.services || []} />
                <QueueStatus queues={data?.queues || []} />
              </div>

              {/* Azure Resources */}
              <Card title="Azure Resources" subtitle={`${environment.toUpperCase()} environment`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    { name: 'PostgreSQL', icon: Database, status: 'healthy', detail: `db-sym-${environment}-centralus` },
                    { name: 'Service Bus', icon: HardDrive, status: data?.overview?.deadLetters > 0 ? 'warning' : 'healthy', detail: `sb-sym-${environment}-centralus` },
                    { name: 'Key Vault', icon: CheckCircle, status: 'healthy', detail: `kv-sym-${environment}-centralus` },
                    { name: 'App Insights', icon: Activity, status: 'healthy', detail: `ai-asp-sym-${environment}-centralus` },
                    { name: 'Log Analytics', icon: Cpu, status: 'healthy', detail: `log-asp-sym-${environment}-centralus` },
                    { name: 'Neo4j VM', icon: Server, status: 'healthy', detail: `vm-neo4j-${environment}-centralus` },
                  ] as Array<{ name: string; icon: typeof Server; status: string; detail: string }>).map((resource, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-lg border transition-colors',
                        resource.status === 'healthy'
                          ? 'bg-status-success/5 border-status-success/20'
                          : 'bg-status-warning/5 border-status-warning/20'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          resource.status === 'healthy'
                            ? 'bg-status-success/20 text-status-success'
                            : 'bg-status-warning/20 text-status-warning'
                        )}>
                          <resource.icon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{resource.name}</p>
                          <p className="text-xs text-text-muted font-mono">{resource.detail}</p>
                        </div>
                      </div>
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs font-medium',
                        resource.status === 'healthy' ? 'text-status-success' : 'text-status-warning'
                      )}>
                        {resource.status === 'healthy' ? <CheckCircle size={14} /> : <Activity size={14} />}
                        {resource.status === 'healthy' ? 'Healthy' : 'Warning'}
                      </div>
                    </div>
                  ))}
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
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <InfrastructureContent />
    </Suspense>
  );
}
