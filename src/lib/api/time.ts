/**
 * Time range utilities for converting between different time formats.
 */

export interface TimeRange {
  /** Raw input string (e.g., '24h', '7d', '30m') */
  raw: string;
  /** Numeric hours equivalent */
  hours: number;
  /** PostgreSQL interval format (e.g., '24 hours') */
  postgresInterval: string;
  /** Azure metrics interval (e.g., 'PT1H') */
  azureInterval: string;
  /** ISO 8601 duration for Log Analytics (e.g., 'P1D') */
  isoDuration: string;
  /** Start timestamp as ISO string */
  isoStart: string;
  /** End timestamp as ISO string */
  isoEnd: string;
}

/**
 * Parse a time range string into various formats.
 * Supports: 30m, 1h, 6h, 24h, 7d, 30d
 */
export function parseTimeRange(range: string): TimeRange {
  const now = new Date();
  const match = range.match(/^(\d+)([hdm])$/);
  
  if (!match) {
    // Default to 24 hours
    return createTimeRange(24, now);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  let hours: number;
  switch (unit) {
    case 'd':
      hours = value * 24;
      break;
    case 'h':
      hours = value;
      break;
    case 'm':
      hours = value / 60;
      break;
    default:
      hours = 24;
  }
  
  return createTimeRange(hours, now);
}

function createTimeRange(hours: number, endTime: Date): TimeRange {
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
  
  // PostgreSQL interval
  let postgresInterval: string;
  if (hours >= 24 && hours % 24 === 0) {
    postgresInterval = `${hours / 24} days`;
  } else if (hours >= 1) {
    postgresInterval = `${hours} hours`;
  } else {
    postgresInterval = `${Math.round(hours * 60)} minutes`;
  }
  
  // Azure metrics interval (valid: PT1M, PT5M, PT15M, PT30M, PT1H, PT6H, PT12H, P1D)
  let azureInterval: string;
  if (hours <= 1) {
    azureInterval = 'PT5M';
  } else if (hours <= 6) {
    azureInterval = 'PT15M';
  } else if (hours <= 24) {
    azureInterval = 'PT1H';
  } else if (hours <= 72) {
    azureInterval = 'PT6H';
  } else {
    azureInterval = 'P1D';
  }
  
  // ISO 8601 duration for Log Analytics
  let isoDuration: string;
  if (hours >= 24 && hours % 24 === 0) {
    isoDuration = `P${hours / 24}D`;
  } else {
    isoDuration = `PT${hours}H`;
  }
  
  // Raw format for KQL ago() function
  let raw: string;
  if (hours >= 24 && hours % 24 === 0) {
    raw = `${hours / 24}d`;
  } else if (hours >= 1) {
    raw = `${hours}h`;
  } else {
    raw = `${Math.round(hours * 60)}m`;
  }
  
  return {
    raw,
    hours,
    postgresInterval,
    azureInterval,
    isoDuration,
    isoStart: startTime.toISOString(),
    isoEnd: endTime.toISOString(),
  };
}

/**
 * Get the KQL ago() duration string for a time range.
 * Returns format like '24h', '7d', '30m'
 */
export function toKqlAgo(range: string): string {
  return parseTimeRange(range).raw;
}

/**
 * Get PostgreSQL interval string for a time range.
 * Returns format like '24 hours', '7 days'
 */
export function toPostgresInterval(range: string): string {
  return parseTimeRange(range).postgresInterval;
}

/**
 * Get Azure metrics interval for a time range.
 * Returns format like 'PT1H', 'P1D'
 */
export function toAzureInterval(range: string): string {
  return parseTimeRange(range).azureInterval;
}

/**
 * Get hours from a time range string.
 */
export function toHours(range: string): number {
  return parseTimeRange(range).hours;
}
