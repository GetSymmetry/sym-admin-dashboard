'use client';

import { useState, useMemo, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QueueStatus } from '@/components/dashboard/QueueStatus';
import { BarChart } from '@/components/charts/BarChart';
import { cn } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { Cpu, CheckCircle, XCircle, Clock, Play, Inbox, AlertTriangle } from 'lucide-react';

/* ── Response types from debugger ── */

interface PipelineJob {
  job_type: string;
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  avg_duration_secs: number | null;
}

interface ServiceBusData {
  queues: Array<{ name: string; status: string }>;
  metrics: Array<{
    name: string;
    active_message_count: number;
    dead_letter_message_count: number;
    scheduled_message_count: number;
    total_message_count: number;
    size_in_bytes: number;
  }>;
}

function JobsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: pipelineData, isLoading: pipelineLoading, refresh: refreshPipeline } =
    useDebugger<PipelineJob[]>('/debug/insights/pipeline-health', undefined, { refreshInterval: 30000 });

  const { data: sbData, isLoading: sbLoading, refresh: refreshSb } =
    useDebugger<ServiceBusData>('/debug/infra/service-bus', undefined, { refreshInterval: 30000 });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshPipeline(), refreshSb()]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Aggregate job counts across all job types
  const jobs = useMemo(() => {
    if (!pipelineData || !Array.isArray(pipelineData)) {
      return { total: 0, completed: 0, failed: 0, processing: 0, pending: 0 };
    }
    return pipelineData.reduce(
      (acc, j) => ({
        total: acc.total + (j.total || 0),
        completed: acc.completed + (j.completed || 0),
        failed: acc.failed + (j.failed || 0),
        processing: acc.processing + (j.processing || 0),
        pending: acc.pending + (j.pending || 0),
      }),
      { total: 0, completed: 0, failed: 0, processing: 0, pending: 0 }
    );
  }, [pipelineData]);

  // Map service bus metrics to QueueStatus shape
  const queues = useMemo(() => {
    if (!sbData?.metrics) return [];
    return sbData.metrics.map((m) => ({
      name: m.name,
      active: m.active_message_count,
      deadLetter: m.dead_letter_message_count,
    }));
  }, [sbData]);

  const totalDeadLetters = queues.reduce((sum, q) => sum + q.deadLetter, 0);

  const isLoading = pipelineLoading || sbLoading;
  const successRate = jobs.total > 0 ? ((jobs.completed / jobs.total) * 100) : 100;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Jobs & Queues"
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
          {isLoading && !pipelineData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted">Loading job metrics...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Job Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <MetricCard
                  title="Total Jobs"
                  value={jobs.total}
                  icon={Cpu}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Completed"
                  value={jobs.completed}
                  icon={CheckCircle}
                  iconColor="text-success"
                />
                <MetricCard
                  title="Failed"
                  value={jobs.failed}
                  icon={XCircle}
                  iconColor={jobs.failed > 0 ? 'text-error' : 'text-text-muted'}
                />
                <MetricCard
                  title="Processing"
                  value={jobs.processing}
                  icon={Play}
                  iconColor={jobs.processing > 0 ? 'text-warning' : 'text-text-muted'}
                />
                <MetricCard
                  title="Pending"
                  value={jobs.pending}
                  icon={Clock}
                  iconColor={jobs.pending > 0 ? 'text-info' : 'text-text-muted'}
                />
                <MetricCard
                  title="Success Rate"
                  value={`${successRate.toFixed(1)}%`}
                  format="raw"
                  icon={CheckCircle}
                  iconColor={successRate >= 95 ? 'text-success' : successRate >= 80 ? 'text-warning' : 'text-error'}
                />
              </div>

              {/* Jobs by Status Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Jobs by Status" subtitle="Current distribution">
                  <BarChart
                    data={[
                      { status: 'Completed', count: jobs.completed },
                      { status: 'Processing', count: jobs.processing },
                      { status: 'Pending', count: jobs.pending },
                      { status: 'Failed', count: jobs.failed },
                    ].filter(d => d.count > 0)}
                    xField="status"
                    yField="count"
                    height={250}
                    colors={['#22c55e', '#f59e0b', '#3b82f6', '#ef4444']}
                  />
                </Card>

                <QueueStatus queues={queues} />
              </div>

              {/* Job Status Details */}
              <Card title="Job Status Breakdown" subtitle="Detailed view">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Completed', value: jobs.completed, icon: CheckCircle, colorClass: 'success' },
                    { label: 'Processing', value: jobs.processing, icon: Play, colorClass: 'warning' },
                    { label: 'Pending', value: jobs.pending, icon: Clock, colorClass: 'info' },
                    { label: 'Failed', value: jobs.failed, icon: XCircle, colorClass: 'error' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        'p-4 rounded-lg border text-center',
                        item.colorClass === 'success' && 'bg-success-light border-success',
                        item.colorClass === 'warning' && 'bg-warning-light border-warning',
                        item.colorClass === 'info' && 'bg-info-light border-info',
                        item.colorClass === 'error' && 'bg-error-light border-error'
                      )}
                    >
                      <item.icon
                        size={24}
                        className={cn(
                          'mx-auto mb-2',
                          item.colorClass === 'success' && 'text-success',
                          item.colorClass === 'warning' && 'text-warning',
                          item.colorClass === 'info' && 'text-info',
                          item.colorClass === 'error' && 'text-error'
                        )}
                      />
                      <p className="text-2xl font-bold font-mono text-text-primary">
                        {item.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-text-muted mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Queue Messages */}
              <Card
                title="Message Queue Status"
                subtitle="Service Bus queues"
                action={
                  totalDeadLetters > 0 && (
                    <div className="flex items-center gap-1.5 text-error text-sm">
                      <AlertTriangle size={14} />
                      {totalDeadLetters} dead letters
                    </div>
                  )
                }
              >
                <div className="space-y-3">
                  {queues.length > 0 ? queues.map((queue, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-lg border',
                        queue.deadLetter > 0
                          ? 'bg-error-light border-error'
                          : 'bg-surface-tertiary border-border-subtle'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          queue.deadLetter > 0
                            ? 'bg-error/20 text-error'
                            : 'bg-brand-blue/20 text-brand-blue'
                        )}>
                          <Inbox size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{queue.name}</p>
                          <p className="text-xs text-text-muted">
                            {queue.active} active messages
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {queue.deadLetter > 0 ? (
                          <div className="flex items-center gap-1.5 text-error">
                            <AlertTriangle size={14} />
                            <span className="text-sm font-mono">{queue.deadLetter} DLQ</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-success">
                            <CheckCircle size={14} />
                            <span className="text-sm">Healthy</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p className="text-text-muted text-center py-8">No queue data available</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <JobsContent />
    </Suspense>
  );
}
