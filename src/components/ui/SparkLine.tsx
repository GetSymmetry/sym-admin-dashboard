"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparkLineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function SparkLine({ data, color = "var(--color-chart-blue)", height = 32 }: SparkLineProps) {
  const chartData = data.map((value, index) => ({ index, value }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
