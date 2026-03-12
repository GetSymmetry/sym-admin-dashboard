'use client';

import { useState, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { debuggerClient } from '@/lib/api/client';
import { cn, timeAgo } from '@/lib/utils';
import {
  Shield,
  UserPlus,
  Building,
  Trash2,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

/* ── Types ── */

interface WhitelistEntry {
  id: string;
  type: 'user' | 'organization';
  email?: string;
  organization_name?: string;
  organization_id?: string;
  whitelisted_at: string;
  whitelisted_by: string;
}

/* ── Content ── */

function AdminContent() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    region,
    setRegion,
    timeRange,
    setTimeRange,
    availableRegions,
  } = useDebuggerDashboardState();

  const { data: whitelist, isLoading: wlLoading, refresh } =
    useDebugger<WhitelistEntry[]>('/debug/admin/whitelist');

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // User whitelist form
  const [userEmail, setUserEmail] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  // Org whitelist form
  const [orgName, setOrgName] = useState('');
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const handleWhitelistUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) return;

    setUserSubmitting(true);
    setUserError(null);
    setUserSuccess(null);

    try {
      await debuggerClient.post('/debug/admin/whitelist-user', { email: userEmail.trim() });
      setUserSuccess(`Whitelisted ${userEmail}`);
      setUserEmail('');
      refresh();
    } catch (err: any) {
      setUserError(err.message || 'Failed to whitelist user');
    } finally {
      setUserSubmitting(false);
    }
  }, [userEmail, refresh]);

  const handleWhitelistOrg = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setOrgSubmitting(true);
    setOrgError(null);
    setOrgSuccess(null);

    try {
      await debuggerClient.post('/debug/admin/whitelist-org', { organization_name: orgName.trim() });
      setOrgSuccess(`Whitelisted ${orgName}`);
      setOrgName('');
      refresh();
    } catch (err: any) {
      setOrgError(err.message || 'Failed to whitelist organization');
    } finally {
      setOrgSubmitting(false);
    }
  }, [orgName, refresh]);

  // Purge queue form
  const ALLOWED_QUEUES = ['batch-jobs', 'conversation-jobs', 'knowledge-jobs', 'live-ingestion-jobs'];
  const [purgeQueue, setPurgeQueue] = useState(ALLOWED_QUEUES[0]);
  const [purgeDlq, setPurgeDlq] = useState(true);
  const [purgeSubmitting, setPurgeSubmitting] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const handlePurgeQueue = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPurgeSubmitting(true);
    setPurgeError(null);
    setPurgeResult(null);

    try {
      const res = await debuggerClient.post<{ message: string }>('/debug/admin/purge-queue', {
        queue_name: purgeQueue,
        include_dlq: purgeDlq,
      });
      setPurgeResult(res.data?.message || 'Queue purged successfully');
    } catch (err: any) {
      setPurgeError(err.message || 'Failed to purge queue');
    } finally {
      setPurgeSubmitting(false);
    }
  }, [purgeQueue, purgeDlq]);

  const userEntries = whitelist?.filter((e) => e.type === 'user') ?? [];
  const orgEntries = whitelist?.filter((e) => e.type === 'organization') ?? [];

  return (
    <div className="flex h-screen bg-surface-secondary">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        environment="prod"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Admin"
          environment="prod"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing || wlLoading}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          region={region}
          onRegionChange={setRegion}
          availableRegions={availableRegions}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Whitelist Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Whitelist User */}
            <Card title="Whitelist User" subtitle="Add a user by email">
              <form onSubmit={handleWhitelistUser} className="space-y-3">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <UserPlus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={userSubmitting}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={userSubmitting || !userEmail.trim()}
                    className={cn(
                      'px-5 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      'bg-brand-blue text-white hover:bg-brand-blue/90',
                      (userSubmitting || !userEmail.trim()) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {userSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
                  </button>
                </div>
                {userSuccess && (
                  <div className="flex items-center gap-2 text-sm text-status-success">
                    <Check size={14} /> {userSuccess}
                  </div>
                )}
                {userError && (
                  <div className="flex items-center gap-2 text-sm text-status-error">
                    <X size={14} /> {userError}
                  </div>
                )}
              </form>
            </Card>

            {/* Whitelist Organization */}
            <Card title="Whitelist Organization" subtitle="Add an organization by name">
              <form onSubmit={handleWhitelistOrg} className="space-y-3">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Organization name"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={orgSubmitting}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={orgSubmitting || !orgName.trim()}
                    className={cn(
                      'px-5 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      'bg-brand-blue text-white hover:bg-brand-blue/90',
                      (orgSubmitting || !orgName.trim()) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {orgSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
                  </button>
                </div>
                {orgSuccess && (
                  <div className="flex items-center gap-2 text-sm text-status-success">
                    <Check size={14} /> {orgSuccess}
                  </div>
                )}
                {orgError && (
                  <div className="flex items-center gap-2 text-sm text-status-error">
                    <X size={14} /> {orgError}
                  </div>
                )}
              </form>
            </Card>
          </div>

          {/* Purge Queue */}
          <Card title="Purge Service Bus Queue" subtitle="Clear stuck messages from a queue">
            <form onSubmit={handlePurgeQueue} className="space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-text-muted mb-1">Queue</label>
                  <select
                    value={purgeQueue}
                    onChange={(e) => setPurgeQueue(e.target.value)}
                    disabled={purgeSubmitting}
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  >
                    {ALLOWED_QUEUES.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={purgeDlq}
                    onChange={(e) => setPurgeDlq(e.target.checked)}
                    disabled={purgeSubmitting}
                    className="rounded border-border-subtle"
                  />
                  Include dead-letter
                </label>
                <button
                  type="submit"
                  disabled={purgeSubmitting}
                  className={cn(
                    'px-5 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    'bg-status-error text-white hover:bg-status-error/90',
                    purgeSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {purgeSubmitting ? <Loader2 size={16} className="animate-spin" /> : (
                    <span className="flex items-center gap-2"><Trash2 size={14} /> Purge</span>
                  )}
                </button>
              </div>
              {purgeResult && (
                <div className="flex items-center gap-2 text-sm text-status-success">
                  <Check size={14} /> {purgeResult}
                </div>
              )}
              {purgeError && (
                <div className="flex items-center gap-2 text-sm text-status-error">
                  <AlertTriangle size={14} /> {purgeError}
                </div>
              )}
              <p className="text-xs text-text-muted">
                Drains all active and dead-letter messages. Handles session-enabled queues automatically.
              </p>
            </form>
          </Card>

          {/* Whitelisted Users */}
          <Card
            title="Whitelisted Users"
            subtitle={`${userEntries.length} user${userEntries.length !== 1 ? 's' : ''}`}
          >
            {wlLoading && userEntries.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
              </div>
            ) : userEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Email</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Added By</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                        <td className="py-2 px-3 text-text-primary">{entry.email}</td>
                        <td className="py-2 px-3 text-text-muted text-xs">{entry.whitelisted_by}</td>
                        <td className="py-2 px-3 text-right text-text-muted text-xs">{timeAgo(entry.whitelisted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">No whitelisted users</p>
            )}
          </Card>

          {/* Whitelisted Organizations */}
          <Card
            title="Whitelisted Organizations"
            subtitle={`${orgEntries.length} organization${orgEntries.length !== 1 ? 's' : ''}`}
          >
            {wlLoading && orgEntries.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
              </div>
            ) : orgEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Organization</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">ID</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Added By</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                        <td className="py-2 px-3 text-text-primary">{entry.organization_name}</td>
                        <td className="py-2 px-3 font-mono text-text-muted text-xs">{entry.organization_id?.substring(0, 8)}...</td>
                        <td className="py-2 px-3 text-text-muted text-xs">{entry.whitelisted_by}</td>
                        <td className="py-2 px-3 text-right text-text-muted text-xs">{timeAgo(entry.whitelisted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">No whitelisted organizations</p>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-surface-secondary">
          <div className="w-12 h-12 border-4 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
