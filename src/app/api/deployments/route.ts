import { NextResponse } from 'next/server';
import {
  type Environment,
  getCacheKey,
  checkCache,
  setCache,
  deploymentsCache,
  mapServiceName,
  listContainerApps,
  listContainerAppRevisions,
} from '@/lib/api';

interface RevisionDeployment {
  appName: string;
  displayName: string;
  revisionName: string;
  image: string;
  imageTag: string;
  createdTime: string;
  runningState: string;
  trafficWeight: number;
  active: boolean;
  replicas: number;
}

interface DeploymentsData {
  timestamp: string;
  environment: string;
  deployments: RevisionDeployment[];
  apps: Array<{
    name: string;
    displayName: string;
    activeRevision: string;
    status: string;
    image: string;
  }>;
  summary: {
    totalApps: number;
    totalRevisions: number;
    lastDeployment: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = getCacheKey(env, 'deployments');
  const cached = checkCache<DeploymentsData>(deploymentsCache, cacheKey, forceRefresh);
  if (cached) return NextResponse.json(cached);

  try {
    // List container apps
    const apps = await listContainerApps(env);

    // Get revisions for each app (these ARE the deployments)
    const allRevisions: RevisionDeployment[] = [];
    const appSummaries = [];

    for (const app of apps) {
      const revisions = await listContainerAppRevisions(env, app.name, 10);

      for (const rev of revisions) {
        // Extract tag from image (e.g., "ghcr.io/org/repo:sha-abc1234" -> "sha-abc1234")
        const imageParts = rev.image.split(':');
        const imageTag = imageParts.length > 1 ? imageParts[imageParts.length - 1] : 'latest';

        allRevisions.push({
          appName: app.name,
          displayName: mapServiceName(app.name),
          revisionName: rev.name,
          image: rev.image,
          imageTag,
          createdTime: rev.createdTime,
          runningState: rev.runningState,
          trafficWeight: rev.trafficWeight,
          active: rev.active,
          replicas: rev.replicas,
        });
      }

      appSummaries.push({
        name: app.name,
        displayName: app.displayName,
        activeRevision: app.activeRevision,
        status: app.status,
        image: app.image,
      });
    }

    // Sort all revisions by creation time (newest first)
    allRevisions.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    const data: DeploymentsData = {
      timestamp: new Date().toISOString(),
      environment: env,
      deployments: allRevisions,
      apps: appSummaries,
      summary: {
        totalApps: apps.length,
        totalRevisions: allRevisions.length,
        lastDeployment: allRevisions[0]?.createdTime || 'unknown',
      },
    };

    setCache(deploymentsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch deployment info:', error);
    return NextResponse.json({ error: 'Failed to fetch deployment info' }, { status: 500 });
  }
}
