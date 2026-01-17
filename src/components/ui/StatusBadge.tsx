'use client';

import { cn, getStatusColor, getStatusBgColor } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse = false, className }: StatusBadgeProps) {
  const pulseColorClass = (() => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'completed':
      case 'success':
      case 'succeeded':
        return 'bg-status-success';
      case 'warning':
      case 'pending':
      case 'processing':
        return 'bg-status-warning';
      case 'error':
      case 'failed':
      case 'critical':
        return 'bg-status-error';
      default:
        return 'bg-text-muted';
    }
  })();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-body-xs font-medium rounded-full border',
        getStatusBgColor(status),
        getStatusColor(status),
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              pulseColorClass
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              pulseColorClass
            )}
          />
        </span>
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
