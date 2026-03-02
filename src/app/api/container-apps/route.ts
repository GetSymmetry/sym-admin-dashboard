import { NextResponse } from 'next/server';
import {
  type Environment,
  parseTimeRange,
  getCacheKey,
  checkCache,
  setCache,
  containerAppsCache,
  listContainerApps,
  listContainerAppRevisions,
  getContainerAppMetrics,
} from '@/lib/api';
import type { ContainerAppsResponse } from '@/types/metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const range = searchParams.get('range') || '1h';
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = getCacheKey(env, `container-apps-${range}`);
  const cached = checkCache<ContainerAppsResponse>(containerAppsCache, cacheKey, forceRefresh);
  if (cached) return NextResponse.json(cached);

  try {
    const timeRange = parseTimeRange(range);
    const metricsTimespan = `PT${Math.max(1, Math.round(timeRange.hours))}H`;

    // List all container apps
    const apps = await listContainerApps(env);

    // For each app, get metrics and recent revisions in parallel
    const enrichedApps = await Promise.all(
      apps.map(async (app) => {
        const [metrics, revisions] = await Promise.all([
          getContainerAppMetrics(env, app.name, metricsTimespan),
          listContainerAppRevisions(env, app.name, 5),
        ]);
        return {
          ...app,
          metrics,
          recentRevisions: revisions,
        };
      })
    );

    const data: ContainerAppsResponse = {
      timestamp: new Date().toISOString(),
      environment: env,
      apps: enrichedApps,
      summary: {
        totalApps: enrichedApps.length,
        runningApps: enrichedApps.filter(a => a.provisioningState === 'Succeeded').length,
        totalReplicas: enrichedApps.reduce((sum, a) => sum + a.metrics.replicaCount, 0),
        totalRestarts: enrichedApps.reduce((sum, a) => sum + a.metrics.restartCount, 0),
      },
    };

    setCache(containerAppsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch container apps:', error);
    return NextResponse.json({ error: 'Failed to fetch container apps' }, { status: 500 });
  }
}
