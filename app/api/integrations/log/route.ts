// app/api/integrations/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try { await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const sp = new URL(request.url).searchParams;
  const source = sp.get('source');
  const limit = Math.min(parseInt(sp.get('limit') ?? '20'), 200);

  const rows = await query<any>(
    `SELECT log_id, source, action, records_affected, status, executed_at, details
       FROM integration_log
      ${source ? 'WHERE source = ?' : ''}
      ORDER BY executed_at DESC
      LIMIT ${limit}`,
    source ? [source] : [],
  );

  return NextResponse.json({ success: true, logs: rows });
}
