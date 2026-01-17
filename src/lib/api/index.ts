/**
 * Main API utilities export.
 * Import from '@/lib/api' for all shared utilities.
 */

// Configuration
export {
  type Environment,
  type AzureConfig,
  type DatabaseConfig,
  type AzureOpenAIConfig,
  getAzureConfig,
  getDatabaseConfig,
  getAzureOpenAIConfig,
  mapServiceName,
  aggregateServiceMetrics,
  SERVICE_NAME_MAPPINGS,
  LLM_PRICING,
} from './config';

// Time utilities
export {
  type TimeRange,
  parseTimeRange,
  toKqlAgo,
  toPostgresInterval,
  toAzureInterval,
  toHours,
} from './time';

// Cache utilities
export {
  type CacheOptions,
  createCache,
  getCacheKey,
  checkCache,
  setCache,
  metricsCache,
  databaseCache,
  llmCache,
  errorsCache,
  deploymentsCache,
} from './cache';

// Azure SDK operations
export {
  type QueueMetrics,
  type ServiceStatus,
  queryAppInsights,
  getServiceBusMetrics,
  getAppServiceStatus,
  getFunctionAppStatus,
  getAllServicesStatus,
} from './azure';

// Database operations
export {
  queryDatabase,
  queryScalar,
  queryDatabaseParallel,
  parseRows,
  closePools,
} from './database';

// Query definitions
export { APP_INSIGHTS_QUERIES, DATABASE_QUERIES } from './queries';
