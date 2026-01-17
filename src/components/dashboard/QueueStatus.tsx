'use client';

import { cn } from '@/lib/utils';
import { Inbox, AlertCircle, CheckCircle } from 'lucide-react';

interface Queue {
  name: string;
  active: number;
  deadLetter: number;
}

interface QueueStatusProps {
  queues: Queue[];
  className?: string;
}

export function QueueStatus({ queues, className }: QueueStatusProps) {
  const totalActive = queues.reduce((sum, q) => sum + q.active, 0);
  const totalDeadLetter = queues.reduce((sum, q) => sum + q.deadLetter, 0);

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
            <Inbox size={18} />
          </div>
          <div>
            <h3 className="text-body-small font-medium text-text-primary">Message Queues</h3>
            <p className="text-body-xs text-text-muted">
              {totalActive} pending • {totalDeadLetter} dead letter
            </p>
          </div>
        </div>
      </div>

      {/* Queue List */}
      <div className="p-2">
        {queues.map((queue) => (
          <div
            key={queue.name}
            className="px-3 py-3 rounded-sds-200 hover:bg-surface-tertiary transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-body-small font-mono text-text-secondary">
                {queue.name}
              </span>
              {queue.deadLetter > 0 ? (
                <div className="flex items-center gap-1 text-status-error">
                  <AlertCircle size={12} />
                  <span className="text-body-xs font-medium">
                    {queue.deadLetter} DLQ
                  </span>
                </div>
              ) : (
                <CheckCircle size={14} className="text-status-success" />
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  queue.active > 100
                    ? 'bg-status-warning'
                    : queue.active > 0
                    ? 'bg-brand-blue'
                    : 'bg-text-tertiary'
                )}
                style={{
                  width: `${Math.min((queue.active / 200) * 100, 100)}%`,
                }}
              />
            </div>

            <div className="flex justify-between mt-1.5">
              <span className="text-body-xs text-text-muted">
                {queue.active} pending
              </span>
              <span className="text-body-xs text-text-muted">
                200 max
              </span>
            </div>
          </div>
        ))}

        {queues.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-text-muted text-body-small">No queues found</p>
          </div>
        )}
      </div>
    </div>
  );
}
