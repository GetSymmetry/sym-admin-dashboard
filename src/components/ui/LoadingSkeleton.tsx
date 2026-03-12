import { clsx } from "clsx";

interface SkeletonProps { className?: string }

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx("animate-pulse bg-surface-secondary rounded-sds-100", className)} />;
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-surface rounded-sds-200 border border-border p-sds-400">
      <Skeleton className="h-4 w-24 mb-sds-200" />
      <Skeleton className="h-8 w-16 mb-sds-100" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-sds-200 border border-border p-sds-400">
      <Skeleton className="h-5 w-32 mb-sds-300" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
