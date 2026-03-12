"use client";
import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface BarChartProps {
  data: Record<string, any>[];
  /** X-axis data key — accepts either xKey or xField */
  xKey?: string;
  xField?: string;
  /** Y-axis data key — accepts either yKey or yField */
  yKey?: string;
  yField?: string;
  color?: string;
  colors?: string[];
  height?: number;
  horizontal?: boolean;
}

export function BarChart({
  data,
  xKey,
  xField,
  yKey,
  yField,
  color = "var(--color-chart-blue)",
  colors,
  height = 300,
  horizontal = false,
}: BarChartProps) {
  const xDataKey = xKey || xField || "x";
  const yDataKey = yKey || yField || "y";

  // When colors array is provided, add fill to each data point
  const coloredData = colors
    ? data.map((d, i) => ({ ...d, fill: colors[i % colors.length] }))
    : data;

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBar data={coloredData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
          <YAxis dataKey={xDataKey} type="category" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} width={120} />
          <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
          <Bar dataKey={yDataKey} fill={color} radius={[0, 4, 4, 0]} />
        </RechartsBar>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={coloredData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey={xDataKey} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <YAxis tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
        <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
        <Bar dataKey={yDataKey} fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  );
}
