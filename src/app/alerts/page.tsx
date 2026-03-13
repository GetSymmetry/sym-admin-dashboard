'use client';

import { useState, useMemo, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, timeAgo } from '@/lib/utils';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { Bell, BellRing, ShieldCheck, ShieldAlert, AlertTriangle, BarChart3 } from 'lucide-react';

/* ── Types matching debugger endpoint response ── */

interface FiredAlertEntry {
  timestamp: string;
  customDimensions_alertName: string;
  customDimensions_severity: string;
  customDimensions_monitorCondition: string;
}

interface AlertTraceEntry {
  message: string;
  count_: number;
}

interface AlertsData {
  fired_alerts: FiredAlertEntry[];
  alert_traces: AlertTraceEntry[];
}

/* ── Severity helpers ── */

const SEVERITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  '0': { label: 'Critical', color: 'text-status-error', bg: 'bg-status-error/10' },
  '1': { label: 'Error', color: 'text-status-error', bg: 'bg-status-error/5' },
  '2': { label: 'Warning', color: 'text-status-warning', bg: 'bg-status-warning/10' },
  '3': { label: 'Info', color: 'text-brand-blue', bg: 'bg-brand-blue/10' },
  '4': { label: 'Verbose', color: 'text-text-muted', bg: 'bg-surface-tertiary' },
};

const DEFAULT_SEVERITY = { label: 'Unknown', color: 'text-text-muted', bg: 'bg-surface-tertiary' };

function getSeverityInfo(sev: string): { label: string; color: string; bg: string } {
  // Extract leading digit(s) from severity strings like "Sev0", "0", "Sev2", etc.
  const num = sev.replace(/\D/g, '');
  return SEVERITY_LABELS[num] || DEFAULT_SEVERITY;
}

/* ── Row components ── */

function FiredAlertRow({ alert }: { alert: FiredAlertEntry }) {
  const sev = getSeverityInfo(alert.customDimensions_severity);
  const isFiring = alert.customDimensions_monitorCondition === 'Fired';

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      isFiring ? 'bg-status-error/5 border-status-error/20' : 'bg-surface border-border-subtle'
    )}>
      {isFiring ? (
        <BellRing size={18} className="text-status-error mt-0.5 shrink-0" />
      ) : (
        <Bell size={18} className="text-text-muted mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-body-small font-medium text-text-primary truncate">
            {alert.customDimensions_alertName}
          </p>
          <span className={cn('px-2 py-0.5 text-body-xs font-medium rounded-full', sev.bg, sev.color)}>
            {sev.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-body-xs text-text-muted">
          <StatusBadge status={isFiring ? 'error' : 'success'} />
          <span>{isFiring ? 'Fired' : 'Resolved'} {alert.timestamp ? timeAgo(alert.timestamp) : 'unknown'}</span>
        </div>
      </div>
    </div>
  );
}

function AlertTraceRow({ trace }: { trace: AlertTraceEntry }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-surface border-border-subtle">
      <p className="text-body-small text-text-primary truncate flex-1 min-w-0 mr-4">
        {trace.message}
      </p>
      <span className="text-body-small font-bold text-text-secondary shrink-0 tabular-nums">
        {trace.count_}
      </span>
    </div>
  );
}

/* ── Main content ── */

function AlertsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'firing' | 'resolved'>('all');
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data, isLoading, refresh } = useDebugger<AlertsData>(
    '/debug/infra/alerts',
    undefined,
    { refreshInterval: 60000 }
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Compute summary stats from fired_alerts
  const summary = useMemo(() => {
    const alerts = data?.fired_alerts || [];
    const totalAlerts = alerts.length;
    const currentlyFiring = alerts.filter(a => a.customDimensions_monitorCondition === 'Fired').length;
    const resolved = totalAlerts - currentlyFiring;

    // Count by severity
    const bySeverity: Record<string, number> = {};
    for (const alert of alerts) {
      const sev = alert.customDimensions_severity;
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }

    // Count critical+error (severity 0 or 1)
    const criticalErrorCount = alerts.filter(a => {
      const num = a.customDimensions_severity.replace(/\D/g, '');
      return num === '0' || num === '1';
    }).length;

    return { totalAlerts, currentlyFiring, resolved, bySeverity, criticalErrorCount };
  }, [data?.fired_alerts]);

  // Filter fired alerts
  const filteredAlerts = useMemo(() => {
    const alerts = data?.fired_alerts || [];
    if (filter === 'firing') return alerts.filter(a => a.customDimensions_monitorCondition === 'Fired');
    if (filter === 'resolved') return alerts.filter(a => a.customDimensions_monitorCondition !== 'Fired');
    return alerts;
  }, [data?.fired_alerts, filter]);

  const alertTraces = data?.alert_traces || [];

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Alerts"
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
                <p className="text-text-muted">Loading alerts...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Alerts"
                  value={summary.totalAlerts}
                  icon={Bell}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Currently Firing"
                  value={summary.currentlyFiring}
                  icon={BellRing}
                  iconColor={
                    summary.currentlyFiring > 0
                      ? 'text-status-error'
                      : 'text-status-success'
                  }
                />
                <MetricCard
                  title="Resolved"
                  value={summary.resolved}
                  icon={ShieldCheck}
                  iconColor="text-status-success"
                />
                <MetricCard
                  title="Critical / Error"
                  value={summary.criticalErrorCount}
                  icon={ShieldAlert}
                  iconColor="text-status-warning"
                />
              </div>

              {/* Severity Breakdown */}
              {Object.keys(summary.bySeverity).length > 0 && (
                <Card title="Alerts by Severity">
                  <div className="flex gap-4 flex-wrap">
                    {Object.entries(summary.bySeverity)
                      .sort(([a], [b]) => {
                        const numA = parseInt(a.replace(/\D/g, '') || '99');
                        const numB = parseInt(b.replace(/\D/g, '') || '99');
                        return numA - numB;
                      })
                      .map(([sev, count]) => {
                        const info = getSeverityInfo(sev);
                        return (
                          <div key={sev} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg', info.bg)}>
                            <span className={cn('text-body-base font-bold', info.color)}>{count}</span>
                            <span className="text-body-small text-text-secondary">{info.label}</span>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              )}

              {/* Fired Alerts */}
              <Card
                title="Fired Alerts"
                subtitle={`${filteredAlerts.length} alerts`}
                action={
                  <div className="flex gap-1">
                    {(['all', 'firing', 'resolved'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          'px-3 py-1 text-body-xs rounded-full transition-colors',
                          filter === f
                            ? 'bg-brand-blue text-white'
                            : 'text-text-muted hover:bg-surface-tertiary'
                        )}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="space-y-2">
                  {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert, i) => (
                      <FiredAlertRow key={`${alert.customDimensions_alertName}-${alert.timestamp}-${i}`} alert={alert} />
                    ))
                  ) : (
                    <div className="text-center py-6 text-text-muted">
                      <ShieldCheck size={32} className="mx-auto mb-2 text-status-success" />
                      <p className="text-body-small">No alerts found for this filter</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Alert Traces */}
              {alertTraces.length > 0 && (
                <Card
                  title="Alert Traces"
                  subtitle={`${alertTraces.length} trace patterns`}
                >
                  <div className="space-y-2">
                    {alertTraces.map((trace, i) => (
                      <AlertTraceRow key={`${trace.message}-${i}`} trace={trace} />
                    ))}
                  </div>
                </Card>
              )}

              {alertTraces.length === 0 && summary.totalAlerts === 0 && (
                <Card>
                  <div className="text-center py-6 text-text-muted">
                    <ShieldCheck size={32} className="mx-auto mb-2 text-status-success" />
                    <p className="text-body-small">No alert activity detected</p>
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

export default function AlertsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-surface-secondary">
        <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    }>
      <AlertsContent />
    </Suspense>
  );
}
