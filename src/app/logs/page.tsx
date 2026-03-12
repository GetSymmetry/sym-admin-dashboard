'use client';

import { useState, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { debuggerClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Play,
  BookOpen,
  ChevronRight,
  Loader2,
} from 'lucide-react';

/* ── Types ── */

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  operation_name: string;
  [key: string]: unknown;
}

interface SavedQuery {
  name: string;
  query: string;
  description: string;
}

/* ── Content ── */

function LogsContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const [kql, setKql] = useState(
    `traces\n| where timestamp > ago(1h)\n| where severityLevel >= 2\n| project timestamp, message, cloud_RoleName, severityLevel\n| order by timestamp desc\n| take 100`
  );
  const [results, setResults] = useState<LogEntry[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const { data: savedQueries, isLoading: sqLoading, refresh: refreshSaved } =
    useDebugger<SavedQuery[]>('/debug/logs/saved-queries');

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSaved();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const parseTimeRangeToHours = (range: string): number => {
    const match = range.match(/^(\d+)(h|d)$/);
    if (!match) return 24;
    const value = parseInt(match[1], 10);
    return match[2] === 'd' ? value * 24 : value;
  };

  const executeQuery = useCallback(async () => {
    if (!kql.trim()) return;
    setIsQuerying(true);
    setQueryError(null);
    try {
      const response = await debuggerClient.post<LogEntry[]>('/debug/logs/query', {
        query: kql,
        timespan_hours: parseTimeRangeToHours(timeRange),
      });
      setResults(response.data);
    } catch (err: any) {
      setQueryError(err.message || 'Query failed');
      setResults(null);
    } finally {
      setIsQuerying(false);
    }
  }, [kql, timeRange]);

  const loadSavedQuery = (query: SavedQuery) => {
    setKql(query.query);
    setShowSaved(false);
  };

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error':
      case '3':
      case '4':
        return 'text-status-error';
      case 'warning':
      case '2':
        return 'text-status-warning';
      case 'information':
      case '1':
        return 'text-brand-blue';
      default:
        return 'text-text-muted';
    }
  };

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Log Explorer"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* KQL Editor */}
          <Card
            title="KQL Query"
            subtitle="Execute Kusto queries against App Insights"
            action={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSaved(!showSaved)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sds-200 bg-surface-tertiary text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border transition-colors"
                >
                  <BookOpen size={14} />
                  Saved Queries
                </button>
                <button
                  onClick={executeQuery}
                  disabled={isQuerying || !kql.trim()}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-sds-200 transition-colors',
                    'bg-brand-blue text-white hover:bg-brand-blue/90',
                    (isQuerying || !kql.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isQuerying ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Run Query
                </button>
              </div>
            }
          >
            <textarea
              value={kql}
              onChange={(e) => setKql(e.target.value)}
              className="w-full h-32 bg-surface-secondary border border-border-subtle rounded-lg p-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 resize-y"
              placeholder="Enter KQL query..."
              spellCheck={false}
            />
            {queryError && (
              <div className="mt-2 p-3 bg-status-error/5 border border-status-error/20 rounded-lg">
                <p className="text-sm text-status-error font-mono">{queryError}</p>
              </div>
            )}
          </Card>

          {/* Saved Queries Panel */}
          {showSaved && (
            <Card title="Saved Queries">
              <div className="space-y-2">
                {sqLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                  </div>
                ) : savedQueries && savedQueries.length > 0 ? (
                  savedQueries.map((sq, idx) => (
                    <button
                      key={`${sq.name}-${idx}`}
                      onClick={() => loadSavedQuery(sq)}
                      className="w-full flex items-center justify-between p-3 bg-surface-tertiary rounded-lg hover:bg-surface-hover transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">{sq.name}</p>
                        {sq.description && (
                          <p className="text-xs text-text-muted">{sq.description}</p>
                        )}
                        <p className="text-xs font-mono text-text-muted truncate max-w-md">{sq.query}</p>
                      </div>
                      <ChevronRight size={14} className="text-text-muted" />
                    </button>
                  ))
                ) : (
                  <p className="text-text-muted text-center py-6">No saved queries</p>
                )}
              </div>
            </Card>
          )}

          {/* Query Results */}
          {results !== null && (
            <Card
              title="Results"
              subtitle={`${results.length} row${results.length !== 1 ? 's' : ''} returned`}
            >
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                {results.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Time</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Level</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Service</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((entry, i) => (
                        <tr key={i} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                          <td className="py-2 px-3 text-text-muted text-xs font-mono whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </td>
                          <td className={cn('py-2 px-3 text-xs font-medium', getLevelColor(entry.level))}>
                            {entry.level}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            <span className="px-2 py-0.5 bg-brand-blue/10 text-brand-blue rounded font-medium">
                              {entry.service}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-text-secondary font-mono text-xs max-w-lg truncate">
                            {entry.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-text-muted text-center py-8">Query returned no results</p>
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <LogsContent />
    </Suspense>
  );
}
