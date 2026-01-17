import { NextResponse } from 'next/server';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { DefaultAzureCredential } from '@azure/identity';
import {
  type Environment,
  getCacheKey,
  checkCache,
  setCache,
  deploymentsCache,
  getAzureConfig,
  mapServiceName,
} from '@/lib/api';

// Singleton credential and client
let credential: DefaultAzureCredential | null = null;
const webSiteClients: Map<string, WebSiteManagementClient> = new Map();

function getCredential(): DefaultAzureCredential {
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  return credential;
}

function getWebSiteClient(subscriptionId: string): WebSiteManagementClient {
  if (!webSiteClients.has(subscriptionId)) {
    webSiteClients.set(subscriptionId, new WebSiteManagementClient(getCredential(), subscriptionId));
  }
  return webSiteClients.get(subscriptionId)!;
}

interface ServiceDeployment {
  name: string;
  displayName: string;
  type: 'App Service' | 'Function App';
  resource: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  state: string;
  runtime: string;
  version: string;
  gitCommit: string;
  buildNumber: string;
  deployedAt: string;
  hostName?: string;
}

interface DeploymentsData {
  timestamp: string;
  environment: string;
  services: ServiceDeployment[];
  summary: {
    totalServices: number;
    withVersionInfo: number;
    lastDeployment: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache
  const cacheKey = getCacheKey(env, 'deployments');
  const cached = checkCache<DeploymentsData>(deploymentsCache, cacheKey, forceRefresh);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const config = getAzureConfig(env);
    const client = getWebSiteClient(config.subscriptionId);
    const services: ServiceDeployment[] = [];

    // List all web apps and function apps in the resource group
    for await (const app of client.webApps.listByResourceGroup(config.resourceGroup)) {
      // Skip staging slots
      if (app.name?.includes('staging') || app.name?.includes('/')) continue;

      const isFunction = app.kind?.includes('functionapp') || app.name?.includes('func');
      
      // Get app settings for version info
      let settings: Record<string, string> = {};
      try {
        const appSettings = await client.webApps.listApplicationSettings(
          config.resourceGroup,
          app.name!
        );
        settings = appSettings.properties || {};
      } catch {
        // Settings may not be accessible
      }

      services.push({
        name: app.name || 'Unknown',
        displayName: mapServiceName(app.name || ''),
        type: isFunction ? 'Function App' : 'App Service',
        resource: app.name || '',
        status: app.state === 'Running' ? 'healthy' : 'unhealthy',
        state: app.state || 'Unknown',
        runtime: app.siteConfig?.linuxFxVersion || app.siteConfig?.windowsFxVersion || 'unknown',
        version: settings['APP_VERSION'] || 'unknown',
        gitCommit: (settings['GIT_COMMIT'] || 'unknown').substring(0, 7),
        buildNumber: settings['BUILD_NUMBER'] || 'unknown',
        deployedAt: settings['DEPLOYED_AT'] || 'unknown',
        hostName: app.defaultHostName,
      });
    }

    // Sort by display name
    services.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const data: DeploymentsData = {
      timestamp: new Date().toISOString(),
      environment: env,
      services,
      summary: {
        totalServices: services.length,
        withVersionInfo: services.filter(s => s.version !== 'unknown').length,
        lastDeployment: services
          .filter(s => s.deployedAt !== 'unknown')
          .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime())[0]?.deployedAt || 'unknown',
      },
    };

    setCache(deploymentsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch deployment info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment info' },
      { status: 500 }
    );
  }
}
