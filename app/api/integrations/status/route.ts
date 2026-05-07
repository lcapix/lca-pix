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

  return NextResponse.json({
    success: true,
    substances: substances || { total: 0, enriched: 0 },
    factorsByMethod,
    rateCache,
  });
}
