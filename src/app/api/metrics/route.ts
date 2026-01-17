import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache by env+range for metrics (5 minute TTL)
const metricsCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Known production services (exclude staging)
const PROD_SERVICES = [
  'symmetry-backend',
  'ai-features-api', 
  'ai-convo-processor',
  'uvicorn',  // Backend/AI Features
];

async function runAzCommand(command: string): Promise<unknown> {
  try {
    const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Azure command failed: ${command}`, error);
    return null;
  }
}

async function getAppInsightsData(query: string, env: string = 'prod'): Promise<unknown> {
  const appInsights = env === 'prod' 
    ? (process.env.PROD_APP_INSIGHTS || 'ai-asp-sym-prod-centralus')
    : (process.env.TEST_APP_INSIGHTS || 'ai-asp-sym-test-centralus');
  const rg = env === 'prod'
    ? (process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus')
    : (process.env.TEST_RESOURCE_GROUP || 'rg-sym-test-centralus');
  
  const result = await runAzCommand(
    `az monitor app-insights query --app ${appInsights} --resource-group ${rg} --analytics-query "${query.replace(/"/g, '\\"')}" -o json`
  );
  
  if (result && typeof result === 'object' && 'tables' in result) {
    const tables = (result as { tables: Array<{ rows: unknown[][] }> }).tables;
    return tables[0]?.rows || [];
  }
  return [];
}

async function getServiceBusMetrics(env: string = 'prod'): Promise<unknown> {
  const namespace = env === 'prod'
    ? (process.env.PROD_SERVICE_BUS || 'sb-sym-prod-centralus')
    : (process.env.TEST_SERVICE_BUS || 'sb-sym-test-centralus');
  const rg = env === 'prod'
    ? (process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus')
    : (process.env.TEST_RESOURCE_GROUP || 'rg-sym-test-centralus');
  
  return runAzCommand(
    `az servicebus queue list --namespace-name ${namespace} --resource-group ${rg} --query "[].{name:name, active:countDetails.activeMessageCount, deadLetter:countDetails.deadLetterMessageCount}" -o json`
  );
}

async function getAppServiceStatus(env: string = 'prod'): Promise<unknown> {
  const rg = env === 'prod'
    ? (process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus')
    : (process.env.TEST_RESOURCE_GROUP || 'rg-sym-test-centralus');
  
  return runAzCommand(
    `az webapp list --resource-group ${rg} --query "[].{name:name, state:state, defaultHostName:defaultHostName}" -o json`
  );
}

async function getFunctionStatus(env: string = 'prod'): Promise<unknown> {
  const rg = env === 'prod'
    ? (process.env.PROD_RESOURCE_GROUP || 'rg-sym-prod-centralus')
    : (process.env.TEST_RESOURCE_GROUP || 'rg-sym-test-centralus');
  
  return runAzCommand(
    `az functionapp list --resource-group ${rg} --query "[].{name:name, state:state}" -o json`
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get('env') || 'prod';
  const range = searchParams.get('range') || '24h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check cache for this specific env+range combination
  const cacheKey = `${env}-${range}`;
  const cached = metricsCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Run all queries in parallel
    // IMPORTANT: Filter out staging slot data and empty app_names
    const [
      requestsFromRequests,
      requestsByService,
      errorCount,
      llmMetrics,
      serviceBusQueues,
      appServices,
      functions,
      recentErrors,
      performanceData,
      performanceAllRequests,
    ] = await Promise.all([
      // Actual HTTP requests (FILTER: exclude health probes and root requests)
      getAppInsightsData(
        `requests | where timestamp > ago(${range}) | where name !contains '/health' | where name != 'GET /' | where name != 'GET' | summarize count() by cloud_RoleName | order by count_ desc`,
        env
      ),
      // Traces by service (FILTER: only known services, exclude staging noise)
      getAppInsightsData(
        `traces | where timestamp > ago(${range}) | where message !contains 'export-jobs' | where message !contains 'staging' | extend app = case(customDimensions.app_name != '', tostring(customDimensions.app_name), cloud_RoleName != '', cloud_RoleName, 'Unknown') | where app != 'Unknown' or severityLevel >= 2 | summarize count() by app | where count_ > 10 | order by count_ desc`,
        env
      ),
      // Error count (FILTER: exclude staging errors)
      getAppInsightsData(
        `traces | where timestamp > ago(${range}) | where severityLevel >= 3 | where message !contains 'export-jobs' | where message !contains 'staging' | summarize total=count()`,
        env
      ),
      // LLM metrics
      getAppInsightsData(
        `traces | where timestamp > ago(${range}) | where customDimensions.event_type == "llm_request_complete" | extend tokens=toint(customDimensions.total_tokens), cost=todouble(customDimensions.estimated_cost_usd), model=tostring(customDimensions.model) | summarize TotalCalls=count(), TotalTokens=sum(tokens), TotalCost=sum(cost) by model`,
        env
      ),
      // Service Bus queues
      getServiceBusMetrics(env),
      // App Service status
      getAppServiceStatus(env),
      // Function status
      getFunctionStatus(env),
      // Recent errors (FILTER: exclude staging errors)
      getAppInsightsData(
        `traces | where timestamp > ago(1h) | where severityLevel >= 3 | where message !contains 'export-jobs' | where message !contains 'staging' | extend app=coalesce(tostring(customDimensions.app_name), cloud_RoleName, 'Unknown'), path=tostring(customDimensions.path) | project timestamp, message, app, path | order by timestamp desc | take 10`,
        env
      ),
      // Performance by endpoint (from TRACES with Response: logs - actual API traffic)
      // Normalize UUIDs in paths, filter out OPTIONS (CORS preflight) requests
      getAppInsightsData(
        `traces | where timestamp > ago(${range}) | where message contains 'Response:' | extend path=tostring(customDimensions.path), method=tostring(customDimensions.method), duration=todouble(customDimensions.process_time)*1000 | where path != '/' and path != '/health' and isnotempty(path) and method != 'OPTIONS' | extend normalized_path=replace_regex(path, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '{id}') | summarize AvgMs=avg(duration), P95Ms=percentile(duration, 95), Count=count() by strcat(method, ' ', normalized_path) | order by AvgMs desc | take 10`,
        env
      ),
      // Fallback: ALL requests from requests table (health probes) if no trace data
      getAppInsightsData(
        `requests | where timestamp > ago(${range}) | summarize AvgMs=avg(duration), P95Ms=percentile(duration, 95), Count=count() by name | order by Count desc | take 10`,
        env
      ),
    ]);

    // Use requests table data for service counts (more accurate than traces)
    const requestsData = Array.isArray(requestsFromRequests) 
      ? requestsFromRequests
          .filter((row: unknown[]) => row[0]) // Filter out empty names
          .map((row: unknown[]) => ({ 
            service: mapServiceName(row[0] as string), 
            count: Number(row[1]) || 0 
          }))
      : [];

    // If no requests data, fall back to filtered traces
    const traceServiceData = Array.isArray(requestsByService) 
      ? requestsByService
          .filter((row: unknown[]) => row[0] && row[0] !== 'Unknown')
          .map((row: unknown[]) => ({ 
            service: mapServiceName(row[0] as string), 
            count: Number(row[1]) || 0 
          }))
      : [];

    const finalRequestsData = requestsData.length > 0 ? requestsData : traceServiceData;

    const errorsTotal = Array.isArray(errorCount) && errorCount.length > 0 
      ? (errorCount[0] as unknown[])[0] || 0 
      : 0;

    const llmData = Array.isArray(llmMetrics)
      ? llmMetrics.map((row: unknown[]) => ({
          model: row[0] || 'Unknown',
          calls: Number(row[1]) || 0,
          tokens: Number(row[2]) || 0,
          cost: Number(row[3]) || 0,
        }))
      : [];

    const totalLLMCost = llmData.reduce((sum, m) => sum + m.cost, 0);
    const totalLLMTokens = llmData.reduce((sum, m) => sum + m.tokens, 0);
    const totalLLMCalls = llmData.reduce((sum, m) => sum + m.calls, 0);

    const queuesData = Array.isArray(serviceBusQueues)
      ? serviceBusQueues.map((q: { name: string; active: number; deadLetter: number }) => ({
          name: q.name,
          active: q.active || 0,
          deadLetter: q.deadLetter || 0,
        }))
      : [];

    // Filter out staging slots from services
    const servicesData = Array.isArray(appServices)
      ? appServices
          .filter((s: { name: string }) => !s.name.includes('staging'))
          .map((s: { name: string; state: string }) => ({
            name: mapServiceName(s.name),
            status: s.state === 'Running' ? 'healthy' : 'unhealthy',
          }))
      : [];

    // Filter out staging slots from functions
    const functionsData = Array.isArray(functions)
      ? functions
          .filter((f: { name: string }) => !f.name.includes('staging'))
          .map((f: { name: string; state: string }) => ({
            name: mapServiceName(f.name),
            status: f.state === 'Running' ? 'healthy' : 'unhealthy',
          }))
      : [];

    const errorsData = Array.isArray(recentErrors)
      ? recentErrors.map((row: unknown[]) => ({
          timestamp: row[0],
          message: (row[1] as string)?.substring(0, 100) || '',
          service: mapServiceName(row[2] as string) || 'Unknown',
          path: row[3] || '',
        }))
      : [];

    // Try non-health requests first, fall back to all requests (including health)
    const perfFromRequests = Array.isArray(performanceData)
      ? performanceData.map((row: unknown[]) => ({
          endpoint: row[0] || '',
          avgMs: Math.round(row[1] as number || 0),
          p95Ms: Math.round(row[2] as number || 0),
          count: row[3] || 0,
        }))
      : [];

    const perfFromAllRequests = Array.isArray(performanceAllRequests)
      ? performanceAllRequests.map((row: unknown[]) => ({
          endpoint: row[0] || '',
          avgMs: Math.round(row[1] as number || 0),
          p95Ms: Math.round(row[2] as number || 0),
          count: row[3] || 0,
        }))
      : [];

    // Use non-health requests if available, otherwise show all requests
    const perfData = perfFromRequests.length > 0 ? perfFromRequests : perfFromAllRequests;

    const data = {
      timestamp: new Date().toISOString(),
      environment: env,
      overview: {
        totalRequests: finalRequestsData.reduce((sum, r) => sum + (r.count || 0), 0),
        totalErrors: errorsTotal,
        llmCost24h: totalLLMCost,
        llmTokens24h: totalLLMTokens,
        llmCalls24h: totalLLMCalls,
        queueDepth: queuesData.reduce((sum, q) => sum + (q.active || 0), 0),
        deadLetters: queuesData.reduce((sum, q) => sum + (q.deadLetter || 0), 0),
      },
      requestsByService: finalRequestsData,
      llmByModel: llmData,
      queues: queuesData,
      services: [...servicesData, ...functionsData],
      recentErrors: errorsData,
      performance: perfData,
    };

    // Update cache for this env+range
    metricsCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

// Map raw service names to friendly names
function mapServiceName(rawName: string): string {
  if (!rawName) return 'Unknown';
  
  const mappings: Record<string, string> = {
    'uvicorn': 'Symmetry Backend',
    'symmetry-backend': 'Symmetry Backend',
    'asp-sym-backend-prod': 'Symmetry Backend',
    'ai-features-api': 'AI Features API',
    'asp-ai-features-prod': 'AI Features API',
    'ai-convo-processor': 'Convo Processor',
    'func-sym-processor-prod': 'Convo Processor',
  };
  
  // Check exact match
  if (mappings[rawName.toLowerCase()]) {
    return mappings[rawName.toLowerCase()];
  }
  
  // Check partial matches
  for (const [key, value] of Object.entries(mappings)) {
    if (rawName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return rawName;
}
