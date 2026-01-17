'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  xField: string;
  yField: string;
  height?: number;
  horizontal?: boolean;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#4077ed',  // brand-blue
  '#22c55e',  // status-success
  '#f59e0b',  // status-warning
  '#ef4444',  // status-error
  '#06b6d4',  // cyan
  '#8b5cf6',  // purple
  '#ec4899',  // pink
];

export function BarChart({
  data,
  xField,
  yField,
  height = 200,
  horizontal = false,
  colors = DEFAULT_COLORS,
}: BarChartProps) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 10, left: 60, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
          <XAxis
            type="number"
            stroke="#757575"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey={xField}
            stroke="#757575"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#757575' }}
          />
          <Bar dataKey={yField} radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
        <XAxis
          dataKey={xField}
          stroke="#757575"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#757575"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: '#757575' }}
        />
        <Bar dataKey={yField} radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
