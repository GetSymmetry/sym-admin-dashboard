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
import { Bell, BellRing, ShieldCheck, ShieldAlert, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { AlertsResponse, AlertRule, FiredAlert } from '@/types/metrics';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const SEVERITY_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Critical', color: 'text-status-error', bg: 'bg-status-error/10' },
  1: { label: 'Error', color: 'text-status-error', bg: 'bg-status-error/5' },
  2: { label: 'Warning', color: 'text-status-warning', bg: 'bg-status-warning/10' },
  3: { label: 'Info', color: 'text-brand-blue', bg: 'bg-brand-blue/10' },
  4: { label: 'Verbose', color: 'text-text-muted', bg: 'bg-surface-tertiary' },
};

function getSeverityInfo(sev: number | string) {
  if (typeof sev === 'string') {
    const num = parseInt(sev.replace(/\D/g, ''));
    return SEVERITY_LABELS[num] || SEVERITY_LABELS[3];
  }
  return SEVERITY_LABELS[sev] || SEVERITY_LABELS[3];
}

function AlertRuleRow({ rule }: { rule: AlertRule }) {
  const sev = getSeverityInfo(rule.severity);
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg border transition-colors',
      rule.enabled ? 'bg-surface border-border-subtle' : 'bg-surface-tertiary border-border-subtle opacity-60'
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn('w-2 h-2 rounded-full shrink-0', rule.enabled ? 'bg-status-success' : 'bg-text-muted')} />
        <div className="min-w-0">
          <p className="text-body-small font-medium text-text-primary truncate">{rule.name}</p>
          {rule.displayName !== rule.name && (
            <p className="text-body-xs text-text-muted truncate">{rule.displayName}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={cn('px-2 py-0.5 text-body-xs font-medium rounded-full', sev.bg, sev.color)}>
          {sev.label}
        </span>
        <span className="text-body-xs text-text-muted px-2 py-0.5 bg-surface-tertiary rounded-full">
          {rule.type}
        </span>
        {rule.enabled ? (
          <CheckCircle size={16} className="text-status-success" />
        ) : (
          <XCircle size={16} className="text-text-muted" />
        )}
      </div>
    </div>
  );
}

function FiredAlertRow({ alert }: { alert: FiredAlert }) {
  const sev = getSeverityInfo(alert.severity);
  const isFiring = alert.monitorCondition === 'Fired';
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
          <p className="text-body-small font-medium text-text-primary truncate">{alert.name}</p>
          <span className={cn('px-2 py-0.5 text-body-xs font-medium rounded-full', sev.bg, sev.color)}>
            {sev.label}
          </span>
        </div>
        {alert.description && (
          <p className="text-body-xs text-text-muted mb-1 truncate">{alert.description}</p>
        )}
        <div className="flex items-center gap-4 text-body-xs text-text-muted">
          <StatusBadge status={isFiring ? 'error' : 'success'} />
          <span>Fired {alert.firedTime ? timeAgo(alert.firedTime) : 'unknown'}</span>
          {alert.resolvedTime && (
            <span>Resolved {timeAgo(alert.resolvedTime)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'critical'>('all');
  const { environment, timeRange, setEnvironment, setTimeRange } = useDashboardState();
  const { data, isLoading, mutate } = useSWR<AlertsResponse>(
    `/api/alerts?env=${environment}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Filter rules
  const filteredRules = (data?.rules || []).filter(rule => {
    if (filter === 'enabled') return rule.enabled;
    if (filter === 'critical') return rule.severity <= 1;
    return true;
  });

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
          title="Alerts"
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
                <p className="text-text-muted">Loading alert rules...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Rules"
                  value={data?.summary?.totalRules || 0}
                  icon={Bell}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Enabled"
                  value={data?.summary?.enabledRules || 0}
                  icon={ShieldCheck}
                  iconColor="text-status-success"
                />
                <MetricCard
                  title="Currently Firing"
                  value={data?.summary?.currentlyFiring || 0}
                  icon={BellRing}
                  iconColor={
                    (data?.summary?.currentlyFiring || 0) > 0
                      ? 'text-status-error'
                      : 'text-status-success'
                  }
                />
                <MetricCard
                  title="Critical/Error Rules"
                  value={(data?.summary?.bySeverity?.[0] || 0) + (data?.summary?.bySeverity?.[1] || 0)}
                  icon={ShieldAlert}
                  iconColor="text-status-warning"
                />
              </div>

              {/* Severity Breakdown */}
              {data?.summary?.bySeverity && Object.keys(data.summary.bySeverity).length > 0 && (
                <Card title="Rules by Severity">
                  <div className="flex gap-4 flex-wrap">
                    {Object.entries(data.summary.bySeverity)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([sev, count]) => {
                        const info = getSeverityInfo(Number(sev));
                        return (
                          <div key={sev} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg', info.bg)}>
                            <span className={cn('text-body-base font-bold', info.color)}>{count as number}</span>
                            <span className="text-body-small text-text-secondary">{info.label}</span>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              )}

              {/* Fired Alerts */}
              {data?.firedAlerts && data.firedAlerts.length > 0 && (
                <Card
                  title="Fired Alerts (Last 24h)"
                  subtitle={`${data.firedAlerts.length} alerts`}
                >
                  <div className="space-y-2">
                    {data.firedAlerts.map((alert) => (
                      <FiredAlertRow key={alert.id} alert={alert} />
                    ))}
                  </div>
                </Card>
              )}

              {data?.firedAlerts?.length === 0 && (
                <Card>
                  <div className="text-center py-6 text-text-muted">
                    <ShieldCheck size={32} className="mx-auto mb-2 text-status-success" />
                    <p className="text-body-small">No alerts fired in the last 24 hours</p>
                  </div>
                </Card>
              )}

              {/* Alert Rules */}
              <Card
                title="Alert Rules"
                subtitle={`${filteredRules.length} rules`}
                action={
                  <div className="flex gap-1">
                    {(['all', 'enabled', 'critical'] as const).map(f => (
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
                  {filteredRules.length > 0 ? (
                    filteredRules.map((rule) => (
                      <AlertRuleRow key={rule.id || rule.name} rule={rule} />
                    ))
                  ) : (
                    <div className="text-center py-6 text-text-muted">
                      <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-body-small">No alert rules found for this filter</p>
                    </div>
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
