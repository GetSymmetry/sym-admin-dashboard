/**
 * Azure Container Apps SDK operations.
 * Lists container apps, revisions, and queries metrics via Azure Monitor.
 */

import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import { MonitorClient } from '@azure/arm-monitor';
import { ClientSecretCredential, DefaultAzureCredential, TokenCredential } from '@azure/identity';
import { getAzureConfig, type Environment, mapServiceName } from './config';

let credential: TokenCredential | null = null;

function getCredential(): TokenCredential {
  if (!credential) {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (tenantId && clientId && clientSecret) {
      credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    } else {
      credential = new DefaultAzureCredential();
    }
  }
  return credential;
}

const containerAppsClients = new Map<string, ContainerAppsAPIClient>();
const monitorClients = new Map<string, MonitorClient>();

function getContainerAppsClient(subscriptionId: string): ContainerAppsAPIClient {
  if (!containerAppsClients.has(subscriptionId)) {
    containerAppsClients.set(subscriptionId, new ContainerAppsAPIClient(getCredential(), subscriptionId));
  }
  return containerAppsClients.get(subscriptionId)!;
}

function getMonitorClient(subscriptionId: string): MonitorClient {
  if (!monitorClients.has(subscriptionId)) {
    monitorClients.set(subscriptionId, new MonitorClient(getCredential(), subscriptionId));
  }
  return monitorClients.get(subscriptionId)!;
}

export interface ContainerAppData {
  name: string;
  displayName: string;
  status: string;
  provisioningState: string;
  replicas: number;
  maxReplicas: number;
  minReplicas: number;
  cpu: number;
  memory: string;
  image: string;
  activeRevision: string;
}

export interface ContainerAppRevisionData {
  name: string;
  createdTime: string;
  runningState: string;
  trafficWeight: number;
  image: string;
  replicas: number;
  active: boolean;
}

/**
 * List all container apps in the resource group.
 */
export async function listContainerApps(env: Environment): Promise<ContainerAppData[]> {
  try {
    const config = getAzureConfig(env);
    const client = getContainerAppsClient(config.subscriptionId);
    const apps: ContainerAppData[] = [];

    for await (const app of client.containerApps.listByResourceGroup(config.resourceGroup)) {
      const containers = app.template?.containers || [];
      const firstContainer = containers[0];
      const scale = app.template?.scale;

      apps.push({
        name: app.name || 'Unknown',
        displayName: mapServiceName(app.name || ''),
        status: app.runningStatus || app.provisioningState || 'Unknown',
        provisioningState: app.provisioningState || 'Unknown',
        replicas: scale?.minReplicas || 0,
        maxReplicas: scale?.maxReplicas || 0,
        minReplicas: scale?.minReplicas || 0,
        cpu: firstContainer?.resources?.cpu || 0,
        memory: firstContainer?.resources?.memory || '0Gi',
        image: firstContainer?.image || 'unknown',
        activeRevision: app.latestRevisionName || 'unknown',
      });
    }

    return apps;
  } catch (error) {
    console.error('Failed to list container apps:', error);
    return [];
  }
}

/**
 * List revisions for a specific container app.
 */
export async function listContainerAppRevisions(
  env: Environment,
  appName: string,
  limit: number = 10
): Promise<ContainerAppRevisionData[]> {
  try {
    const config = getAzureConfig(env);
    const client = getContainerAppsClient(config.subscriptionId);
    const revisions: ContainerAppRevisionData[] = [];

    for await (const rev of client.containerAppsRevisions.listRevisions(config.resourceGroup, appName)) {
      if (revisions.length >= limit) break;

      const containers = rev.template?.containers || [];
      const firstContainer = containers[0];

      revisions.push({
        name: rev.name || 'unknown',
        createdTime: rev.createdTime?.toISOString() || 'unknown',
        runningState: rev.runningState || 'Unknown',
        trafficWeight: rev.trafficWeight || 0,
        image: firstContainer?.image || 'unknown',
        replicas: rev.replicas || 0,
        active: rev.active || false,
      });
    }

    // Sort newest first
    revisions.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());
    return revisions;
  } catch (error) {
    console.error(`Failed to list revisions for ${appName}:`, error);
    return [];
  }
}

export interface ContainerAppMetricsData {
  cpuUsage: number;
  memoryUsage: number;
  replicaCount: number;
  restartCount: number;
  requestCount: number;
}

/**
 * Get Azure Monitor metrics for a container app.
 * Queries CPU, memory, replicas, restarts, and request count.
 */
export async function getContainerAppMetrics(
  env: Environment,
  appName: string,
  timespan: string = 'PT1H'
): Promise<ContainerAppMetricsData> {
  const defaults: ContainerAppMetricsData = {
    cpuUsage: 0,
    memoryUsage: 0,
    replicaCount: 0,
    restartCount: 0,
    requestCount: 0,
  };

  try {
    const config = getAzureConfig(env);
    const client = getMonitorClient(config.subscriptionId);
    const resourceUri = `/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}/providers/Microsoft.App/containerApps/${appName}`;

    const now = new Date();
    const start = new Date(now.getTime() - parseDuration(timespan));
    const timespanStr = `${start.toISOString()}/${now.toISOString()}`;

    const result = await client.metrics.list(resourceUri, {
      timespan: timespanStr,
      interval: 'PT5M',
      metricnames: 'UsageNanoCores,WorkingSetBytes,Replicas,RestartCount,Requests',
      aggregation: 'Average,Total',
    });

    for (const metric of result.value || []) {
      const timeseries = metric.timeseries || [];
      if (timeseries.length === 0) continue;

      const dataPoints = timeseries[0].data || [];
      if (dataPoints.length === 0) continue;

      // Get the most recent non-null value
      const latest = [...dataPoints].reverse().find(d => d.average !== undefined || d.total !== undefined);
      if (!latest) continue;

      switch (metric.name?.value) {
        case 'UsageNanoCores':
          // Convert nanocores to percentage (assuming 1 core = 1e9 nanocores)
          defaults.cpuUsage = ((latest.average || 0) / 1e9) * 100;
          break;
        case 'WorkingSetBytes':
          // Convert bytes to MB
          defaults.memoryUsage = (latest.average || 0) / (1024 * 1024);
          break;
        case 'Replicas':
          defaults.replicaCount = latest.average || 0;
          break;
        case 'RestartCount':
          defaults.restartCount = latest.total || 0;
          break;
        case 'Requests':
          defaults.requestCount = latest.total || 0;
          break;
      }
    }

    return defaults;
  } catch (error) {
    console.error(`Failed to get metrics for ${appName}:`, error);
    return defaults;
  }
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(\d+)([HM])/);
  if (!match) return 60 * 60 * 1000; // default 1 hour
  const value = parseInt(match[1]);
  return match[2] === 'H' ? value * 60 * 60 * 1000 : value * 60 * 1000;
}
