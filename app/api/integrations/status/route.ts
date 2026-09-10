// app/api/integrations/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db-helpers';

async function safeQueryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  try { return await queryOne<T>(sql, params); } catch { return null; }
}

async function safeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try { return await query<T>(sql, params); } catch { return []; }
}

export async function GET(request: NextRequest) {
  try { await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  // Substances table may not have enriched_at column in older schemas
  let substances = await safeQueryOne<any>(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) AS enriched
      FROM substances`);
  if (!substances) {
    substances = await safeQueryOne<any>(`SELECT COUNT(*) AS total, 0 AS enriched FROM substances`);
  }

  // driver_impact_factors may use different column names
  let factorsByMethod = await safeQuery<any>(`
    SELECT method_name, COUNT(*) AS factors
      FROM driver_impact_factors
     GROUP BY method_name
     ORDER BY factors DESC`);
  if (factorsByMethod.length === 0) {
    factorsByMethod = await safeQuery<any>(`
      SELECT driver_name AS method_name, COUNT(*) AS factors
        FROM driver_impact_factors
       GROUP BY driver_name
       ORDER BY factors DESC`);
  }

  // cost_rates table may not exist
  const rateCache = await safeQuery<any>(`
    SELECT rate_type, COUNT(*) AS cnt
      FROM cost_rates
     GROUP BY rate_type`);

  // ---- Per-source integration health, derived from REAL data only ----
  // (replaces the former hardcoded DEMO_INTEGRATIONS list). Each source's sync
  // history comes from integration_log; "configured" is whether the required
  // API key is actually present in the environment. Fields we have no honest
  // source for (e.g. live rate-limit quotas) are returned null and rendered as
  // "—" by the client rather than fabricated.
  const SOURCE_DEFS: Array<{
    id: string; name: string; description: string; keyEnv: string | null;
    // staticBacked: when the live API key is absent, this source still works
    // from bundled reference data (lib/integrations/reference-rates.ts), so the
    // MVP runs with zero API hits. Such sources show "static" rather than failing.
    staticBacked?: boolean;
  }> = [
    { id: 'openlca',          name: 'openLCA',          description: 'LCA characterisation-factor database', keyEnv: null },
    { id: 'pubchem',          name: 'PubChem',          description: 'Chemical substance enrichment',        keyEnv: null },
    { id: 'electricity_maps', name: 'Electricity Maps', description: 'Grid carbon intensity',                keyEnv: 'ELECTRICITY_MAPS_API_KEY', staticBacked: true },
    { id: 'eia',              name: 'EIA',              description: 'Energy price data',                    keyEnv: 'EIA_API_KEY',              staticBacked: true },
    { id: 'metals',           name: 'Metals-API',       description: 'Commodity & metals pricing',           keyEnv: 'METALS_API_KEY',           staticBacked: true },
    { id: 'bls',              name: 'BLS',              description: 'Labor occupation wage data',           keyEnv: 'BLS_API_KEY',              staticBacked: true },
  ];

  const logStats = await safeQuery<any>(`
    SELECT source,
           COUNT(*)                            AS events,
           MAX(executed_at)                    AS last_sync,
           COALESCE(SUM(records_affected), 0)  AS records,
           SUM(status = 'failed')              AS fails,
           SUBSTRING_INDEX(
             GROUP_CONCAT(status ORDER BY executed_at DESC), ',', 1
           )                                   AS last_status
      FROM integration_log
     GROUP BY source`);
  const statBySource = new Map<string, any>((logStats ?? []).map((r) => [r.source, r]));

  const sources = SOURCE_DEFS.map((def) => {
    const s = statBySource.get(def.id);
    const keyRequired = def.keyEnv !== null;
    // A live key counts as configured only if it's a real non-empty value
    // (Vercel placeholders like "\n" must NOT read as configured).
    const configured = def.keyEnv === null ? true : Boolean((process.env[def.keyEnv] ?? '').trim());
    const staticBacked = Boolean(def.staticBacked);
    const events = Number(s?.events ?? 0);
    const fails = Number(s?.fails ?? 0);
    const lastStatus: string | null = s?.last_status ?? null;

    let status: 'success' | 'warn' | 'error' | 'idle' | 'static';
    if (!configured) {
      // No live key. If we have bundled reference data, the source still works
      // (static mode); otherwise it's genuinely not set up.
      status = staticBacked ? 'static' : 'warn';
    } else if (events === 0) status = 'idle';   // live key present, never run
    else if (lastStatus === 'failed') status = 'error';
    else if (fails > 0) status = 'warn';
    else status = 'success';

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      keyRequired,
      configured,
      staticBacked,
      status,
      events,
      fails,
      records: Number(s?.records ?? 0),
      lastSync: s?.last_sync ? new Date(s.last_sync).toISOString() : null,
      lastStatus,
      // No live quota feed for these providers — null, never a fabricated number.
      rateLimit: null as { used: number; limit: number } | null,
    };
  });

  return NextResponse.json({
    success: true,
    substances: substances || { total: 0, enriched: 0 },
    factorsByMethod,
    rateCache,
    sources,
  });
}
