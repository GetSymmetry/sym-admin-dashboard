import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'completed':
    case 'success':
    case 'succeeded':
      return 'text-status-success';
    case 'warning':
    case 'pending':
    case 'processing':
      return 'text-status-warning';
    case 'error':
    case 'failed':
    case 'critical':
      return 'text-status-error';
    default:
      return 'text-text-muted';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'completed':
    case 'success':
    case 'succeeded':
      return 'bg-status-success/10 border-status-success';
    case 'warning':
    case 'pending':
    case 'processing':
      return 'bg-status-warning/10 border-status-warning';
    case 'error':
    case 'failed':
    case 'critical':
      return 'bg-status-error/10 border-status-error';
    default:
      return 'bg-surface-tertiary border-border';
  }
}
