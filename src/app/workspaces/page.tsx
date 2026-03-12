'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { cn, timeAgo } from '@/lib/utils';
import type { Workspace, PaginatedData } from '@/lib/api/types';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Briefcase,
  Building,
} from 'lucide-react';

/* ── Content ── */

function WorkspacesContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refresh } =
    useDebugger<PaginatedData<Workspace>>('/debug/workspaces', {
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search ? { search } : {}),
    });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refresh();
  };

  const workspaces = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Workspaces"
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
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Total Workspaces"
              value={total}
              icon={Briefcase}
              iconColor="text-brand-blue"
            />
            <MetricCard
              title="Showing"
              value={`${workspaces.length} of ${total}`}
              format="raw"
              icon={Users}
              iconColor="text-brand-blue"
            />
            <MetricCard
              title="Page"
              value={`${page} / ${totalPages || 1}`}
              format="raw"
              icon={Building}
              iconColor="text-brand-blue"
            />
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workspaces by name or ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-brand-blue/90 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Workspace List */}
          <Card>
            {isLoading && workspaces.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
              </div>
            ) : workspaces.length > 0 ? (
              <div className="space-y-2">
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={`/workspaces/${ws.id}`}
                    className="flex items-center justify-between p-4 bg-surface-tertiary rounded-lg hover:bg-surface-hover transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary truncate">{ws.name}</p>
                        <ExternalLink
                          size={12}
                          className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                        <span className="font-mono">{ws.id.substring(0, 8)}...</span>
                        <span>{ws.member_count} member{ws.member_count !== 1 ? 's' : ''}</span>
                        {ws.goal && <span className="truncate max-w-[200px]">{ws.goal}</span>}
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-xs text-text-muted">{timeAgo(ws.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-center py-12">
                {search ? 'No workspaces match your search' : 'No workspaces found'}
              </p>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border-subtle">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
                    page <= 1
                      ? 'text-text-muted cursor-not-allowed'
                      : 'text-text-secondary hover:bg-surface-tertiary'
                  )}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-sm text-text-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
                    page >= totalPages
                      ? 'text-text-muted cursor-not-allowed'
                      : 'text-text-secondary hover:bg-surface-tertiary'
                  )}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <WorkspacesContent />
    </Suspense>
  );
}
