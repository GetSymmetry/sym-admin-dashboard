'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, timeAgo } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { Rocket, Server, GitCommit, Box, Layers, Clock } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface RevisionDeployment {
  appName: string;
  displayName: string;
  revisionName: string;
  image: string;
  imageTag: string;
  createdTime: string;
  runningState: string;
  trafficWeight: number;
  active: boolean;
  replicas: number;
}

interface DeploymentsData {
  timestamp: string;
  environment: string;
  deployments: RevisionDeployment[];
  apps: Array<{
    name: string;
    displayName: string;
    activeRevision: string;
    status: string;
    image: string;
  }>;
  summary: {
    totalApps: number;
    totalRevisions: number;
    lastDeployment: string;
  };
}

function DeploymentsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR<DeploymentsData>(
    `/api/deployments?env=${environment}`,
    fetcher,
    { refreshInterval: 120000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Filter deployments by selected app
  const filteredDeployments = (data?.deployments || []).filter(
    d => selectedApp === 'all' || d.appName === selectedApp
  );

  // Unique app names for filter
  const appNames = [...new Set((data?.deployments || []).map(d => d.appName))];

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
          title="Deployments"
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
                <p className="text-text-muted">Loading deployment info...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Container Apps"
                  value={data?.summary?.totalApps || 0}
                  icon={Server}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Total Revisions"
                  value={data?.summary?.totalRevisions || 0}
                  icon={Layers}
                  iconColor="text-info"
                />
                <MetricCard
                  title="Last Deployment"
                  value={
                    data?.summary?.lastDeployment && data.summary.lastDeployment !== 'unknown'
                      ? timeAgo(data.summary.lastDeployment)
                      : 'Unknown'
                  }
                  format="raw"
                  icon={Rocket}
                  iconColor="text-status-warning"
                />
                <MetricCard
                  title="Environment"
                  value={environment.toUpperCase()}
                  format="raw"
                  icon={Box}
                  iconColor={environment === 'prod' ? 'text-status-error' : 'text-status-success'}
                />
              </div>

              {/* Current Active Images */}
              {data?.apps && data.apps.length > 0 && (
                <Card title="Active Container Images" subtitle="Currently running images per service">
                  <div className="space-y-3">
                    {data.apps.map((app) => (
                      <div
                        key={app.name}
                        className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                            <Server size={16} className="text-brand-blue" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-body-small font-medium text-text-primary">{app.displayName}</p>
                            <p className="text-body-xs font-mono text-text-muted truncate">{app.image}</p>
                          </div>
                        </div>
                        <StatusBadge
                          status={app.status === 'Succeeded' ? 'healthy' : app.status}
                          pulse={app.status === 'Succeeded'}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Deployment History */}
              <Card
                title="Revision History"
                subtitle={`${filteredDeployments.length} revisions (newest first)`}
                action={
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSelectedApp('all')}
                      className={cn(
                        'px-3 py-1 text-body-xs rounded-full transition-colors',
                        selectedApp === 'all'
                          ? 'bg-brand-blue text-white'
                          : 'text-text-muted hover:bg-surface-tertiary'
                      )}
                    >
                      All
                    </button>
                    {appNames.map(name => (
                      <button
                        key={name}
                        onClick={() => setSelectedApp(name)}
                        className={cn(
                          'px-3 py-1 text-body-xs rounded-full transition-colors',
                          selectedApp === name
                            ? 'bg-brand-blue text-white'
                            : 'text-text-muted hover:bg-surface-tertiary'
                        )}
                      >
                        {(data?.deployments || []).find(d => d.appName === name)?.displayName || name}
                      </button>
                    ))}
                  </div>
                }
              >
                {filteredDeployments.length > 0 ? (
                  <div className="space-y-2">
                    {filteredDeployments.map((dep) => (
                      <div
                        key={dep.revisionName}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border transition-colors',
                          dep.active
                            ? 'bg-status-success/5 border-status-success/20'
                            : 'bg-surface border-border-subtle'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            dep.active ? 'bg-status-success' : 'bg-text-muted'
                          )} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-body-small font-medium text-text-primary">
                                {dep.displayName}
                              </span>
                              {dep.active && (
                                <span className="text-body-xs text-status-success font-medium">ACTIVE</span>
                              )}
                              {dep.trafficWeight > 0 && (
                                <span className="text-body-xs text-brand-blue font-medium">
                                  {dep.trafficWeight}% traffic
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <GitCommit size={12} className="text-text-muted shrink-0" />
                              <span className="text-body-xs font-mono text-text-muted truncate">
                                {dep.imageTag}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={dep.runningState} />
                          <div className="flex items-center gap-1 text-body-xs text-text-muted">
                            <Clock size={12} />
                            <span>
                              {dep.createdTime !== 'unknown' ? timeAgo(dep.createdTime) : 'unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-muted">
                    <Rocket size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No deployment revisions found.</p>
                    <p className="text-body-xs mt-1">
                      Ensure the service principal has Reader access to Container Apps.
                    </p>
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

export default function DeploymentsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-surface-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <DeploymentsContent />
    </Suspense>
  );
}
