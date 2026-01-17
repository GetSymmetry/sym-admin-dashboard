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
  'uvicorn': 'Symmetry Backend',
  'symmetry-backend': 'Symmetry Backend',
  'asp-sym-backend-prod': 'Symmetry Backend',
  'asp-sym-backend-test': 'Symmetry Backend',
  'app-sym-backend-prod': 'Symmetry Backend',
  'app-sym-backend-test': 'Symmetry Backend',
  'ai-features-api': 'AI Features API',
  'asp-ai-features-prod': 'AI Features API',
  'asp-ai-features-test': 'AI Features API',
  'app-sym-ai-features-prod': 'AI Features API',
  'app-sym-ai-features-test': 'AI Features API',
  'ai-convo-processor': 'Convo Processor',
  'func-sym-processor-prod': 'Convo Processor',
  'func-sym-processor-test': 'Convo Processor',
};

/**
 * Map raw service name to friendly display name.
 */
export function mapServiceName(rawName: string): string {
  if (!rawName) return 'Unknown';
  
  const lower = rawName.toLowerCase();
  
  // Check exact match
  if (SERVICE_NAME_MAPPINGS[lower]) {
    return SERVICE_NAME_MAPPINGS[lower];
  }
  
  // Check partial matches
  for (const [key, value] of Object.entries(SERVICE_NAME_MAPPINGS)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return rawName;
}
