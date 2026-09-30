// app/api/integrations/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import { query } from '@/lib/db-helpers';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

/** Plain positive integers only; anything else ("x", "1.5", "1e3", "-5") gets the default. */
function parseLimit(raw: string | null): number {
  if (raw === null || !/^\d{1,6}$/.test(raw)) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;

  const sp = new URL(request.url).searchParams;
  const source = sp.get('source');
  const limit = parseLimit(sp.get('limit'));

  try {
    // LIMIT is bound, not interpolated. mysql2's execute() rejects a numeric
    // LIMIT parameter, so the (already validated) integer goes as a string.
    const rows = await query<any>(
      `SELECT log_id, source, action, records_affected, status, executed_at, details
         FROM integration_log
        ${source ? 'WHERE source = ?' : ''}
        ORDER BY executed_at DESC
        LIMIT ?`,
      source ? [source, String(limit)] : [String(limit)],
    );
    return NextResponse.json({ success: true, logs: rows });
  } catch (err) {
    console.error('Integration log query failed:', err);
    return NextResponse.json({ error: 'Failed to load the integration log' }, { status: 500 });
  }
}
