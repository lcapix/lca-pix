// app/api/integrations/electricity/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  zones: z.array(z.string().min(1)).min(1).max(20),
  method: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const results: Array<{ zone: string; factorValue?: number; inserted?: boolean; error?: string }> = [];
  let failed = 0;
  for (const zone of parsed.data.zones) {
    try {
      const r = await syncZoneFactor(zone, parsed.data.method);
      results.push(r);
    } catch (e: any) {
      failed++;
      results.push({ zone, error: e.message });
    }
  }
  const successful = results.filter(r => 'inserted' in r).length;
  await logIntegration({
    source: 'electricity_maps', action: 'sync_zones',
    recordsAffected: successful,
    executedBy: userId,
    status: failed === 0 ? 'success' : failed < results.length ? 'partial' : 'failed',
    details: { zones: parsed.data.zones, results },
  });
  return NextResponse.json({ success: true, results });
}
