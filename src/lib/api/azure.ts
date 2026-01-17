/**
 * Azure SDK operations for App Insights, Service Bus, and App Services.
 * Uses Azure SDK instead of CLI for Vercel compatibility.
 */

import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query';
import { DefaultAzureCredential, ClientSecretCredential, TokenCredential } from '@azure/identity';
import { ServiceBusAdministrationClient } from '@azure/service-bus';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { getAzureConfig, type Environment, mapServiceName } from './config';

// Singleton credential (reused across requests)
let credential: TokenCredential | null = null;

function getCredential(): TokenCredential {
  if (!credential) {
    // Use explicit ClientSecretCredential when env vars are present (required for Vercel)
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    
    if (tenantId && clientId && clientSecret) {
      credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    } else {
      // Falls back to Azure CLI auth locally, managed identity in Azure
      credential = new DefaultAzureCredential();
    }
  }
  return credential;
}

// Singleton clients per environment
const logsClients: Map<string, LogsQueryClient> = new Map();
const serviceBusClients: Map<string, ServiceBusAdministrationClient> = new Map();
const webSiteClients: Map<string, WebSiteManagementClient> = new Map();

function getLogsClient(): LogsQueryClient {
  const key = 'logs';
  if (!logsClients.has(key)) {
    logsClients.set(key, new LogsQueryClient(getCredential()));
  }
  return logsClients.get(key)!;
}

function getServiceBusClient(env: Environment): ServiceBusAdministrationClient {
  const config = getAzureConfig(env);
  const key = `sb-${env}`;
  if (!serviceBusClients.has(key)) {
    serviceBusClients.set(
      key,
      new ServiceBusAdministrationClient(
        `${config.serviceBusNamespace}.servicebus.windows.net`,
        getCredential()
      )
    );
  }
  return serviceBusClients.get(key)!;
}

function getWebSiteClient(env: Environment): WebSiteManagementClient {
  const config = getAzureConfig(env);
  const key = `web-${env}`;
  if (!webSiteClients.has(key)) {
    webSiteClients.set(
      key,
      new WebSiteManagementClient(getCredential(), config.subscriptionId)
    );
  }
  return webSiteClients.get(key)!;
}

/**
 * Query App Insights using Log Analytics SDK.
 * Uses queryResource to query the App Insights resource directly (not Log Analytics workspace).
 * @param query KQL query string
 * @param env Environment to query
 * @param durationIso ISO 8601 duration (e.g., 'P1D', 'PT24H')
 * @returns Array of rows from the query result
 */
export async function queryAppInsights(
  query: string,
  env: Environment,
  durationIso: string = 'P1D'
): Promise<unknown[][]> {
  try {
    const config = getAzureConfig(env);
    const client = getLogsClient();
    
    // Use queryResource with the App Insights resource ID (not workspace ID)
    // This gives access to App Insights tables: traces, requests, exceptions, etc.
    const result = await client.queryResource(
      config.appInsightsResourceId,
      query,
      { duration: durationIso }
    );
    
    if (result.status === LogsQueryResultStatus.Success) {
      return result.tables[0]?.rows || [];
    } else if (result.status === LogsQueryResultStatus.PartialFailure) {
      console.warn('App Insights query partial failure:', result.partialError);
      // PartialFailure still has tables in partialTables
      return result.partialTables?.[0]?.rows || [];
    }
    
    return [];
  } catch (error: unknown) {
    const err = error as Error;
    console.error('App Insights query failed:', {
      message: err?.message || 'Unknown error',
      name: err?.name,
      env,
      hasCredentials: !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET),
    });
    return [];
  }
}

export interface QueueMetrics {
  name: string;
  active: number;
  deadLetter: number;
}

/**
 * Get Service Bus queue metrics using SDK.
 */
export async function getServiceBusMetrics(env: Environment): Promise<QueueMetrics[]> {
  try {
    const client = getServiceBusClient(env);
    const queues: QueueMetrics[] = [];
    
    for await (const queue of client.listQueues()) {
      try {
        const runtime = await client.getQueueRuntimeProperties(queue.name);
        queues.push({
          name: queue.name,
          active: runtime.activeMessageCount,
          deadLetter: runtime.deadLetterMessageCount,
        });
      } catch (err) {
        console.warn(`Failed to get runtime properties for queue ${queue.name}:`, err);
      }
    }
    
    return queues;
  } catch (error) {
    console.error('Service Bus metrics failed:', error);
    return [];
  }
}

export interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  state: string;
  hostName?: string;
}

/**
 * Get App Service status using SDK.
 */
export async function getAppServiceStatus(env: Environment): Promise<ServiceStatus[]> {
  try {
    const config = getAzureConfig(env);
    const client = getWebSiteClient(env);
    const services: ServiceStatus[] = [];
    
    // List web apps in resource group
    for await (const app of client.webApps.listByResourceGroup(config.resourceGroup)) {
      // Skip staging slots
      if (app.name?.includes('staging')) continue;
      
      services.push({
        name: app.name || 'Unknown',
        displayName: mapServiceName(app.name || ''),
        status: app.state === 'Running' ? 'healthy' : 'unhealthy',
        state: app.state || 'Unknown',
        hostName: app.defaultHostName,
      });
    }
    
    return services;
  } catch (error) {
    console.error('App Service status failed:', error);
    return [];
  }
}

/**
 * Get Function App status using SDK.
 */
export async function getFunctionAppStatus(env: Environment): Promise<ServiceStatus[]> {
  try {
    const config = getAzureConfig(env);
    const client = getWebSiteClient(env);
    const functions: ServiceStatus[] = [];
    
    // Function apps are also listed via webApps API
    for await (const app of client.webApps.listByResourceGroup(config.resourceGroup)) {
      // Only include function apps (they have 'func' in name or are of kind 'functionapp')
      if (!app.name?.includes('func') && app.kind !== 'functionapp') continue;
      // Skip staging slots
      if (app.name?.includes('staging')) continue;
      
      functions.push({
        name: app.name || 'Unknown',
        displayName: mapServiceName(app.name || ''),
        status: app.state === 'Running' ? 'healthy' : 'unhealthy',
        state: app.state || 'Unknown',
        hostName: app.defaultHostName,
      });
    }
    
    return functions;
  } catch (error) {
    console.error('Function App status failed:', error);
    return [];
  }
}

/**
 * Get all services (App Services + Functions) status.
 */
export async function getAllServicesStatus(env: Environment): Promise<ServiceStatus[]> {
  const [appServices, functions] = await Promise.all([
    getAppServiceStatus(env),
    getFunctionAppStatus(env),
  ]);
  
  // Deduplicate (functions are also in webApps list)
  const seen = new Set<string>();
  const result: ServiceStatus[] = [];
  
  for (const service of [...appServices, ...functions]) {
    if (!seen.has(service.name)) {
      seen.add(service.name);
      result.push(service);
    }
  }
  
  return result;
}
