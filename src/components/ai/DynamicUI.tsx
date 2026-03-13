'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ComposedChart,
  RadialBarChart,
  RadialBar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types ──

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
  label?: string;
  name?: string;
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

// Legacy chart types (backward compat)
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

// Universal chart type
interface ChartSeries {
  dataKey: string;
  name?: string;
  color?: string;
  chartType?: 'line' | 'area' | 'bar' | 'scatter';
  yAxisId?: string;
  type?: string; // e.g. "monotone"
  stackId?: string;
}

interface ChartReferenceLine {
  x?: number | string;
  y?: number | string;
  label?: string;
  stroke?: string;
  strokeDasharray?: string;
}

interface UniversalChartComponent {
  type: 'chart';
  chartType: 'line' | 'area' | 'bar' | 'pie' | 'radar' | 'scatter' | 'composed' | 'radialBar';
  title?: string;
  data: ChartData[];
  series?: ChartSeries[];
  xAxisKey?: string;
  yAxisLabel?: string;
  dualYAxis?: boolean;
  stacked?: boolean;
  referenceLines?: ChartReferenceLine[];
  // Pie-specific
  nameKey?: string;
  valueKey?: string;
  // Radar-specific
  angleKey?: string;
}

type UIComponent =
  | MarkdownComponent
  | MetricComponent
  | TableComponent
  | BarChartComponent
  | AreaChartComponent
  | PieChartComponent
  | StatGridComponent
  | UniversalChartComponent;

// SDS-compliant colors
const COLORS = ['#4077ed', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

const CHART_STYLE = {
  grid: { stroke: '#e5e5e5', strokeDasharray: '3 3' },
  axis: { fill: '#757575', fontSize: 12 },
  axisLine: { stroke: '#d9d9d9' },
  tooltip: {
    backgroundColor: '#ffffff',
    border: '1px solid #d9d9d9',
    borderRadius: '8px',
    boxShadow: '0px 4px 24px rgba(0, 0, 0, 0.16)',
  },
};

// ── Markdown Renderer ──

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

// ── Metric Renderer ──

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
          {isPositive ? '\u2191' : isNegative ? '\u2193' : ''} {Math.abs(change).toFixed(1)}%
          {changeLabel && <span className="text-text-muted ml-1">{changeLabel}</span>}
        </div>
      )}
    </Card>
  );
}

// ── Table Renderer ──

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
                  {col.label || col.name || col.key}
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

// ── Stat Grid Renderer ──

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

// ── Legacy Chart Renderers (backward compat → delegate to universal) ──

function LegacyBarChartRenderer({ title, data, xKey, yKey, color = '#4077ed' }: BarChartComponent) {
  return (
    <UniversalChartRenderer
      type="chart"
      chartType="bar"
      title={title}
      data={data}
      xAxisKey={xKey}
      series={[{ dataKey: yKey, name: yKey, color }]}
    />
  );
}

function LegacyAreaChartRenderer({ title, data, xKey, yKey, color = '#22c55e' }: AreaChartComponent) {
  return (
    <UniversalChartRenderer
      type="chart"
      chartType="area"
      title={title}
      data={data}
      xAxisKey={xKey}
      series={[{ dataKey: yKey, name: yKey, color }]}
    />
  );
}

function LegacyPieChartRenderer({ title, data, nameKey, valueKey }: PieChartComponent) {
  return (
    <UniversalChartRenderer
      type="chart"
      chartType="pie"
      title={title}
      data={data}
      nameKey={nameKey}
      valueKey={valueKey}
    />
  );
}

// ── Universal Chart Renderer ──

function UniversalChartRenderer({
  chartType,
  title,
  data,
  series = [],
  xAxisKey,
  yAxisLabel,
  dualYAxis,
  stacked,
  referenceLines = [],
  nameKey,
  valueKey,
  angleKey,
}: UniversalChartComponent) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4">
        {title && <h3 className="text-text-primary font-semibold mb-3">{title}</h3>}
        <div className="h-64 flex items-center justify-center text-text-muted">No data available</div>
      </Card>
    );
  }

  // Auto-detect series if not provided
  const effectiveSeries: ChartSeries[] = series.length > 0
    ? series
    : (() => {
        const keys = Object.keys(data[0]).filter(k => k !== xAxisKey && k !== nameKey && k !== angleKey && typeof data[0][k] === 'number');
        return keys.map((key, i) => ({
          dataKey: key,
          name: key,
          color: COLORS[i % COLORS.length],
        }));
      })();

  const renderReferenceLines = () =>
    referenceLines.map((rl, i) => (
      <ReferenceLine
        key={`ref-${i}`}
        x={rl.x}
        y={rl.y}
        label={rl.label}
        stroke={rl.stroke || '#ef4444'}
        strokeDasharray={rl.strokeDasharray || '5 5'}
      />
    ));

  const commonAxisProps = {
    xAxis: (
      <XAxis
        dataKey={xAxisKey}
        tick={CHART_STYLE.axis}
        axisLine={CHART_STYLE.axisLine}
      />
    ),
    yAxisLeft: (
      <YAxis
        yAxisId={dualYAxis ? 'left' : undefined}
        tick={CHART_STYLE.axis}
        axisLine={CHART_STYLE.axisLine}
        label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#757575' } : undefined}
      />
    ),
    yAxisRight: dualYAxis ? (
      <YAxis
        yAxisId="right"
        orientation="right"
        tick={CHART_STYLE.axis}
        axisLine={CHART_STYLE.axisLine}
      />
    ) : null,
    grid: <CartesianGrid {...CHART_STYLE.grid} />,
    tooltip: <Tooltip contentStyle={CHART_STYLE.tooltip} labelStyle={{ color: '#1e1e1e' }} />,
    legend: <Legend wrapperStyle={{ color: '#5a5a5a' }} formatter={(value: string) => <span className="text-text-secondary">{value}</span>} />,
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxisLeft}
            {commonAxisProps.yAxisRight}
            {commonAxisProps.tooltip}
            {effectiveSeries.length > 1 && commonAxisProps.legend}
            {effectiveSeries.map((s, i) => (
              <Line
                key={s.dataKey}
                type={(s.type || 'monotone') as any}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                stroke={s.color || COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                yAxisId={s.yAxisId || (dualYAxis ? 'left' : undefined)}
              />
            ))}
            {renderReferenceLines()}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {effectiveSeries.map((s, i) => {
                const color = s.color || COLORS[i % COLORS.length];
                return (
                  <linearGradient key={`grad-${s.dataKey}`} id={`gradient-${s.dataKey}-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxisLeft}
            {commonAxisProps.yAxisRight}
            {commonAxisProps.tooltip}
            {effectiveSeries.length > 1 && commonAxisProps.legend}
            {effectiveSeries.map((s, i) => {
              const color = s.color || COLORS[i % COLORS.length];
              return (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name || s.dataKey}
                  stroke={color}
                  fill={`url(#gradient-${s.dataKey}-${i})`}
                  strokeWidth={2}
                  stackId={stacked ? 'stack' : undefined}
                  yAxisId={s.yAxisId || (dualYAxis ? 'left' : undefined)}
                />
              );
            })}
            {renderReferenceLines()}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxisLeft}
            {commonAxisProps.yAxisRight}
            {commonAxisProps.tooltip}
            {effectiveSeries.length > 1 && commonAxisProps.legend}
            {effectiveSeries.map((s, i) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                fill={s.color || COLORS[i % COLORS.length]}
                radius={[4, 4, 0, 0]}
                stackId={stacked ? 'stack' : undefined}
                yAxisId={s.yAxisId || (dualYAxis ? 'left' : undefined)}
              />
            ))}
            {renderReferenceLines()}
          </BarChart>
        );

      case 'pie': {
        const effectiveNameKey = nameKey || (xAxisKey ?? 'name');
        const effectiveValueKey = valueKey || effectiveSeries[0]?.dataKey || 'value';
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={effectiveValueKey}
              nameKey={effectiveNameKey}
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
            <Tooltip contentStyle={CHART_STYLE.tooltip} />
            {commonAxisProps.legend}
          </PieChart>
        );
      }

      case 'radar': {
        const effectiveAngleKey = angleKey || xAxisKey || 'metric';
        return (
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="80%">
            <PolarGrid stroke="#d9d9d9" />
            <PolarAngleAxis dataKey={effectiveAngleKey} tick={CHART_STYLE.axis} />
            <PolarRadiusAxis tick={CHART_STYLE.axis} />
            {effectiveSeries.map((s, i) => (
              <Radar
                key={s.dataKey}
                name={s.name || s.dataKey}
                dataKey={s.dataKey}
                stroke={s.color || COLORS[i % COLORS.length]}
                fill={s.color || COLORS[i % COLORS.length]}
                fillOpacity={0.2}
              />
            ))}
            {commonAxisProps.legend}
            <Tooltip contentStyle={CHART_STYLE.tooltip} />
          </RadarChart>
        );
      }

      case 'scatter': {
        // ScatterChart axes MUST have type="number" — without it Recharts
        // defaults to category mode which breaks scatter plots.
        const xDataKey = effectiveSeries[0]?.dataKey || xAxisKey || 'x';
        const yDataKey = effectiveSeries[1]?.dataKey || effectiveSeries[0]?.dataKey || 'y';
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {commonAxisProps.grid}
            <XAxis
              type="number"
              dataKey={xDataKey}
              name={effectiveSeries[0]?.name || xDataKey}
              tick={CHART_STYLE.axis}
              axisLine={CHART_STYLE.axisLine}
            />
            <YAxis
              type="number"
              dataKey={yDataKey}
              name={effectiveSeries[1]?.name || yDataKey}
              tick={CHART_STYLE.axis}
              axisLine={CHART_STYLE.axisLine}
            />
            {commonAxisProps.tooltip}
            <Scatter
              name={effectiveSeries[0]?.name || 'Data'}
              data={data}
              fill={effectiveSeries[0]?.color || COLORS[0]}
            />
          </ScatterChart>
        );
      }

      case 'composed':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxisLeft}
            {commonAxisProps.yAxisRight}
            {commonAxisProps.tooltip}
            {commonAxisProps.legend}
            {effectiveSeries.map((s, i) => {
              const color = s.color || COLORS[i % COLORS.length];
              const yAxisId = s.yAxisId || (dualYAxis ? 'left' : undefined);
              switch (s.chartType) {
                case 'line':
                  return <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name || s.dataKey} stroke={color} strokeWidth={2} dot={false} yAxisId={yAxisId} />;
                case 'area':
                  return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name || s.dataKey} stroke={color} fill={color} fillOpacity={0.1} yAxisId={yAxisId} />;
                case 'scatter':
                  return <Scatter key={s.dataKey} dataKey={s.dataKey} name={s.name || s.dataKey} fill={color} />;
                case 'bar':
                default:
                  return <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name || s.dataKey} fill={color} radius={[4, 4, 0, 0]} stackId={stacked ? 'stack' : undefined} yAxisId={yAxisId} />;
              }
            })}
            {renderReferenceLines()}
          </ComposedChart>
        );

      case 'radialBar':
        return (
          <RadialBarChart
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="30%"
            outerRadius="90%"
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              dataKey={effectiveSeries[0]?.dataKey || valueKey || 'value'}
              background={{ fill: '#f0f0f0' }}
              cornerRadius={4}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </RadialBar>
            {commonAxisProps.legend}
            <Tooltip contentStyle={CHART_STYLE.tooltip} />
          </RadialBarChart>
        );

      default:
        return (
          <div className="h-64 flex items-center justify-center text-text-muted">
            Unsupported chart type: {chartType}
          </div>
        );
    }
  };

  return (
    <Card className="p-4">
      {title && <h3 className="text-text-primary font-semibold mb-3">{title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Main Dynamic UI Component ──

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
          case 'stat_grid':
            return <StatGridRenderer key={index} {...component} />;
          // Universal chart type
          case 'chart':
            return <UniversalChartRenderer key={index} {...component} />;
          // Legacy chart types (backward compat)
          case 'bar_chart':
            return <LegacyBarChartRenderer key={index} {...component} />;
          case 'area_chart':
            return <LegacyAreaChartRenderer key={index} {...component} />;
          case 'pie_chart':
            return <LegacyPieChartRenderer key={index} {...component} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
