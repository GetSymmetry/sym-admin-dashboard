'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ServiceStatus } from '@/components/dashboard/ServiceStatus';
import { ErrorsList } from '@/components/dashboard/ErrorsList';
import { PerformanceTable } from '@/components/dashboard/PerformanceTable';
import { QueueStatus } from '@/components/dashboard/QueueStatus';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from '@/components/charts/BarChart';
import { Card } from '@/components/ui/Card';
import { timeAgo } from '@/lib/utils';
import { useDashboardState } from '@/hooks/useDashboardState';
import useSWR from 'swr';
import {
  AlertTriangle,
  DollarSign,
  Zap,
  Users,
  Briefcase,
  MessageSquare,
  Database,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function DashboardContent() {
  const [collapsed, setCollapsed] = useState(false);
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data with time range
  const { data, isLoading, mutate } = useSWR(
    `/api/metrics?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const { data: dbData } = useSWR(
    `/api/database?env=${environment}`,
    fetcher,
    { refreshInterval: 120000 }
  );
  const { data: llmData } = useSWR(
    `/api/llm?env=${environment}&range=${timeRange}`,
    fetcher,
    { refreshInterval: 120000 }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Generate time series data based on selected time range
  // Uses real data from llmData.overTime if available, otherwise generates placeholder
  const getTimeSeriesData = () => {
    // Use real LLM cost over time data if available
    if (llmData?.overTime && llmData.overTime.length > 0) {
      return llmData.overTime.map((item: { time: string; cost: number; tokens?: number }) => ({
        time: item.time,
        requests: item.tokens || 0,
        errors: 0, // Would need separate error time series
        cost: item.cost,
      }));
    }
    
    // Generate placeholder data aligned to time range
    const dataPoints = [];
    const pointsCount = timeRange === '15m' ? 15 : timeRange === '1h' ? 12 : timeRange === '6h' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 24;
    const isDaily = timeRange.includes('d');
    
    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date();
      if (isDaily) {
        d.setDate(d.getDate() - i);
        dataPoints.push({
          time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          requests: 0,
          errors: 0,
        });
      } else {
        d.setHours(d.getHours() - i);
        dataPoints.push({
          time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          requests: 0,
          errors: 0,
        });
      }
    }
    return dataPoints;
  };

  const timeSeriesData = getTimeSeriesData();

  // Format time range for display
  const formatTimeRange = (range: string) => {
    const match = range.match(/(\d+)([hd])/);
    if (!match) return range;
    const [, num, unit] = match;
    return `${num}${unit === 'h' ? 'h' : 'd'}`;
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
          title="System Overview"
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
                <p className="text-text-muted">Loading metrics from Azure...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetricCard
                  title="Total Users"
                  value={dbData?.counts?.users || 0}
                  icon={Users}
                  subtitle="Registered users"
                />
                <MetricCard
                  title="Workspaces"
                  value={dbData?.counts?.workspaces || 0}
                  icon={Briefcase}
                  subtitle={`${dbData?.counts?.organizations || 0} orgs`}
                />
                <MetricCard
                  title="Knowledge Units"
                  value={dbData?.counts?.knowledgeUnits || 0}
                  icon={Database}
                  subtitle="Total KUs"
                />
                <MetricCard
                  title="Conversations"
                  value={dbData?.counts?.conversations || 0}
                  icon={MessageSquare}
                  subtitle="Chat sessions"
                />
                <MetricCard
                  title={`LLM Cost (${formatTimeRange(timeRange)})`}
                  value={llmData?.totals?.totalCost || data?.overview?.llmCost24h || 0}
                  format="currency"
                  icon={DollarSign}
                  subtitle={`${(llmData?.totals?.totalCalls || data?.overview?.llmCalls24h || 0).toLocaleString()} calls`}
                />
                <MetricCard
                  title={`Errors (${formatTimeRange(timeRange)})`}
                  value={data?.overview?.totalErrors || 0}
                  icon={AlertTriangle}
                  subtitle={data?.overview?.totalErrors ? 'Needs attention' : 'All clear'}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card
                  title="Traffic Overview"
                  subtitle={`Requests & Errors (${formatTimeRange(timeRange)})`}
                >
                  <AreaChart
                    data={timeSeriesData}
                    xField="time"
                    yFields={[
                      { key: 'requests', color: '#4077ed', name: 'Requests' },
                      { key: 'errors', color: '#ef4444', name: 'Errors' },
                    ]}
                    height={240}
                  />
                </Card>

                <Card
                  title="Requests by Service"
                  subtitle={`Distribution (${formatTimeRange(timeRange)})`}
                >
                  <BarChart
                    data={data?.requestsByService?.slice(0, 5) || []}
                    xField="service"
                    yField="count"
                    height={240}
                    horizontal
                  />
                </Card>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ServiceStatus
                  services={data?.services || []}
                />
                <QueueStatus
                  queues={data?.queues || []}
                />
                <ErrorsList
                  errors={data?.recentErrors || []}
                />
              </div>

              {/* LLM & Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card
                  title="LLM Usage by Model"
                  subtitle={`Cost & tokens (${formatTimeRange(timeRange)})`}
                >
                  <div className="space-y-3">
                    {(llmData?.byModel || data?.llmByModel)?.map((model: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background-secondary rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center">
                            <Zap size={16} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {model.model || 'Unknown'}
                            </p>
                            <p className="text-xs text-text-muted">
                              {model.calls?.toLocaleString()} calls
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-warning">
                            ${(model.totalCost || model.cost || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {((model.inputTokens || 0) + (model.outputTokens || 0) || model.tokens || 0).toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-text-muted text-center py-8">
                        No LLM data available
                      </p>
                    )}
                  </div>
                </Card>

                <PerformanceTable
                  data={data?.performance || []}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
