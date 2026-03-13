'use client';

import { useState, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { useDebugger } from '@/hooks/useDebugger';
import { useDebuggerDashboardState } from '@/hooks/useDashboardState';
import { debuggerClient } from '@/lib/api/client';
import { cn, timeAgo } from '@/lib/utils';
import {
  UserPlus,
  Globe,
  Trash2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Mail,
  AtSign,
} from 'lucide-react';

/* ── Types ── */

interface WhitelistEntry {
  id: string;
  type: 'email' | 'domain';
  value: string;
  added_by: string;
  note: string | null;
  created_at: string;
}

interface WhitelistedUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_login_at: string | null;
}

interface WhitelistData {
  entries: WhitelistEntry[];
  users: WhitelistedUser[];
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
    useDebugger<WhitelistData>('/debug/admin/whitelist');

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

  // Domain whitelist form
  const [domainValue, setDomainValue] = useState('');
  const [domainSubmitting, setDomainSubmitting] = useState(false);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleWhitelistUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) return;

    setUserSubmitting(true);
    setUserError(null);
    setUserSuccess(null);

    try {
      const res = await debuggerClient.post<{ message: string }>('/debug/admin/whitelist-user', {
        email: userEmail.trim(),
      });
      setUserSuccess(res.data?.message || `Whitelisted ${userEmail}`);
      setUserEmail('');
      refresh();
    } catch (err: any) {
      setUserError(err.message || 'Failed to whitelist user');
    } finally {
      setUserSubmitting(false);
    }
  }, [userEmail, refresh]);

  const handleWhitelistDomain = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainValue.trim()) return;

    setDomainSubmitting(true);
    setDomainError(null);
    setDomainSuccess(null);

    try {
      const res = await debuggerClient.post<{ message: string }>('/debug/admin/whitelist-domain', {
        domain: domainValue.trim(),
      });
      setDomainSuccess(res.data?.message || `Whitelisted ${domainValue}`);
      setDomainValue('');
      refresh();
    } catch (err: any) {
      setDomainError(err.message || 'Failed to whitelist domain');
    } finally {
      setDomainSubmitting(false);
    }
  }, [domainValue, refresh]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    setDeletingId(entryId);
    try {
      await debuggerClient.delete(`/debug/admin/whitelist/${entryId}`);
      refresh();
    } catch {
      // Silently fail — entry may already be deleted
    } finally {
      setDeletingId(null);
    }
  }, [refresh]);

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

  const entries = whitelist?.entries ?? [];
  const users = whitelist?.users ?? [];
  const emailEntries = entries.filter((e) => e.type === 'email');
  const domainEntries = entries.filter((e) => e.type === 'domain');

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
            <Card title="Whitelist User" subtitle="Pre-whitelist by email — works before sign-up">
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

            {/* Whitelist Domain */}
            <Card title="Whitelist Domain" subtitle="Auto-whitelist anyone with this email domain">
              <form onSubmit={handleWhitelistDomain} className="space-y-3">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      value={domainValue}
                      onChange={(e) => setDomainValue(e.target.value)}
                      placeholder="getsymmetry.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      disabled={domainSubmitting}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={domainSubmitting || !domainValue.trim()}
                    className={cn(
                      'px-5 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      'bg-brand-blue text-white hover:bg-brand-blue/90',
                      (domainSubmitting || !domainValue.trim()) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {domainSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
                  </button>
                </div>
                {domainSuccess && (
                  <div className="flex items-center gap-2 text-sm text-status-success">
                    <Check size={14} /> {domainSuccess}
                  </div>
                )}
                {domainError && (
                  <div className="flex items-center gap-2 text-sm text-status-error">
                    <X size={14} /> {domainError}
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

          {/* Whitelist Entries */}
          <Card
            title="Whitelist Entries"
            subtitle={`${entries.length} rule${entries.length !== 1 ? 's' : ''} — ${emailEntries.length} email, ${domainEntries.length} domain`}
          >
            {wlLoading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
              </div>
            ) : entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Type</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Value</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Note</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Added</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                        <td className="py-2 px-3">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                            entry.type === 'email'
                              ? 'bg-brand-blue/10 text-brand-blue'
                              : 'bg-status-success/10 text-status-success'
                          )}>
                            {entry.type === 'email' ? <Mail size={12} /> : <AtSign size={12} />}
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-text-primary font-mono text-xs">{entry.value}</td>
                        <td className="py-2 px-3 text-text-muted text-xs">{entry.note || '—'}</td>
                        <td className="py-2 px-3 text-text-muted text-xs">{timeAgo(entry.created_at)}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={deletingId === entry.id}
                            className="p-1 rounded hover:bg-status-error/10 text-text-muted hover:text-status-error transition-colors"
                            title="Remove entry"
                          >
                            {deletingId === entry.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">No whitelist entries — add an email or domain above</p>
            )}
          </Card>

          {/* Active Whitelisted Users */}
          <Card
            title="Active Whitelisted Users"
            subtitle={`${users.length} user${users.length !== 1 ? 's' : ''} with access`}
          >
            {wlLoading && users.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
              </div>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Email</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Name</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Joined</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border-subtle/50 hover:bg-surface-tertiary/50">
                        <td className="py-2 px-3 text-text-primary">{user.email}</td>
                        <td className="py-2 px-3 text-text-muted text-xs">{user.name}</td>
                        <td className="py-2 px-3 text-text-muted text-xs">{timeAgo(user.created_at)}</td>
                        <td className="py-2 px-3 text-right text-text-muted text-xs">
                          {user.last_login_at ? timeAgo(user.last_login_at) : 'never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">No whitelisted users yet</p>
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
