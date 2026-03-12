"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { ColumnDef } from "@/lib/api/types";

interface DataTableProps {
  columns: ColumnDef[];
  data: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  pageSize?: number;
}

export function DataTable({ columns, data, onRowClick, pageSize = 20 }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-small">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)}
                  className="text-left py-2 px-3 text-text-secondary font-medium cursor-pointer hover:text-text-primary select-none">
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i} onClick={() => onRowClick?.(row)}
                className={clsx("border-b border-border/50 hover:bg-surface-secondary transition-colors", onRowClick && "cursor-pointer")}>
                {columns.map(col => (
                  <td key={col.key} className="py-2 px-3 text-text-primary">
                    {row[col.key] != null ? String(row[col.key]) : "\u2014"}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={columns.length} className="py-8 text-center text-text-muted">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-sds-300 text-body-small text-text-secondary">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 rounded-sds-100 border border-border disabled:opacity-50 hover:bg-surface-secondary">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded-sds-100 border border-border disabled:opacity-50 hover:bg-surface-secondary">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
