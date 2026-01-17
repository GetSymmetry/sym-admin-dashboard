'use client';

import { cn } from '@/lib/utils';
import { StatusBadge } from '../ui/StatusBadge';
import { Server, CheckCircle, XCircle } from 'lucide-react';

interface Service {
  name: string;
  status: string;
}

interface ServiceStatusProps {
  services: Service[];
  className?: string;
}

export function ServiceStatus({ services, className }: ServiceStatusProps) {
  const healthyCount = services.filter(
    (s) => s.status === 'healthy' || s.status === 'Running'
  ).length;
  const totalCount = services.length;
  const allHealthy = healthyCount === totalCount;

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
          <div className={cn(
            'p-2 rounded-sds-200',
            allHealthy ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'
          )}>
            <Server size={18} />
          </div>
          <div>
            <h3 className="text-body-small font-medium text-text-primary">Services</h3>
            <p className="text-body-xs text-text-muted">
              {healthyCount}/{totalCount} healthy
            </p>
          </div>
        </div>
        <StatusBadge
          status={allHealthy ? 'healthy' : 'warning'}
          pulse={!allHealthy}
        />
      </div>

      {/* Service List */}
      <div className="p-2">
        {services.map((service) => {
          const isHealthy = service.status === 'healthy' || service.status === 'Running';
          return (
            <div
              key={service.name}
              className="flex items-center justify-between px-3 py-2.5 rounded-sds-200 hover:bg-surface-tertiary transition-colors"
            >
              <div className="flex items-center gap-2">
                {isHealthy ? (
                  <CheckCircle size={14} className="text-status-success" />
                ) : (
                  <XCircle size={14} className="text-status-error" />
                )}
                <span className="text-body-small text-text-secondary font-mono">
                  {service.name.replace(/-sym-prod-centralus|-sym-test-centralus/g, '')}
                </span>
              </div>
              <span
                className={cn(
                  'text-body-xs font-medium',
                  isHealthy ? 'text-status-success' : 'text-status-error'
                )}
              >
                {isHealthy ? 'Running' : service.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
