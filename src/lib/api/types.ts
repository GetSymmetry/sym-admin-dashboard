/** Standard response envelope from debugger service */
export interface DebugResponse<T> {
  data: T;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  region: string;
  query_time_ms: number;
  result_count: number;
  scrubbed: boolean;
  timestamp: string;
  suggested_viz: string;
  columns: ColumnDef[];
}

export interface ColumnDef {
  key: string;
  label: string;
  type: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface TimeRange {
  from: string;
  to: string;
  label: string;
}

/** Workspace data */
export interface Workspace {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
  goal: string | null;
  member_count: number;
}

/** User counts */
export interface UserCounts {
  total_users: number;
  whitelisted_users: number;
  active_last_7d: number;
  active_last_30d: number;
}

/** Job statistics */
export interface JobStat {
  status: string;
  job_type: string;
  count: number;
  avg_duration_secs: number | null;
}

/** Service Bus queue info */
export interface QueueInfo {
  name: string;
  status: string;
  max_size_mb: number;
  requires_session: boolean;
}

export interface QueueMetrics {
  name: string;
  active_message_count: number;
  dead_letter_message_count: number;
  scheduled_message_count: number;
  total_message_count: number;
  size_in_bytes: number;
}

/** Container App info */
export interface ContainerApp {
  name: string;
  location: string;
  provisioning_state: string;
  running_status: string | null;
  latest_revision: string;
}

/** Cost data */
export interface CostEntry {
  service: string;
  cost: number;
  currency: string;
}

export interface DailyCost {
  cost: number;
  date: string;
}

/** Error cluster */
export interface ErrorCluster {
  problemId: string;
  type: string;
  outerMessage: string;
  cloud_RoleName: string;
  count_: number;
  earliest: string;
  latest: string;
}

/** Tool definition from /debug/tools/schema */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  path: string;
  method: string;
  suggested_viz: string;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default: any;
}
