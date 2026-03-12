import { clsx } from "clsx";

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, subtitle, action, children, className }: CardProps) {
  return (
    <div className={clsx("bg-surface rounded-sds-200 border border-border p-sds-400", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-sds-300">
          <div>
            {title && <h3 className="text-heading-h3 font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-body-small text-text-secondary mt-1">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
