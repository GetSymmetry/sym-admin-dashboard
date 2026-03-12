'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

/* ── Types (matched to backend response shapes) ── */

/** /debug/health/score → success_response data */
interface HealthCheck {
  healthy: boolean;
  [key: string]: unknown;
}

interface HealthScore {
  score: number;
  status: 'healthy' | 'warning' | 'error';
  checks: {
    postgresql: HealthCheck;
    neo4j: HealthCheck;
    storage: HealthCheck;
  };
}

/** /debug/health/consistency → success_response data */
interface ConsistencyIssue {
  type: string;
  count: number;
}

interface ConsistencyData {
  consistent: boolean;
  issues: ConsistencyIssue[];
  checks_run: number;
}

/** /debug/health/orphans → success_response data */
interface OrphanedMember {
  id: string;
  workspace_id: string;
  user_id: string;
}

interface OrphanedJob {
  id: string;
  workspace_id: string;
  job_type: string;
}

interface OrphansData {
  orphaned_workspace_members: OrphanedMember[] | null;
  orphaned_jobs: OrphanedJob[] | null;
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

/* ── Helpers ── */

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'text-status-success';
    case 'warning':
      return 'text-brand-blue';
    case 'error':
      return 'text-status-error';
    default:
      return 'text-text-muted';
  }
}

function getStatusGrade(status: string) {
  switch (status) {
    case 'healthy':
      return 'A';
    case 'warning':
      return 'C';
    case 'error':
      return 'F';
    default:
      return '?';
  }
}

/** Flatten orphans data into a uniform list for the table. */
function flattenOrphans(data: OrphansData | null): Array<{ type: string; id: string; source: string; detail: string }> {
  if (!data) return [];
  const rows: Array<{ type: string; id: string; source: string; detail: string }> = [];

  for (const member of data.orphaned_workspace_members ?? []) {
    rows.push({
      type: 'orphaned_member',
      id: String(member.id ?? ''),
      source: 'workspace_members',
      detail: `workspace_id: ${member.workspace_id ?? 'unknown'}`,
    });
  }

  for (const job of data.orphaned_jobs ?? []) {
    rows.push({
      type: 'orphaned_job',
      id: String(job.id ?? ''),
      source: 'processing_jobs',
      detail: `workspace_id: ${job.workspace_id ?? 'unknown'}, job_type: ${job.job_type ?? 'unknown'}`,
    });
  }

  return rows;
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

  const { data: consistency, isLoading: consistencyLoading } =
    useDebugger<ConsistencyData>('/debug/health/consistency');

  const { data: orphansData, isLoading: orphansLoading } =
    useDebugger<OrphansData>('/debug/health/orphans');

  const isLoading = scoreLoading && !score;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const orphanRows = flattenOrphans(orphansData);

  // Derive consistency check display from the issues array
  const consistencyChecks = (() => {
    if (!consistency) return [];
    const checkNames = ['orphaned_members', 'invalid_org_refs', 'orphaned_jobs'];
    const checkLabels: Record<string, string> = {
      orphaned_members: 'Orphaned Workspace Members',
      invalid_org_refs: 'Invalid Organization References',
      orphaned_jobs: 'Orphaned Processing Jobs',
    };
    const issueMap = new Map(consistency.issues.map((i) => [i.type, i.count]));
    return checkNames.map((name) => {
      const count = issueMap.get(name) ?? 0;
      return {
        name: checkLabels[name] ?? name,
        passed: count === 0,
        count,
      };
    });
  })();

  const passedChecks = consistencyChecks.filter((c) => c.passed).length;
  const failedChecks = consistencyChecks.filter((c) => !c.passed).length;

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
                      <span className={cn('text-5xl font-bold font-mono', getStatusColor(score.status))}>
                        {getStatusGrade(score.status)}
                      </span>
                      <p className="text-sm text-text-muted mt-1">{score.score}/100</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Score Breakdown */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="PostgreSQL"
                  value={score?.checks?.postgresql ? (score.checks.postgresql.healthy ? 'Healthy' : 'Unhealthy') : '—'}
                  format="raw"
                  icon={ShieldCheck}
                  iconColor={score?.checks?.postgresql?.healthy ? 'text-status-success' : 'text-status-error'}
                />
                <MetricCard
                  title="Neo4j"
                  value={score?.checks?.neo4j ? (score.checks.neo4j.healthy ? 'Healthy' : 'Unhealthy') : '—'}
                  format="raw"
                  icon={ShieldCheck}
                  iconColor={score?.checks?.neo4j?.healthy ? 'text-status-success' : 'text-status-error'}
                />
                <MetricCard
                  title="Storage"
                  value={score?.checks?.storage ? (score.checks.storage.healthy ? 'Healthy' : 'Unhealthy') : '—'}
                  format="raw"
                  icon={ShieldCheck}
                  iconColor={score?.checks?.storage?.healthy ? 'text-status-success' : 'text-status-error'}
                />
              </div>

              {/* Consistency Checks */}
              <Card
                title="Consistency Checks"
                subtitle={consistency ? `${passedChecks} passed, ${failedChecks} failed of ${consistency.checks_run} checks` : undefined}
              >
                <div className="space-y-2">
                  {consistencyChecks.length > 0 ? (
                    consistencyChecks.map((check, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-start justify-between p-3 rounded-lg border',
                          check.passed
                            ? 'bg-status-success/5 border-status-success/20'
                            : 'bg-status-error/5 border-status-error/20'
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {check.passed ? (
                            <CheckCircle size={16} className="text-status-success mt-0.5 shrink-0" />
                          ) : (
                            <XCircle size={16} className="text-status-error mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary">{check.name}</p>
                            {check.count > 0 && (
                              <p className="text-xs text-status-error mt-1 font-mono">
                                {check.count} problematic records
                              </p>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={check.passed ? 'healthy' : 'error'} />
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted text-center py-8">
                      {consistencyLoading ? 'Running checks...' : 'No consistency checks available'}
                    </p>
                  )}
                </div>
              </Card>

              {/* Orphan Records */}
              <Card
                title="Orphan Records"
                subtitle={`${orphanRows.length} orphaned records found`}
              >
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">ID</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Source</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphanRows.length > 0 ? (
                        orphanRows.map((o, i) => (
                          <tr key={i} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-status-warning/10 text-status-warning rounded text-xs font-medium">
                                {o.type}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-text-secondary text-xs">
                              {o.id.length > 12 ? `${o.id.substring(0, 12)}...` : o.id}
                            </td>
                            <td className="py-2 px-3 text-text-muted text-xs">{o.source}</td>
                            <td className="py-2 px-3 text-text-muted text-xs">{o.detail}</td>
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
