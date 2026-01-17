'use client';

import { cn, formatDuration } from '@/lib/utils';
import { Activity, Clock, Zap } from 'lucide-react';

interface PerformanceData {
  endpoint: string;
  avgMs: number;
  p95Ms: number;
  count: number;
}

interface PerformanceTableProps {
  data: PerformanceData[];
  className?: string;
}

export function PerformanceTable({ data, className }: PerformanceTableProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-card border border-border-subtle shadow-card overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sds-200 bg-brand-blue/10 text-brand-blue">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-body-small font-medium text-text-primary">
              Endpoint Performance
            </h3>
            <p className="text-body-xs text-text-muted">Top endpoints by latency</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="p-3 rounded-full bg-surface-tertiary mb-3">
              <Activity size={24} className="text-icon-muted" />
            </div>
            <p className="text-text-secondary text-body-small text-center">No endpoint data available</p>
            <p className="text-text-muted text-body-xs text-center mt-1">
              Only health checks detected in the last 24h
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left text-body-xs font-medium text-text-muted uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-4 py-3 text-right text-body-xs font-medium text-text-muted uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Clock size={12} />
                    Avg
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-body-xs font-medium text-text-muted uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <Zap size={12} />
                    P95
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-body-xs font-medium text-text-muted uppercase tracking-wider">
                  Calls
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.map((row, index) => {
                const avgColor =
                  row.avgMs > 1000
                    ? 'text-status-error'
                    : row.avgMs > 500
                    ? 'text-status-warning'
                    : 'text-status-success';
                const p95Color =
                  row.p95Ms > 2000
                    ? 'text-status-error'
                    : row.p95Ms > 1000
                    ? 'text-status-warning'
                    : 'text-status-success';

                return (
                  <tr
                    key={index}
                    className="hover:bg-surface-tertiary transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-body-small font-mono text-text-secondary">
                        {row.endpoint}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('text-body-small font-mono', avgColor)}>
                        {formatDuration(row.avgMs)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('text-body-small font-mono', p95Color)}>
                        {formatDuration(row.p95Ms)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-body-small font-mono text-text-muted">
                        {row.count.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
