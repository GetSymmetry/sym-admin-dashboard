import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache for deployment data (2 minute TTL)
let deployCache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000;

async function runAzCommand(command: string): Promise<unknown> {
  try {
    const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Azure command failed: ${command}`, error);
    return null;
  }
}

async function getAppServiceDeployments(appName: string, rg: string): Promise<unknown[]> {
  const result = await runAzCommand(
    `az webapp deployment list-publishing-credentials --name ${appName} --resource-group ${rg} --query "{publishUrl:scmUri}" -o json 2>/dev/null || echo "{}"`
  );
  
  // Get deployment history
  const history = await runAzCommand(
    `az webapp log deployment list --name ${appName} --resource-group ${rg} -o json 2>/dev/null || echo "[]"`
  );
  
  return Array.isArray(history) ? history : [];
}

async function getAppServiceConfig(appName: string, rg: string): Promise<unknown> {
  return runAzCommand(
    `az webapp config show --name ${appName} --resource-group ${rg} --query "{linuxFxVersion:linuxFxVersion, ftpsState:ftpsState, http20Enabled:http20Enabled}" -o json 2>/dev/null || echo "{}"`
  );
}

async function getFunctionAppConfig(appName: string, rg: string): Promise<unknown> {
  return runAzCommand(
    `az functionapp config show --name ${appName} --resource-group ${rg} --query "{linuxFxVersion:linuxFxVersion, use32BitWorkerProcess:use32BitWorkerProcess}" -o json 2>/dev/null || echo "{}"`
  );
}

async function getAppSettings(appName: string, rg: string, isFunction: boolean = false): Promise<unknown> {
  const cmd = isFunction ? 'functionapp' : 'webapp';
  return runAzCommand(
    `az ${cmd} config appsettings list --name ${appName} --resource-group ${rg} --query "[?name=='APP_VERSION' || name=='GIT_COMMIT' || name=='BUILD_NUMBER' || name=='DEPLOYED_AT'].{name:name, value:value}" -o json 2>/dev/null || echo "[]"`
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get('env') || 'prod';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache
  if (!forceRefresh && deployCache && Date.now() - deployCache.timestamp < CACHE_TTL) {
    return NextResponse.json(deployCache.data);
  }

  const rg = env === 'prod'
    ? (process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus')
    : (process.env.TEST_RESOURCE_GROUP || 'rg-sym-test-centralus');
  const suffix = env === 'prod' ? 'sym-prod-centralus' : 'sym-test-centralus';

  try {
    // Get all app services and functions in parallel
    const [
      backendConfig,
      backendSettings,
      aiApiConfig,
      aiApiSettings,
      convProcessorConfig,
      convProcessorSettings,
      retrievalApiConfig,
      retrievalApiSettings,
    ] = await Promise.all([
      getAppServiceConfig(`app-backend-${suffix}`, rg),
      getAppSettings(`app-backend-${suffix}`, rg),
      getAppServiceConfig(`app-ai-features-api-${suffix}`, rg),
      getAppSettings(`app-ai-features-api-${suffix}`, rg),
      getFunctionAppConfig(`func-ai-convo-processor-${suffix}`, rg),
      getAppSettings(`func-ai-convo-processor-${suffix}`, rg, true),
      getAppServiceConfig(`app-retrieval-api-${suffix}`, rg),
      getAppSettings(`app-retrieval-api-${suffix}`, rg),
    ]);

    const parseSettings = (settings: unknown): Record<string, string> => {
      if (!Array.isArray(settings)) return {};
      return settings.reduce((acc: Record<string, string>, s: { name: string; value: string }) => {
        acc[s.name] = s.value;
        return acc;
      }, {});
    };

    const services = [
      {
        name: 'Backend API',
        type: 'App Service',
        resource: `app-backend-${suffix}`,
        config: backendConfig,
        settings: parseSettings(backendSettings),
      },
      {
        name: 'AI Features API',
        type: 'App Service',
        resource: `app-ai-features-api-${suffix}`,
        config: aiApiConfig,
        settings: parseSettings(aiApiSettings),
      },
      {
        name: 'AI Convo Processor',
        type: 'Function App',
        resource: `func-ai-convo-processor-${suffix}`,
        config: convProcessorConfig,
        settings: parseSettings(convProcessorSettings),
      },
      {
        name: 'Retrieval API',
        type: 'App Service',
        resource: `app-retrieval-api-${suffix}`,
        config: retrievalApiConfig,
        settings: parseSettings(retrievalApiSettings),
      },
    ].map(service => ({
      ...service,
      version: service.settings.APP_VERSION || 'unknown',
      gitCommit: service.settings.GIT_COMMIT?.substring(0, 7) || 'unknown',
      buildNumber: service.settings.BUILD_NUMBER || 'unknown',
      deployedAt: service.settings.DEPLOYED_AT || 'unknown',
      runtime: (service.config as { linuxFxVersion?: string })?.linuxFxVersion || 'unknown',
    }));

    const data = {
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

    // Update cache
    deployCache = { data, timestamp: Date.now() };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch deployment info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployment info' },
      { status: 500 }
    );
  }
}
