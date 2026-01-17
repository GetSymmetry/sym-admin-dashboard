'use client';

import { cn } from '@/lib/utils';

interface GaugeProps {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  thresholds?: { value: number; color: string }[];
  size?: 'sm' | 'md' | 'lg' | number;
  color?: string;
  className?: string;
}

export function Gauge({
  value,
  max = 100,
  label,
  unit = '%',
  thresholds = [
    { value: 80, color: '#ef4444' },  // error
    { value: 60, color: '#f59e0b' },  // warning
    { value: 0, color: '#22c55e' },   // success
  ],
  size = 'md',
  color: customColor,
  className,
}: GaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);

  // Use custom color if provided, otherwise use thresholds
  const color = customColor || thresholds
    .sort((a, b) => b.value - a.value)
    .find((t) => percentage >= t.value)?.color || '#22c55e';

  const sizeConfig = {
    sm: { width: 80, stroke: 6, fontSize: 'text-lg' },
    md: { width: 120, stroke: 8, fontSize: 'text-2xl' },
    lg: { width: 160, stroke: 10, fontSize: 'text-3xl' },
  };

  // Handle numeric size
  const numericSize = typeof size === 'number' ? size : null;
  const { width, stroke, fontSize } = numericSize
    ? {
        width: numericSize,
        stroke: Math.max(4, Math.floor(numericSize / 15)),
        fontSize: numericSize < 80 ? 'text-sm' : numericSize < 100 ? 'text-lg' : 'text-2xl'
      }
    : sizeConfig[size as 'sm' | 'md' | 'lg'];

  const radius = (width - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width, height: width }}>
        <svg
          width={width}
          height={width}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={stroke}
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className={cn('font-bold text-text-primary', fontSize)}>
              {value.toFixed(1)}
              {unit}
            </p>
          </div>
        </div>
      </div>
      {label && <span className="mt-2 text-sm text-text-muted">{label}</span>}
    </div>
  );
}
