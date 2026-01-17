/**
 * Centralized KQL queries for App Insights.
 * All queries filter out staging slots and health probes.
 */

import { type TimeRange } from '../time';

/**
 * App Insights KQL queries.
 */
export const APP_INSIGHTS_QUERIES = {
  /**
   * HTTP requests by service (from requests table).
   * Excludes health probes and root requests.
   */
  requestsByService: (tr: TimeRange) => `
    requests 
    | where timestamp > ago(${tr.raw})
    | where name !contains '/health'
    | where name != 'GET /'
    | where name != 'GET'
    | summarize count() by cloud_RoleName
    | order by count_ desc
  `,

  /**
   * Traces by service (fallback when requests table is empty).
   * Excludes staging and export-jobs noise.
   */
  tracesByService: (tr: TimeRange) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where message !contains 'export-jobs'
    | where message !contains 'staging'
    | extend app = case(
        customDimensions.app_name != '', tostring(customDimensions.app_name),
        cloud_RoleName != '', cloud_RoleName,
        'Unknown'
      )
    | where app != 'Unknown' or severityLevel >= 2
    | summarize count() by app
    | where count_ > 10
    | order by count_ desc
  `,

  /**
   * Error count (severity >= 3 = Warning and above).
   */
  errorCount: (tr: TimeRange) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where severityLevel >= 3
    | where message !contains 'export-jobs'
    | where message !contains 'staging'
    | summarize total=count()
  `,

  /**
   * LLM metrics from custom events.
   */
  llmMetrics: (tr: TimeRange) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where customDimensions.event_type == "llm_request_complete"
    | extend 
        tokens = toint(customDimensions.total_tokens),
        cost = todouble(customDimensions.estimated_cost_usd),
        model = tostring(customDimensions.model)
    | summarize 
        TotalCalls = count(),
        TotalTokens = sum(tokens),
        TotalCost = sum(cost) 
      by model
  `,

  /**
   * Recent errors (last hour, for error list).
   */
  recentErrors: (limit: number = 10) => `
    traces 
    | where timestamp > ago(1h)
    | where severityLevel >= 3
    | where message !contains 'export-jobs'
    | where message !contains 'staging'
    | extend 
        app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown'),
        path = tostring(customDimensions.path)
    | project timestamp, message, app, path
    | order by timestamp desc
    | take ${limit}
  `,

  /**
   * Performance by endpoint (from traces with Response: logs).
   * Normalizes UUIDs in paths, excludes OPTIONS requests.
   */
  performanceByEndpoint: (tr: TimeRange, limit: number = 10) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where message contains 'Response:'
    | extend 
        path = tostring(customDimensions.path),
        method = tostring(customDimensions.method),
        duration = todouble(customDimensions.process_time) * 1000
    | where path != '/' and path != '/health' and isnotempty(path) and method != 'OPTIONS'
    | extend normalized_path = replace_regex(path, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '{id}')
    | summarize 
        AvgMs = avg(duration),
        P95Ms = percentile(duration, 95),
        Count = count() 
      by strcat(method, ' ', normalized_path)
    | order by AvgMs desc
    | take ${limit}
  `,

  /**
   * Fallback performance from requests table.
   */
  performanceFromRequests: (tr: TimeRange, limit: number = 10) => `
    requests 
    | where timestamp > ago(${tr.raw})
    | summarize 
        AvgMs = avg(duration),
        P95Ms = percentile(duration, 95),
        Count = count() 
      by name
    | order by Count desc
    | take ${limit}
  `,

  /**
   * Errors by service (for error breakdown chart).
   */
  errorsByService: (tr: TimeRange) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where severityLevel >= 3
    | where message !contains 'export-jobs'
    | where message !contains 'staging'
    | extend app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown')
    | summarize count() by app
    | order by count_ desc
  `,

  /**
   * Error trends over time (for chart).
   */
  errorTrends: (tr: TimeRange) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where severityLevel >= 3
    | where message !contains 'export-jobs'
    | where message !contains 'staging'
    | summarize count() by bin(timestamp, 1h)
    | order by timestamp asc
  `,

  /**
   * Detailed errors list (for errors page).
   */
  detailedErrors: (tr: TimeRange, limit: number = 50) => `
    traces 
    | where timestamp > ago(${tr.raw})
    | where severityLevel >= 3
    | where message !contains 'export-jobs'
    | where message !contains 'staging'
    | extend 
        app = coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown'),
        path = tostring(customDimensions.path),
        method = tostring(customDimensions.method),
        status = tostring(customDimensions.status_code),
        correlationId = tostring(customDimensions.correlation_id)
    | project timestamp, severityLevel, message, app, path, method, status, correlationId
    | order by timestamp desc
    | take ${limit}
  `,

  /**
   * Exceptions (for critical errors).
   */
  exceptions: (tr: TimeRange, limit: number = 20) => `
    exceptions 
    | where timestamp > ago(${tr.raw})
    | project timestamp, type, outerMessage, innermostMessage, cloud_RoleName
    | order by timestamp desc
    | take ${limit}
  `,
};
