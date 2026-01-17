'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TimeRange = {
  label: string;
  value: string;
  hours: number;
};

const PRESET_RANGES: TimeRange[] = [
  { label: '15 minutes', value: '15m', hours: 0.25 },
  { label: '1 hour', value: '1h', hours: 1 },
  { label: '6 hours', value: '6h', hours: 6 },
  { label: '12 hours', value: '12h', hours: 12 },
  { label: '24 hours', value: '24h', hours: 24 },
  { label: '3 days', value: '3d', hours: 72 },
  { label: '7 days', value: '7d', hours: 168 },
  { label: '14 days', value: '14d', hours: 336 },
  { label: '30 days', value: '30d', hours: 720 },
];

interface TimeRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<'h' | 'd'>('h');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find current label
  const currentRange = PRESET_RANGES.find(r => r.value === value);
  const displayLabel = currentRange?.label || value;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (range: TimeRange) => {
    onChange(range.value);
    setIsOpen(false);
    setShowCustom(false);
  };

  const handleCustomSubmit = () => {
    if (customValue && !isNaN(Number(customValue))) {
      const newValue = `${customValue}${customUnit}`;
      onChange(newValue);
      setIsOpen(false);
      setShowCustom(false);
      setCustomValue('');
    }
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-surface border border-border',
          'text-sm text-text-secondary hover:text-text-primary',
          'hover:border-brand-blue',
          'transition-all duration-200',
          isOpen && 'border-brand-blue ring-2 ring-blue-100'
        )}
      >
        <Clock className="w-4 h-4 text-brand-blue" />
        <span className="font-medium">{displayLabel}</span>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={cn(
          'absolute top-full left-0 mt-2 z-50',
          'w-56 rounded-xl overflow-hidden',
          'bg-surface border border-border',
          'shadow-sds-400',
          'animate-in fade-in slide-in-from-top-2 duration-200'
        )}>
          {/* Preset Options */}
          {!showCustom && (
            <>
              <div className="p-2 space-y-1">
                {PRESET_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => handlePresetSelect(range)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm rounded-lg',
                      'transition-colors',
                      value === range.value
                        ? 'text-brand-blue bg-blue-50 font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Custom Option */}
              <div className="border-t border-border-light p-2">
                <button
                  onClick={() => setShowCustom(true)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm rounded-lg',
                    'text-text-secondary hover:text-text-primary',
                    'hover:bg-surface-secondary',
                    'flex items-center gap-2 transition-colors'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  Custom range...
                </button>
              </div>
            </>
          )}

          {/* Custom Input */}
          {showCustom && (
            <div className="p-3 space-y-3">
              <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                Custom Time Range
              </div>
              
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Enter value"
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm',
                    'bg-surface-secondary border border-border',
                    'text-text-primary placeholder:text-text-muted',
                    'focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-blue-100'
                  )}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as 'h' | 'd')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm',
                    'bg-surface-secondary border border-border',
                    'text-text-primary',
                    'focus:outline-none focus:border-brand-blue'
                  )}
                >
                  <option value="h">hours</option>
                  <option value="d">days</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustom(false)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                    'bg-surface-secondary text-text-secondary',
                    'hover:text-text-primary',
                    'transition-colors'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customValue}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium',
                    'bg-brand-blue text-text-inverted',
                    'hover:opacity-90 transition-opacity',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
