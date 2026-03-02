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
  getContainerAppNames,
  getNeo4jVmName,
  BUDGET_THRESHOLDS,
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
  containerAppsCache,
  neo4jCache,
  alertsCache,
  costsCache,
} from './cache';

// Azure SDK operations
export {
  type QueueMetrics,
  type ServiceStatus,
  queryAppInsights,
  queryLogAnalytics,
  getManagementToken,
  getServiceBusMetrics,
  getAppServiceStatus,
  getFunctionAppStatus,
  getAllServicesStatus,
} from './azure';

// Container Apps operations
export {
  listContainerApps,
  listContainerAppRevisions,
  getContainerAppMetrics,
} from './azure-container-apps';

// Azure Monitor operations
export {
  listAlertRules,
  listFiredAlerts,
} from './azure-monitor';

// Database operations
export {
  queryDatabase,
  queryScalar,
  queryDatabaseParallel,
  parseRows,
  closePools,
} from './database';

// Query definitions
export { APP_INSIGHTS_QUERIES, LOG_ANALYTICS_QUERIES, DATABASE_QUERIES } from './queries';
