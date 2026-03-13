'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, timeAgo } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { Rocket, Server, GitCommit, Box, Layers, Clock } from 'lucide-react';

interface RevisionDeployment {
  app_name: string;
  revision_name: string;
  created: string;
  active: boolean;
  traffic_weight: number;
  provisioning_state: string;
  replicas: number;
}

interface AppInfo {
  name: string;
  location: string;
  provisioning_state: string;
  running_status: string | null;
  latest_revision: string;
}

interface DeploymentsData {
  deployments: RevisionDeployment[];
  apps: AppInfo[];
  summary: {
    total_apps: number;
    total_revisions: number;
    last_deployment: string | null;
  };
}

function DeploymentsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();
  const { data, metadata, isLoading, refresh } = useDebugger<DeploymentsData>(
    '/debug/infra/deployments',
    undefined,
    { refreshInterval: 120000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Filter deployments by selected app
  const filteredDeployments = (data?.deployments || []).filter(
    d => selectedApp === 'all' || d.app_name === selectedApp
  );

  // Unique app names for filter
  const appNames = [...new Set((data?.deployments || []).map(d => d.app_name))];

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Deployments"
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
                  value={data?.summary?.total_apps || 0}
                  icon={Server}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Total Revisions"
                  value={data?.summary?.total_revisions || 0}
                  icon={Layers}
                  iconColor="text-info"
                />
                <MetricCard
                  title="Last Deployment"
                  value={
                    data?.summary?.last_deployment
                      ? timeAgo(data.summary.last_deployment)
                      : 'Unknown'
                  }
                  format="raw"
                  icon={Rocket}
                  iconColor="text-status-warning"
                />
                <MetricCard
                  title="Environment"
                  value="PROD"
                  format="raw"
                  icon={Box}
                  iconColor="text-status-error"
                />
              </div>

              {/* Current Active Images */}
              {data?.apps && data.apps.length > 0 && (
                <Card title="Active Container Apps" subtitle="Currently running services">
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
                            <p className="text-body-small font-medium text-text-primary">{app.name}</p>
                            <p className="text-body-xs font-mono text-text-muted truncate">{app.latest_revision}</p>
                          </div>
                        </div>
                        <StatusBadge
                          status={app.provisioning_state === 'Succeeded' ? 'healthy' : app.provisioning_state}
                          pulse={app.provisioning_state === 'Succeeded'}
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
                        {name}
                      </button>
                    ))}
                  </div>
                }
              >
                {filteredDeployments.length > 0 ? (
                  <div className="space-y-2">
                    {filteredDeployments.map((dep) => (
                      <div
                        key={dep.revision_name}
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
                                {dep.app_name}
                              </span>
                              {dep.active && (
                                <span className="text-body-xs text-status-success font-medium">ACTIVE</span>
                              )}
                              {dep.traffic_weight > 0 && (
                                <span className="text-body-xs text-brand-blue font-medium">
                                  {dep.traffic_weight}% traffic
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <GitCommit size={12} className="text-text-muted shrink-0" />
                              <span className="text-body-xs font-mono text-text-muted truncate">
                                {dep.revision_name}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={dep.provisioning_state} />
                          <div className="flex items-center gap-1 text-body-xs text-text-muted">
                            <Clock size={12} />
                            <span>
                              {dep.created ? timeAgo(dep.created) : 'unknown'}
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
