/**
 * Azure Monitor SDK operations for alert rules and fired alerts.
 * Uses @azure/arm-monitor for alert rule listing and REST API for fired alerts.
 */

import { MonitorClient } from '@azure/arm-monitor';
import { ClientSecretCredential, DefaultAzureCredential, TokenCredential } from '@azure/identity';
import { getAzureConfig, type Environment } from './config';

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

const monitorClients = new Map<string, MonitorClient>();

function getMonitorClient(subscriptionId: string): MonitorClient {
  if (!monitorClients.has(subscriptionId)) {
    monitorClients.set(subscriptionId, new MonitorClient(getCredential(), subscriptionId));
  }
  return monitorClients.get(subscriptionId)!;
}

export interface AlertRuleData {
  id: string;
  name: string;
  displayName: string;
  severity: number;
  enabled: boolean;
  type: 'metric' | 'log' | 'activity';
  targetResource: string;
  lastModified: string;
}

export interface FiredAlertData {
  id: string;
  name: string;
  severity: string;
  monitorCondition: string;
  firedTime: string;
  resolvedTime?: string;
  targetResource: string;
  description: string;
}

/**
 * List all alert rules (metric + scheduled query) in the resource group.
 */
export async function listAlertRules(env: Environment): Promise<AlertRuleData[]> {
  const rules: AlertRuleData[] = [];

  try {
    const config = getAzureConfig(env);
    const client = getMonitorClient(config.subscriptionId);

    // List metric alert rules
    try {
      const metricAlerts = client.metricAlerts.listByResourceGroup(config.resourceGroup);
      for await (const alert of metricAlerts) {
        rules.push({
          id: alert.id || '',
          name: alert.name || 'Unknown',
          displayName: alert.description || alert.name || 'Unknown',
          severity: alert.severity || 3,
          enabled: alert.enabled !== false,
          type: 'metric',
          targetResource: Array.isArray(alert.scopes) ? alert.scopes[0] || '' : '',
          lastModified: alert.lastUpdatedTime?.toISOString() || '',
        });
      }
    } catch (e) {
      console.warn('Failed to list metric alerts:', e);
    }

    // List scheduled query rules (log alerts)
    try {
      const queryRules = client.scheduledQueryRules.listByResourceGroup(config.resourceGroup);
      for await (const rule of queryRules) {
        // ScheduledQueryRule types vary by API version — access properties safely
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ruleAny = rule as any;
        rules.push({
          id: rule.id || '',
          name: rule.name || 'Unknown',
          displayName: (rule.description || rule.name || 'Unknown') as string,
          severity: (ruleAny.severity as number) ?? 3,
          enabled: (ruleAny.enabled as boolean) !== false,
          type: 'log',
          targetResource: (ruleAny.scopes as string[])?.[0] || (ruleAny.source as Record<string, string>)?.dataSourceId || '',
          lastModified: '',
        });
      }
    } catch (e) {
      console.warn('Failed to list scheduled query rules:', e);
    }

    // List activity log alerts
    try {
      const activityAlerts = client.activityLogAlerts.listByResourceGroup(config.resourceGroup);
      for await (const alert of activityAlerts) {
        rules.push({
          id: alert.id || '',
          name: alert.name || 'Unknown',
          displayName: alert.description || alert.name || 'Unknown',
          severity: 2,
          enabled: alert.enabled !== false,
          type: 'activity',
          targetResource: Array.isArray(alert.scopes) ? alert.scopes[0] || '' : '',
          lastModified: '',
        });
      }
    } catch (e) {
      console.warn('Failed to list activity log alerts:', e);
    }

    return rules;
  } catch (error) {
    console.error('Failed to list alert rules:', error);
    return rules;
  }
}

/**
 * List fired alerts using Azure Alerts Management REST API.
 * Uses direct REST calls since the alerts management SDK is not installed.
 */
export async function listFiredAlerts(env: Environment): Promise<FiredAlertData[]> {
  try {
    const config = getAzureConfig(env);
    const cred = getCredential();
    const token = await cred.getToken('https://management.azure.com/.default');
    if (!token) return [];

    const url = `https://management.azure.com/subscriptions/${config.subscriptionId}/providers/Microsoft.AlertsManagement/alerts?api-version=2019-05-05-preview&targetResourceGroup=${config.resourceGroup}&timeRange=1d&sortBy=startDateTime&sortOrder=desc`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.token}` },
    });

    if (!response.ok) {
      console.warn(`Fired alerts API returned ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const alerts: FiredAlertData[] = [];

    for (const alert of data.value || []) {
      const props = alert.properties || {};
      alerts.push({
        id: alert.id || '',
        name: alert.name || 'Unknown',
        severity: props.essentials?.severity || 'Sev3',
        monitorCondition: props.essentials?.monitorCondition || 'Unknown',
        firedTime: props.essentials?.startDateTime || '',
        resolvedTime: props.essentials?.monitorConditionResolvedDateTime || undefined,
        targetResource: props.essentials?.targetResource || '',
        description: props.essentials?.description || props.essentials?.alertRule || '',
      });
    }

    return alerts;
  } catch (error) {
    console.error('Failed to list fired alerts:', error);
    return [];
  }
}
