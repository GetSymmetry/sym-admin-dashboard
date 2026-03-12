'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, formatNumber } from '@/lib/utils';
import {
  HeartPulse,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link2Off,
  ShieldCheck,
} from 'lucide-react';

/* ── Types ── */

interface HealthScore {
  overall_score: number;
  postgresql_score: number;
  neo4j_score: number;
  consistency_score: number;
  completeness_score: number;
  grade: string;
}

interface ConsistencyCheck {
  name: string;
  status: string;
  description: string;
  mismatched_count: number;
  details: string;
}

interface OrphanRecord {
  type: string;
  id: string;
  table_or_label: string;
  reason: string;
  created_at: string;
}

/* ── Skeleton ── */

function DataHealthSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-48 bg-surface rounded-card border border-border-subtle" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-card border border-border-subtle" />
        ))}
      </div>
      <div className="h-64 bg-surface rounded-card border border-border-subtle" />
    </div>
  );
}

/* ── Content ── */

function DataHealthContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: score, isLoading: scoreLoading, refresh } =
    useDebugger<HealthScore>('/debug/health/score');

  const { data: checks, isLoading: checksLoading } =
    useDebugger<ConsistencyCheck[]>('/debug/health/consistency');

  const { data: orphans, isLoading: orphansLoading } =
    useDebugger<OrphanRecord[]>('/debug/health/orphans', { limit: '50' });

  const isLoading = scoreLoading && !score;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
      case 'A+':
        return 'text-status-success';
      case 'B':
      case 'B+':
        return 'text-brand-blue';
      case 'C':
        return 'text-status-warning';
      default:
        return 'text-status-error';
    }
  };

  const passedChecks = checks?.filter((c) => c.status === 'passed').length ?? 0;
  const failedChecks = checks?.filter((c) => c.status === 'failed').length ?? 0;

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Data Health"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || scoreLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <DataHealthSkeleton />
          ) : (
            <>
              {/* Overall Score */}
              {score && (
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary mb-1">Overall Data Health</h2>
                      <p className="text-sm text-text-muted">
                        Cross-database consistency and completeness
                      </p>
                    </div>
                    <div className="text-center">
                      <span className={cn('text-5xl font-bold font-mono', getGradeColor(score.grade))}>
                        {score.grade}
                      </span>
                      <p className="text-sm text-text-muted mt-1">{score.overall_score.toFixed(0)}/100</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Score Breakdown */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="PostgreSQL"
                  value={score?.postgresql_score != null ? `${score.postgresql_score.toFixed(0)}%` : '—'}
                  format="raw"
                  icon={ShieldCheck}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Neo4j"
                  value={score?.neo4j_score != null ? `${score.neo4j_score.toFixed(0)}%` : '—'}
                  format="raw"
                  icon={ShieldCheck}
                  iconColor="text-brand-blue"
                />
                <MetricCard
                  title="Consistency"
                  value={score?.consistency_score != null ? `${score.consistency_score.toFixed(0)}%` : '—'}
                  format="raw"
                  icon={CheckCircle}
                  iconColor={score?.consistency_score != null && score.consistency_score >= 90 ? 'text-status-success' : 'text-status-warning'}
                />
                <MetricCard
                  title="Completeness"
                  value={score?.completeness_score != null ? `${score.completeness_score.toFixed(0)}%` : '—'}
                  format="raw"
                  icon={CheckCircle}
                  iconColor={score?.completeness_score != null && score.completeness_score >= 90 ? 'text-status-success' : 'text-status-warning'}
                />
              </div>

              {/* Consistency Checks */}
              <Card
                title="Consistency Checks"
                subtitle={`${passedChecks} passed, ${failedChecks} failed`}
              >
                <div className="space-y-2">
                  {checks && checks.length > 0 ? (
                    checks.map((check, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-start justify-between p-3 rounded-lg border',
                          check.status === 'passed'
                            ? 'bg-status-success/5 border-status-success/20'
                            : 'bg-status-error/5 border-status-error/20'
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {check.status === 'passed' ? (
                            <CheckCircle size={16} className="text-status-success mt-0.5 shrink-0" />
                          ) : (
                            <XCircle size={16} className="text-status-error mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary">{check.name}</p>
                            <p className="text-xs text-text-muted mt-0.5">{check.description}</p>
                            {check.mismatched_count > 0 && (
                              <p className="text-xs text-status-error mt-1 font-mono">
                                {check.mismatched_count} mismatched records
                              </p>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={check.status === 'passed' ? 'healthy' : 'error'} />
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted text-center py-8">
                      {checksLoading ? 'Running checks...' : 'No consistency checks available'}
                    </p>
                  )}
                </div>
              </Card>

              {/* Orphan Records */}
              <Card
                title="Orphan Records"
                subtitle={`${orphans?.length ?? 0} orphaned records found`}
              >
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">ID</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Source</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphans && orphans.length > 0 ? (
                        orphans.map((o, i) => (
                          <tr key={i} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-status-warning/10 text-status-warning rounded text-xs font-medium">
                                {o.type}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-text-secondary text-xs">{o.id.substring(0, 12)}...</td>
                            <td className="py-2 px-3 text-text-muted text-xs">{o.table_or_label}</td>
                            <td className="py-2 px-3 text-text-muted text-xs">{o.reason}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-text-muted">
                            {orphansLoading ? 'Scanning for orphans...' : 'No orphan records found'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DataHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <DataHealthContent />
    </Suspense>
  );
}
