import { clsx } from "clsx";

type Status = "healthy" | "warning" | "error" | "unknown" | "pending" | "processing" | "completed" | "failed";

const statusStyles: Record<Status, string> = {
  healthy: "bg-status-success-light text-status-success",
  completed: "bg-status-success-light text-status-success",
  warning: "bg-status-warning-light text-status-warning",
  pending: "bg-status-warning-light text-status-warning",
  processing: "bg-status-info-light text-status-info",
  error: "bg-status-error-light text-status-error",
  failed: "bg-status-error-light text-status-error",
  unknown: "bg-surface-secondary text-text-muted",
};

export interface StatusBadgeProps {
  status: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, pulse, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as Status;
  const style = statusStyles[normalizedStatus] || statusStyles.unknown;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-body-small font-medium", style, className)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {status}
    </span>
  );
}
