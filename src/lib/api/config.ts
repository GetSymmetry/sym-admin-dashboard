/**
 * Centralized configuration for Azure resources and database connections.
 * All values come from environment variables - no hardcoded secrets.
 */

export type Environment = 'prod' | 'test';

export interface AzureConfig {
  /** Log Analytics Workspace ID (customerId) for App Insights queries */
  workspaceId: string;
  /** Full App Insights resource ID for SDK queries */
  appInsightsResourceId: string;
  /** Azure resource group name */
  resourceGroup: string;
  /** Service Bus namespace name */
  serviceBusNamespace: string;
  /** Azure subscription ID */
  subscriptionId: string;
  /** App Insights resource name */
  appInsightsName: string;
}

export interface DatabaseConfig {
  /** Full PostgreSQL connection URL */
  connectionString: string;
}

export interface AzureOpenAIConfig {
  /** Azure OpenAI resource name */
  resourceName: string;
  /** Azure OpenAI resource group */
  resourceGroup: string;
}

/**
 * Get required env var or throw descriptive error.
 */
function requireEnv(key: string, description: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key} (${description})`);
  }
  return value;
}

/**
 * Get Azure configuration for the specified environment.
 * All values must be provided via environment variables.
 */
export function getAzureConfig(env: Environment): AzureConfig {
  const subscriptionId = requireEnv('AZURE_SUBSCRIPTION_ID', 'Azure subscription ID');
  const prefix = env === 'prod' ? 'PROD' : 'TEST';
  
  const resourceGroup = requireEnv(`${prefix}_RESOURCE_GROUP`, `${env} resource group`);
  const appInsightsName = requireEnv(`${prefix}_APP_INSIGHTS`, `${env} App Insights name`);
  const workspaceId = requireEnv(`${prefix}_APP_INSIGHTS_WORKSPACE_ID`, `${env} Log Analytics workspace ID`);
  const serviceBusNamespace = requireEnv(`${prefix}_SERVICE_BUS`, `${env} Service Bus namespace`);
  
  return {
    workspaceId,
    appInsightsResourceId: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/microsoft.insights/components/${appInsightsName}`,
    resourceGroup,
    serviceBusNamespace,
    subscriptionId,
    appInsightsName,
  };
}

/**
 * Get database configuration for the specified environment.
 * Supports both full connection URLs and individual components.
 */
export function getDatabaseConfig(env: Environment): DatabaseConfig {
  // First try full URL
  const urlEnvKey = env === 'prod' ? 'PROD_DATABASE_URL' : 'TEST_DATABASE_URL';
  const fullUrl = process.env[urlEnvKey];
  
  if (fullUrl) {
    return { connectionString: fullUrl };
  }
  
  // Fall back to constructing from individual components
  const prefix = env === 'prod' ? 'PROD' : 'TEST';
  const host = process.env[`${prefix}_DB_HOST`];
  const user = process.env[`${prefix}_DB_USER`];
  const password = process.env[`${prefix}_DB_PASSWORD`];
  const dbName = process.env[`${prefix}_DB_NAME`] || 'symmetry_main';
  const port = process.env[`${prefix}_DB_PORT`] || '5432';
  
  if (host && user && password) {
    // Construct PostgreSQL connection URL (SSL handled in pool config)
    const encodedPassword = encodeURIComponent(password);
    return {
      connectionString: `postgresql://${user}:${encodedPassword}@${host}:${port}/${dbName}`,
    };
  }
  
  console.warn(`No database configuration found for ${env} environment`);
  return { connectionString: '' };
}

/**
 * Get Azure OpenAI configuration.
 */
export function getAzureOpenAIConfig(): AzureOpenAIConfig {
  return {
    resourceName: requireEnv('AZURE_OPENAI_RESOURCE', 'Azure OpenAI resource name'),
    resourceGroup: requireEnv('AZURE_OPENAI_RG', 'Azure OpenAI resource group'),
  };
}

/**
 * LLM pricing configuration (per 1M tokens).
 */
export const LLM_PRICING = {
  input: parseFloat(process.env.LLM_INPUT_PRICE || '0.15'),
  output: parseFloat(process.env.LLM_OUTPUT_PRICE || '0.60'),
};

/**
 * Service name mappings from raw Azure names to friendly display names.
 */
export const SERVICE_NAME_MAPPINGS: Record<string, string> = {
  // Backend
  'uvicorn': 'Symmetry Backend',
  'symmetry-backend': 'Symmetry Backend',
  'asp-sym-backend-prod': 'Symmetry Backend',
  'asp-sym-backend-test': 'Symmetry Backend',
  'app-sym-backend-prod': 'Symmetry Backend',
  'app-sym-backend-test': 'Symmetry Backend',
  'app-sym-backend': 'Symmetry Backend',
  
  // AI Features API
  'ai-features-api': 'AI Features API',
  'asp-ai-features-prod': 'AI Features API',
  'asp-ai-features-test': 'AI Features API',
  'app-sym-ai-features-prod': 'AI Features API',
  'app-sym-ai-features-test': 'AI Features API',
  'app-sym-ai-features': 'AI Features API',
  'ai_features_api': 'AI Features API',
  'aifeatures': 'AI Features API',
  
  // Convo Processor (Azure Functions)
  'ai-convo-processor': 'Convo Processor',
  'func-sym-processor-prod': 'Convo Processor',
  'func-sym-processor-test': 'Convo Processor',
  'func-sym-processor': 'Convo Processor',
  'ai_convo_processor': 'Convo Processor',
  '__main__.py': 'Convo Processor', // Python Azure Functions default name
  '__main__': 'Convo Processor',
  'function_app': 'Convo Processor',
  'function_app.py': 'Convo Processor',
};

/**
 * Map raw service name to friendly display name.
 */
export function mapServiceName(rawName: string): string {
  if (!rawName) return 'Unknown';
  
  const lower = rawName.toLowerCase().trim();
  
  // Check exact match
  if (SERVICE_NAME_MAPPINGS[lower]) {
    return SERVICE_NAME_MAPPINGS[lower];
  }
  
  // Check partial matches (order matters - more specific first)
  const partialMatches = [
    { pattern: 'ai-features', name: 'AI Features API' },
    { pattern: 'ai_features', name: 'AI Features API' },
    { pattern: 'aifeatures', name: 'AI Features API' },
    { pattern: 'processor', name: 'Convo Processor' },
    { pattern: 'func-sym', name: 'Convo Processor' },
    { pattern: '__main__', name: 'Convo Processor' },
    { pattern: 'function_app', name: 'Convo Processor' },
    { pattern: 'backend', name: 'Symmetry Backend' },
    { pattern: 'uvicorn', name: 'Symmetry Backend' },
  ];
  
  for (const { pattern, name } of partialMatches) {
    if (lower.includes(pattern)) {
      return name;
    }
  }
  
  return rawName;
}

/**
 * Aggregate service metrics by mapped name.
 * Combines counts for different raw names that map to the same display name.
 */
export function aggregateServiceMetrics(
  services: Array<{ service: string; count: number }>
): Array<{ service: string; count: number }> {
  const aggregated = new Map<string, number>();
  
  for (const { service, count } of services) {
    const current = aggregated.get(service) || 0;
    aggregated.set(service, current + count);
  }
  
  return Array.from(aggregated.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);
}
