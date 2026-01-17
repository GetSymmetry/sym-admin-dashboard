'use client';

import { cn, timeAgo } from '@/lib/utils';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface Error {
  timestamp: string;
  message: string;
  service: string;
  path: string;
}

interface ErrorsListProps {
  errors: Error[];
  className?: string;
}

export function ErrorsList({ errors, className }: ErrorsListProps) {
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
          <div className="p-2 rounded-sds-200 bg-status-error/10 text-status-error">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-body-small font-medium text-text-primary">Recent Errors</h3>
            <p className="text-body-xs text-text-muted">Last hour</p>
          </div>
        </div>
        <span
          className={cn(
            'px-2.5 py-1 text-body-xs font-bold rounded-full border',
            errors.length > 0
              ? 'bg-status-error/10 text-status-error border-status-error'
              : 'bg-status-success/10 text-status-success border-status-success'
          )}
        >
          {errors.length}
        </span>
      </div>

      {/* Error List */}
      <div className="max-h-80 overflow-y-auto">
        {errors.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-status-success font-medium">No errors 🎉</p>
            <p className="text-body-xs text-text-muted mt-1">
              All systems running smoothly
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {errors.map((error, index) => (
              <div
                key={index}
                className="group px-3 py-3 rounded-sds-200 hover:bg-surface-tertiary transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-small text-text-secondary truncate font-mono">
                      {error.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-body-xs text-text-muted">
                        {error.service || 'Unknown'}
                      </span>
                      {error.path && (
                        <>
                          <span className="text-text-tertiary">•</span>
                          <span className="text-body-xs text-text-muted truncate">
                            {error.path}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-body-xs text-text-muted">
                      {timeAgo(error.timestamp)}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-text-tertiary group-hover:text-text-secondary transition-colors"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
