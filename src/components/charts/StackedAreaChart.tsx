"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = [
  "var(--color-chart-blue)", "var(--color-chart-green)", "var(--color-chart-yellow)",
  "var(--color-chart-red)", "var(--color-chart-purple)", "var(--color-chart-cyan)",
];

interface StackedAreaChartProps {
  data: Record<string, any>[];
  xKey: string;
  seriesKeys: string[];
  height?: number;
}

export function StackedAreaChart({ data, xKey, seriesKeys, height = 300 }: StackedAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
        <Legend />
        {seriesKeys.map((key, i) => (
          <Area key={key} type="monotone" dataKey={key} stackId="1"
            stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
