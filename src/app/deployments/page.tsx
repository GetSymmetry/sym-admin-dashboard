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
import { Rocket, Server, GitCommit, Calendar, Box, CheckCircle, Clock } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ServiceDeployment {
  name: string;
  type: string;
  resource: string;
  version: string;
  gitCommit: string;
  buildNumber: string;
  deployedAt: string;
  runtime: string;
}

function DeploymentsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, setEnvironment } = useDashboardState();
  const { data, isLoading, mutate } = useSWR(`/api/deployments?env=${environment}`, fetcher, {
    refreshInterval: 120000,
  });
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
          title="Deployments"
          environment={environment}
          lastUpdated={data?.timestamp ? timeAgo(data.timestamp) : undefined}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || isLoading}
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
                  title="Total Services"
                  value={data?.summary?.totalServices || 0}
                  format="raw"
                  icon={Server}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="With Version Info"
                  value={data?.summary?.withVersionInfo || 0}
                  format="raw"
                  icon={GitCommit}
                  iconColor="text-success"
                />
                <MetricCard
                  title="Last Deployment"
                  value={data?.summary?.lastDeployment !== 'unknown' 
                    ? timeAgo(data?.summary?.lastDeployment) 
                    : 'Unknown'}
                  format="raw"
                  icon={Rocket}
                  iconColor="text-warning"
                />
                <MetricCard
                  title="Environment"
                  value={environment.toUpperCase()}
                  format="raw"
                  icon={Box}
                  iconColor={environment === 'prod' ? 'text-error' : 'text-success'}
                />
              </div>

              {/* Service Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data?.services?.map((service: ServiceDeployment, index: number) => (
                  <Card
                    key={index}
                    className="overflow-hidden"
                  >
                    {/* Service Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          service.type === 'Function App' 
                            ? 'bg-info/20 text-info'
                            : 'bg-brand-blue/20 text-brand-blue'
                        )}>
                          {service.type === 'Function App' ? <Rocket size={20} /> : <Server size={20} />}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-text-primary">{service.name}</h3>
                          <p className="text-xs text-text-muted">{service.type}</p>
                        </div>
                      </div>
                      <StatusBadge 
                        status={service.version !== 'unknown' ? 'healthy' : 'warning'} 
                      />
                    </div>

                    {/* Service Details */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Box size={12} />
                            <span>Version</span>
                          </div>
                          <p className="text-sm font-mono text-text-primary">
                            {service.version !== 'unknown' ? service.version : '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <GitCommit size={12} />
                            <span>Commit</span>
                          </div>
                          <p className="text-sm font-mono text-text-primary">
                            {service.gitCommit !== 'unknown' ? service.gitCommit : '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <CheckCircle size={12} />
                            <span>Build</span>
                          </div>
                          <p className="text-sm font-mono text-text-primary">
                            {service.buildNumber !== 'unknown' ? `#${service.buildNumber}` : '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Calendar size={12} />
                            <span>Deployed</span>
                          </div>
                          <p className="text-sm text-text-primary">
                            {service.deployedAt !== 'unknown' ? timeAgo(service.deployedAt) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Runtime Info */}
                      <div className="pt-3 border-t border-border-subtle">
                        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                          <Clock size={12} />
                          <span>Runtime</span>
                        </div>
                        <p className="text-xs font-mono text-text-muted truncate">
                          {service.runtime !== 'unknown' ? service.runtime : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </Card>
                )) || (
                  <p className="text-text-muted col-span-2 text-center py-8">
                    No deployment information available
                  </p>
                )}
              </div>

              {/* Setup Instructions */}
              {data?.summary?.withVersionInfo === 0 && (
                <Card title="📋 Setup Deployment Tracking" className="border-warning">
                  <div className="text-sm text-text-muted space-y-4">
                    <p>
                      To enable deployment tracking, add these environment variables to your CI/CD pipeline:
                    </p>
                    <pre className="bg-surface-tertiary p-4 rounded-lg overflow-x-auto text-xs font-mono text-text-secondary">
{`# In your GitHub Actions or Azure DevOps pipeline:
APP_VERSION: \${{ github.ref_name }}
GIT_COMMIT: \${{ github.sha }}
BUILD_NUMBER: \${{ github.run_number }}
DEPLOYED_AT: \${{ github.event.head_commit.timestamp }}
DEPLOYED_BY: \${{ github.actor }}`}
                    </pre>
                    <p className="text-text-muted">
                      These values will be displayed in the dashboard after your next deployment.
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

export default function DeploymentsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <DeploymentsContent />
    </Suspense>
  );
}
