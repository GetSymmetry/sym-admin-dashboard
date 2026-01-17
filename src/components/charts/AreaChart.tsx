'use client';

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AreaChartProps {
  data: Array<Record<string, unknown>>;
  xField: string;
  yFields: { key: string; color: string; name: string }[];
  height?: number;
  stacked?: boolean;
}

export function AreaChart({
  data,
  xField,
  yFields,
  height = 200,
  stacked = false,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {yFields.map((field) => (
            <linearGradient key={field.key} id={`gradient-${field.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={field.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={field.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
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
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value;
          }}
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
        {yFields.map((field) => (
          <Area
            key={field.key}
            type="monotone"
            dataKey={field.key}
            name={field.name}
            stroke={field.color}
            strokeWidth={2}
            fill={`url(#gradient-${field.key})`}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
