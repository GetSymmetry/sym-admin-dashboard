'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// UI Component Types
interface MarkdownComponent {
  type: 'markdown';
  content: string;
}

interface MetricComponent {
  type: 'metric';
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
}

interface TableColumn {
  key: string;
  label: string;
}

interface TableComponent {
  type: 'table';
  title?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

interface ChartData {
  [key: string]: unknown;
}

interface BarChartComponent {
  type: 'bar_chart';
  title?: string;
  data: ChartData[];
  xKey: string;
  yKey: string;
  color?: string;
}

interface AreaChartComponent {
  type: 'area_chart';
  title?: string;
  data: ChartData[];
  xKey: string;
  yKey: string;
  color?: string;
}

interface PieChartComponent {
  type: 'pie_chart';
  title?: string;
  data: ChartData[];
  nameKey: string;
  valueKey: string;
}

interface StatGridStat {
  label: string;
  value: number | string;
  change?: number;
}

interface StatGridComponent {
  type: 'stat_grid';
  stats: StatGridStat[];
}

type UIComponent =
  | MarkdownComponent
  | MetricComponent
  | TableComponent
  | BarChartComponent
  | AreaChartComponent
  | PieChartComponent
  | StatGridComponent;

// SDS-compliant colors
const COLORS = ['#4077ed', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];

// Markdown Renderer with GFM support (tables, strikethrough, etc.)
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-text-primary mb-3 mt-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-text-primary mb-2 mt-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-md font-medium text-text-primary mb-1 mt-2">{children}</h3>,
          p: ({ children }) => <p className="text-text-secondary mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside text-text-secondary mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-text-secondary mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-text-secondary">{children}</li>,
          strong: ({ children }) => <strong className="text-text-primary font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-text-secondary italic">{children}</em>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <code className="block bg-surface-tertiary p-3 rounded-lg overflow-x-auto text-sm text-text-primary">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-surface-tertiary px-1.5 py-0.5 rounded text-brand-blue text-sm">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-surface-tertiary rounded-lg overflow-x-auto mb-3 text-sm">{children}</pre>
          ),
          // GFM Table support
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4 rounded-lg border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-background-secondary">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border-subtle last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="text-left text-text-secondary font-semibold py-2 px-3">{children}</th>
          ),
          td: ({ children }) => (
            <td className="text-text-secondary py-2 px-3">{children}</td>
          ),
          a: ({ children, href }) => (
            <a href={href} className="text-brand-blue hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-brand-blue pl-4 py-1 my-3 text-text-muted italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Metric Card Renderer
function MetricRenderer({ label, value, change, changeLabel }: MetricComponent) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="p-4">
      <div className="text-text-muted text-sm font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold text-text-primary">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {change !== undefined && (
        <div
          className={`text-sm mt-1 font-medium ${
            isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-text-muted'
          }`}
        >
          {isPositive ? '↑' : isNegative ? '↓' : ''} {Math.abs(change).toFixed(1)}%
          {changeLabel && <span className="text-text-muted ml-1">{changeLabel}</span>}
        </div>
      )}
    </Card>
  );
}

// Table Renderer
function TableRenderer({ title, columns, rows }: TableComponent) {
  return (
    <Card className="p-4">
      {title && <h3 className="text-text-primary font-semibold mb-3">{title}</h3>}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left text-text-muted font-semibold py-3 px-4 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border-subtle hover:bg-background-secondary transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="text-text-secondary py-3 px-4 break-words max-w-xs">
                    {String(row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center text-text-muted py-4">No data</div>
        )}
      </div>
    </Card>
  );
}

// Bar Chart Renderer
function BarChartRenderer({ title, data, xKey, yKey, color = '#4077ed' }: BarChartComponent) {
  return (
    <Card className="p-4">
      {title && <h3 className="text-text-primary font-semibold mb-3">{title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey={xKey}
              tick={{ fill: '#757575', fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <YAxis
              tick={{ fill: '#757575', fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                boxShadow: '0px 4px 24px rgba(0, 0, 0, 0.16)',
              }}
              labelStyle={{ color: '#1e1e1e' }}
            />
            <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Area Chart Renderer
function AreaChartRenderer({ title, data, xKey, yKey, color = '#22c55e' }: AreaChartComponent) {
  return (
    <Card className="p-4">
      {title && <h3 className="text-text-primary font-semibold mb-3">{title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey={xKey}
              tick={{ fill: '#757575', fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <YAxis
              tick={{ fill: '#757575', fontSize: 12 }}
              axisLine={{ stroke: '#d9d9d9' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                boxShadow: '0px 4px 24px rgba(0, 0, 0, 0.16)',
              }}
              labelStyle={{ color: '#1e1e1e' }}
            />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              fill={`url(#gradient-${color})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Pie Chart Renderer
function PieChartRenderer({ title, data, nameKey, valueKey }: PieChartComponent) {
  return (
    <Card className="p-4">
      {title && <h3 className="text-text-primary font-semibold mb-3">{title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#757575' }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                boxShadow: '0px 4px 24px rgba(0, 0, 0, 0.16)',
              }}
            />
            <Legend
              wrapperStyle={{ color: '#5a5a5a' }}
              formatter={(value) => <span className="text-text-secondary">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Stat Grid Renderer
function StatGridRenderer({ stats }: StatGridComponent) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <MetricRenderer
          key={i}
          type="metric"
          label={stat.label}
          value={stat.value}
          change={stat.change}
        />
      ))}
    </div>
  );
}

// Main Dynamic UI Component
interface DynamicUIProps {
  components: UIComponent[];
}

export function DynamicUI({ components }: DynamicUIProps) {
  if (!components || components.length === 0) return null;

  return (
    <div className="space-y-4">
      {components.map((component, index) => {
        switch (component.type) {
          case 'markdown':
            return <MarkdownRenderer key={index} content={component.content} />;
          case 'metric':
            return <MetricRenderer key={index} {...component} />;
          case 'table':
            return <TableRenderer key={index} {...component} />;
          case 'bar_chart':
            return <BarChartRenderer key={index} {...component} />;
          case 'area_chart':
            return <AreaChartRenderer key={index} {...component} />;
          case 'pie_chart':
            return <PieChartRenderer key={index} {...component} />;
          case 'stat_grid':
            return <StatGridRenderer key={index} {...component} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
