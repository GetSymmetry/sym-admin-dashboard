import { NextResponse } from 'next/server';
import {
  type Environment,
  getCacheKey,
  checkCache,
  setCache,
  alertsCache,
  listAlertRules,
  listFiredAlerts,
} from '@/lib/api';
import type { AlertsResponse } from '@/types/metrics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = (searchParams.get('env') || 'prod') as Environment;
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = getCacheKey(env, 'alerts');
  const cached = checkCache<AlertsResponse>(alertsCache, cacheKey, forceRefresh);
  if (cached) return NextResponse.json(cached);

  try {
    // Fetch alert rules and fired alerts in parallel
    const [rules, firedAlerts] = await Promise.all([
      listAlertRules(env),
      listFiredAlerts(env),
    ]);

    // Build severity counts
    const bySeverity: Record<number, number> = {};
    for (const rule of rules) {
      bySeverity[rule.severity] = (bySeverity[rule.severity] || 0) + 1;
    }

    const data: AlertsResponse = {
      timestamp: new Date().toISOString(),
      environment: env,
      rules,
      firedAlerts,
      summary: {
        totalRules: rules.length,
        enabledRules: rules.filter(r => r.enabled).length,
        bySeverity,
        currentlyFiring: firedAlerts.filter(a => a.monitorCondition === 'Fired').length,
      },
    };

    setCache(alertsCache, cacheKey, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
