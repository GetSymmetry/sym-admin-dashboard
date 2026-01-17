'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-card border border-border-subtle shadow-card',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div>
            {title && (
              <h3 className="text-body-small font-medium text-text-primary">{title}</h3>
            )}
            {subtitle && (
              <p className="text-body-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
