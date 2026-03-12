"use client";
import { AreaChart as RechartsArea, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface SeriesDef {
  key: string;
  color: string;
  name?: string;
}

interface AreaChartProps {
  data: Record<string, any>[];
  /** X-axis data key — accepts either xKey or xField */
  xKey?: string;
  xField?: string;
  /** Single series: yKey. Multi-series: yFields array */
  yKey?: string;
  yFields?: SeriesDef[];
  color?: string;
  height?: number;
  stacked?: boolean;
}

export function AreaChart({
  data,
  xKey,
  xField,
  yKey,
  yFields,
  color = "var(--color-chart-blue)",
  height = 300,
  stacked = false,
}: AreaChartProps) {
  const xDataKey = xKey || xField || "x";

  // Multi-series mode
  if (yFields && yFields.length > 0) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsArea data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey={xDataKey} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
          <YAxis tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
          <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
          <Legend />
          {yFields.map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name || series.key}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.1}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </RechartsArea>
      </ResponsiveContainer>
    );
  }

  // Single series mode
  const yDataKey = yKey || "y";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsArea data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey={xDataKey} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
        <Area type="monotone" dataKey={yDataKey} stroke={color} fill={color} fillOpacity={0.1} />
      </RechartsArea>
    </ResponsiveContainer>
  );
}
