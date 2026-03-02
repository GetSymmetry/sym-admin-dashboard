'use client';

import { useState, Suspense } from 'react';
import useSWR from 'swr';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Gauge } from '@/components/ui/Gauge';
import { cn, timeAgo } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import { Database, Cpu, MemoryStick, HardDrive, AlertTriangle, Clock, Zap, ShieldCheck } from 'lucide-react';
import type { Neo4jResponse } from '@/types/metrics';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function Neo4jContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR<Neo4jResponse>(
    `/api/neo4j?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const health = data?.health;
  // Detect if we have actual VM telemetry or just zeros (no agent installed)
  const hasVmTelemetry = health && (health.cpuPercent > 0 || health.memoryPercent > 0 || health.diskPercent > 0);
  const overallHealth =
    health
      ? !hasVmTelemetry
        ? 'unknown'
        : health.cpuPercent < 85 && health.memoryPercent < 90 && health.diskPercent < 85 && health.connectionErrors === 0
        ? 'healthy'
        : health.cpuPercent > 90 || health.memoryPercent > 95 || health.diskPercent > 90
        ? 'critical'
        : 'warning'
      : 'unknown';

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
          title="Neo4j Graph Database"
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
                <p className="text-text-muted">Loading Neo4j metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* No telemetry banner */}
              {data && !hasVmTelemetry && (
                <div className="flex items-center gap-3 p-4 bg-status-warning/5 border border-status-warning/20 rounded-lg">
                  <AlertTriangle size={20} className="text-status-warning shrink-0" />
                  <div>
                    <p className="text-body-small font-medium text-text-primary">No VM telemetry data available</p>
                    <p className="text-body-xs text-text-muted">
                      Azure Monitor Agent may not be installed on {data?.vmName}. CPU/Memory/Disk gauges require the agent to send data to Log Analytics.
                      Application-level metrics (connection errors, query performance) are still tracked via App Insights.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="VM Status"
                  value={
                    overallHealth === 'unknown' ? 'No Data' :
                    overallHealth === 'healthy' ? 'Healthy' :
                    overallHealth === 'critical' ? 'Critical' : 'Warning'
                  }
                  format="raw"
                  icon={Database}
                  iconColor={
                    overallHealth === 'healthy'
                      ? 'text-status-success'
                      : overallHealth === 'critical'
                      ? 'text-status-error'
                      : overallHealth === 'unknown'
                      ? 'text-text-muted'
                      : 'text-status-warning'
                  }
                />
                <MetricCard
                  title="CPU Usage"
                  value={`${health?.cpuPercent?.toFixed(1) || 0}%`}
                  format="raw"
                  icon={Cpu}
                  iconColor={
                    (health?.cpuPercent || 0) > 85 ? 'text-status-error' : 'text-brand-blue'
                  }
                />
                <MetricCard
                  title="Memory Usage"
                  value={`${health?.memoryPercent?.toFixed(1) || 0}%`}
                  format="raw"
                  icon={MemoryStick}
                  iconColor={
                    (health?.memoryPercent || 0) > 90 ? 'text-status-error' : 'text-brand-blue'
                  }
                />
                <MetricCard
                  title="Disk Usage"
                  value={`${health?.diskPercent?.toFixed(1) || 0}%`}
                  format="raw"
                  icon={HardDrive}
                  iconColor={
                    (health?.diskPercent || 0) > 85 ? 'text-status-error' : 'text-brand-blue'
                  }
                />
                <MetricCard
                  title="Connection Errors"
                  value={health?.connectionErrors || 0}
                  icon={AlertTriangle}
                  iconColor={
                    (health?.connectionErrors || 0) > 0
                      ? 'text-status-error'
                      : 'text-status-success'
                  }
                />
              </div>

              {/* Health Gauges + Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Resource Utilization" subtitle={data?.vmName || ''}>
                  <div className="flex justify-around items-center py-4">
                    <Gauge
                      value={health?.cpuPercent || 0}
                      label="CPU"
                      thresholds={[
                        { value: 85, color: 'rgb(239 68 68)' },
                        { value: 60, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                    <Gauge
                      value={health?.memoryPercent || 0}
                      label="Memory"
                      thresholds={[
                        { value: 90, color: 'rgb(239 68 68)' },
                        { value: 70, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                    <Gauge
                      value={health?.diskPercent || 0}
                      label="Disk"
                      thresholds={[
                        { value: 85, color: 'rgb(239 68 68)' },
                        { value: 70, color: 'rgb(245 158 11)' },
                        { value: 0, color: 'rgb(34 197 94)' },
                      ]}
                    />
                  </div>
                </Card>

                <Card title="Performance & Backup">
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap size={18} className="text-brand-blue" />
                        <span className="text-body-small text-text-secondary">Queries/hour</span>
                      </div>
                      <span className="text-body-base font-bold font-mono text-text-primary">
                        {data?.performance?.boltQueriesPerHour || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-brand-blue" />
                        <span className="text-body-small text-text-secondary">Avg Response</span>
                      </div>
                      <span className="text-body-base font-bold font-mono text-text-primary">
                        {data?.performance?.avgResponseMs || 0}ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className={
                          health?.lastBackupTime && health.lastBackupTime !== 'Unknown'
                            ? 'text-status-success'
                            : 'text-status-warning'
                        } />
                        <span className="text-body-small text-text-secondary">Last Backup</span>
                      </div>
                      <span className="text-body-small font-mono text-text-primary">
                        {health?.lastBackupTime && health.lastBackupTime !== 'Unknown'
                          ? timeAgo(health.lastBackupTime)
                          : 'No data'}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Connection Errors */}
              <Card
                title="Connection Errors"
                subtitle={`${data?.connectionErrors?.length || 0} errors in selected time range`}
              >
                {data?.connectionErrors && data.connectionErrors.length > 0 ? (
                  <div className="space-y-2">
                    {data.connectionErrors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-status-error/5 border border-status-error/10 rounded-lg"
                      >
                        <AlertTriangle size={16} className="text-status-error mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-body-xs text-text-primary break-words">{err.message}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-body-xs text-text-muted">
                              {timeAgo(err.timestamp)}
                            </span>
                            <StatusBadge status={err.service} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-text-muted">
                    <ShieldCheck size={32} className="mx-auto mb-2 text-status-success" />
                    <p className="text-body-small">No connection errors in selected time range</p>
                  </div>
                )}
              </Card>

              {/* VM Info */}
              <Card title="VM Information" subtitle={`${environment.toUpperCase()} environment`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-surface-tertiary rounded-lg">
                    <p className="text-body-xs text-text-muted">VM Name</p>
                    <p className="font-mono text-body-small text-text-primary">{data?.vmName || '-'}</p>
                  </div>
                  <div className="p-3 bg-surface-tertiary rounded-lg">
                    <p className="text-body-xs text-text-muted">Size</p>
                    <p className="font-mono text-body-small text-text-primary">
                      {environment === 'prod' ? 'Standard_D2s_v3' : 'Standard_B2s'}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-tertiary rounded-lg">
                    <p className="text-body-xs text-text-muted">Protocol</p>
                    <p className="font-mono text-body-small text-text-primary">
                      bolt://{environment === 'prod' ? '130.131.192.201' : '52.176.143.10'}:7687
                    </p>
                  </div>
                </div>
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
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-surface-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <Neo4jContent />
    </Suspense>
  );
}
