'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  Server,
  Cpu,
  AlertTriangle,
  Rocket,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Zap,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/ai', label: 'AI Assistant', icon: Sparkles },
  { href: '/database', label: 'Database', icon: Database },
  { href: '/llm', label: 'LLM & Costs', icon: DollarSign },
  { href: '/infrastructure', label: 'Infrastructure', icon: Server },
  { href: '/jobs', label: 'Jobs & Queues', icon: Cpu },
  { href: '/errors', label: 'Errors', icon: AlertTriangle },
  { href: '/deployments', label: 'Deployments', icon: Rocket },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  environment?: 'prod' | 'test';
  onEnvironmentChange?: (env: 'prod' | 'test') => void;
}

export function Sidebar({
  collapsed = false,
  onToggle,
  environment = 'prod',
  onEnvironmentChange,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Preserve query params when navigating
  const getHrefWithParams = (href: string) => {
    const params = searchParams.toString();
    return params ? `${href}?${params}` : href;
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border-subtle bg-surface-secondary transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border-subtle">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sds-200 bg-brand-blue flex items-center justify-center">
              <Zap size={18} className="text-text-inverted" />
            </div>
            <span className="text-body-base font-semibold text-text-primary">
              Sym Admin
            </span>
          </div>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-2 rounded-sds-200 hover:bg-surface-tertiary text-icon-muted hover:text-icon transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={getHrefWithParams(item.href)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-sds-200 transition-all duration-200',
                isActive
                  ? 'bg-brand-blue/10 text-brand-blue'
                  : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
              )}
            >
              <item.icon size={20} />
              {!collapsed && (
                <span className="text-body-small font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Environment Toggle */}
      {onEnvironmentChange && (
        <div className="p-3 border-t border-border-subtle">
          {!collapsed ? (
            <div className="p-1 bg-surface-tertiary rounded-sds-200">
              <div className="flex">
                <button
                  onClick={() => onEnvironmentChange('prod')}
                  className={cn(
                    'flex-1 py-2 text-body-xs font-semibold rounded-sds-100 transition-all duration-200',
                    environment === 'prod'
                      ? 'bg-status-error/10 text-status-error'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  🔴 PROD
                </button>
                <button
                  onClick={() => onEnvironmentChange('test')}
                  className={cn(
                    'flex-1 py-2 text-body-xs font-semibold rounded-sds-100 transition-all duration-200',
                    environment === 'test'
                      ? 'bg-status-success/10 text-status-success'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  🟢 TEST
                </button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'w-10 h-10 rounded-sds-200 flex items-center justify-center text-body-small font-bold mx-auto',
                environment === 'prod'
                  ? 'bg-status-error/10 text-status-error'
                  : 'bg-status-success/10 text-status-success'
              )}
            >
              {environment === 'prod' ? 'P' : 'T'}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
