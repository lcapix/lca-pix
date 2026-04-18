// app/api/integrations/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try { await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const substances = await queryOne<any>(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) AS enriched
      FROM substances`);

  const factorsByMethod = await query<any>(`
    SELECT method_name, COUNT(*) AS factors
      FROM driver_impact_factors
     GROUP BY method_name
     ORDER BY factors DESC`);

  const rateCache = await query<any>(`
    SELECT rate_type, COUNT(*) AS cnt
      FROM cost_rates
     GROUP BY rate_type`);

  return NextResponse.json({
    success: true,
    substances,
    factorsByMethod,
    rateCache,
  });
}
