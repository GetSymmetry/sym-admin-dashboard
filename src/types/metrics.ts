/**
 * Type definitions for dashboard metrics and API responses.
 */

// ============================================================================
// Overview Metrics
// ============================================================================

export interface OverviewMetrics {
  totalRequests: number;
  totalErrors: number;
  llmCost24h: number;
  llmTokens24h: number;
  llmCalls24h: number;
  queueDepth: number;
  deadLetters: number;
}

// ============================================================================
// Service Metrics
// ============================================================================

export interface ServiceMetrics {
  service: string;
  count: number;
}

export interface ServiceStatus {
  name: string;
  displayName?: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  state?: string;
  hostName?: string;
}

// ============================================================================
// LLM Metrics
// ============================================================================

export interface LLMModelMetrics {
  model: string;
  calls: number;
  tokens: number;
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  avgLatency?: number;
  p95Latency?: number;
}

export interface LLMTotals {
  totalCalls: number;
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: string;
  inputCost: string;
  outputCost: string;
  rateLimitEvents?: number;
  totalErrors?: number;
  avgSuccessRate?: number;
}

export interface LLMOverTimeData {
  time: string;
  tokens: number;
  requests: number;
  cost: string;
}

export interface LLMMetricsResponse {
  timestamp: string;
  source: string;
  deployment: string;
  totals: LLMTotals;
  byModel: LLMModelMetrics[];
  overTime: LLMOverTimeData[];
  rateLimit?: {
    events: number;
    timeseries: Array<{ time: string; value: number }>;
  };
  errors?: Array<{ model: string; errorType: string; count: number }>;
  latency?: Array<{
    model: string;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  }>;
  topOperations?: unknown[];
}

// ============================================================================
// Queue Metrics
// ============================================================================

export interface QueueMetrics {
  name: string;
  active: number;
  deadLetter: number;
}

// ============================================================================
// Error Metrics
// ============================================================================

export interface RecentError {
  timestamp: string;
  message: string;
  service: string;
  path: string;
}

export interface DetailedError {
  timestamp: string;
  severityLevel: number;
  message: string;
  app: string;
  path: string;
  method: string;
  status: string;
  correlationId: string;
}

export interface ErrorTrend {
  timestamp: string;
  count: number;
}

export interface ErrorsByService {
  app: string;
  count: number;
}

// ============================================================================
// Performance Metrics
// ============================================================================

export interface PerformanceMetrics {
  endpoint: string;
  avgMs: number;
  p95Ms: number;
  count: number;
}

// ============================================================================
// Database Metrics
// ============================================================================

export interface EntityCounts {
  users: number;
  organizations: number;
  workspaces: number;
  knowledgeUnits: number;
  conversations: number;
  messages: number;
  totalJobs: number;
}

export interface ActivityCounts {
  newUsers: number;
  newJobs: number;
  newConversations: number;
  newMessages: number;
  newKUs: number;
}

export interface JobStats {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  byStatus: Array<{ status: string; count: number }>;
}

export interface DatabaseHealth {
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  dbSizeMb: number;
  uptimeHours: number;
  activeQueries: number;
  totalConnections: number;
  idleConnections: number;
  waitingQueries: number;
}

export interface CacheStats {
  hitRatio: number;
  hits: number;
  diskReads: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface TableStats {
  name: string;
  size: string;
  sizeMb: number;
  rowCount: number;
  deadTuples: number;
  deadTupleRatio: number;
}

export interface SlowQuery {
  query: string;
  calls: number;
  totalTimeMs: number;
  avgTimeMs: number;
  maxTimeMs: number;
  rows: number;
}

export interface IndexUsage {
  table: string;
  index: string;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  size: string;
}

export interface DatabaseMetricsResponse {
  timestamp: string;
  environment: string;
  timeRange: string;
  counts: EntityCounts;
  activity: ActivityCounts;
  jobs: JobStats;
  jobsInRange: {
    byStatus: Record<string, number>;
    total: number;
  };
  trends: {
    usersLast7Days: Array<{ date: string; count: number }>;
  };
  health: DatabaseHealth;
  connections: {
    total: number;
    byState: Array<{ state: string; count: number; maxDurationSec: number }>;
  };
  cache: CacheStats;
  operations: {
    returned: number;
    fetched: number;
    inserted: number;
    updated: number;
    deleted: number;
  };
  tables: TableStats[];
  queryStats: {
    totalQueryTypes: number;
    totalCalls: number;
    totalExecMinutes: number;
    avgQueryTimeMs: number;
  };
  slowQueries: SlowQuery[];
  indexes: IndexUsage[];
  locks: {
    total: number;
    byMode: Array<{ mode: string; count: number }>;
  };
}

// ============================================================================
// Main Metrics Response (Overview Page)
// ============================================================================

export interface MetricsResponse {
  timestamp: string;
  environment: string;
  overview: OverviewMetrics;
  requestsByService: ServiceMetrics[];
  llmByModel: LLMModelMetrics[];
  queues: QueueMetrics[];
  services: ServiceStatus[];
  recentErrors: RecentError[];
  performance: PerformanceMetrics[];
}

// ============================================================================
// Errors Page Response
// ============================================================================

export interface ErrorsResponse {
  timestamp: string;
  environment: string;
  timeRange: string;
  summary: {
    totalErrors: number;
    criticalErrors: number;
    warningErrors: number;
  };
  byService: ErrorsByService[];
  trends: ErrorTrend[];
  recentErrors: DetailedError[];
  exceptions: Array<{
    timestamp: string;
    type: string;
    outerMessage: string;
    innermostMessage: string;
    service: string;
  }>;
}

// ============================================================================
// Deployments Response
// ============================================================================

export interface DeploymentInfo {
  name: string;
  displayName: string;
  environment: string;
  version?: string;
  lastDeployment?: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  hostName?: string;
}

export interface DeploymentsResponse {
  timestamp: string;
  environment: string;
  services: DeploymentInfo[];
}
