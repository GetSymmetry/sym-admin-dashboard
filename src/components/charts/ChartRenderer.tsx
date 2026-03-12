"use client";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { StackedAreaChart } from "./StackedAreaChart";
import { DataTable } from "../ui/DataTable";
import { MetricCard } from "../ui/MetricCard";
import type { ColumnDef } from "@/lib/api/types";

interface ChartRendererProps {
  data: any;
  suggestedViz: string;
  columns?: ColumnDef[];
}

export function ChartRenderer({ data, suggestedViz, columns = [] }: ChartRendererProps) {
  if (!data) return null;

  // For metric viz, render as MetricCards
  if (suggestedViz === "metric" && typeof data === "object" && !Array.isArray(data)) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-sds-300">
        {Object.entries(data).map(([key, value]) => (
          <MetricCard key={key} label={key.replace(/_/g, " ")} value={String(value)} />
        ))}
      </div>
    );
  }

  // For table viz
  if (suggestedViz === "table" && Array.isArray(data)) {
    const cols = columns.length > 0 ? columns : (data.length > 0 ? Object.keys(data[0]).map(k => ({ key: k, label: k, type: "string" })) : []);
    return <DataTable columns={cols} data={data} />;
  }

  // For area-chart
  if (suggestedViz === "area-chart" && Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0]);
    const xKey = keys.find(k => k.includes("time") || k.includes("date") || k === "timestamp") || keys[0];
    const yKey = keys.find(k => k.includes("count") || k.includes("value") || k !== xKey) || keys[1];
    return <AreaChart data={data} xKey={xKey} yKey={yKey || keys[1]} />;
  }

  // For bar-chart
  if (suggestedViz === "bar-chart" && Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0]);
    const xKey = columns[0]?.key || keys[0];
    const yKey = columns[1]?.key || keys[1];
    return <BarChart data={data} xKey={xKey} yKey={yKey} horizontal />;
  }

  // Fallback: render as table
  if (Array.isArray(data) && data.length > 0) {
    const cols = Object.keys(data[0]).map(k => ({ key: k, label: k, type: "string" }));
    return <DataTable columns={cols} data={data} />;
  }

  // Fallback: JSON
  return <pre className="text-code text-text-secondary overflow-auto p-sds-300 bg-surface-secondary rounded-sds-100">{JSON.stringify(data, null, 2)}</pre>;
}
