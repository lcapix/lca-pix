// app/api/integrations/electricity/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import { SYNC_ZONES, isSyncZone } from '@/lib/integrations/electricity-maps/zones';
import { SUPPORTED_METHODS } from '@/lib/integrations/openlca/methods';
import { logSafely, errorText } from '@/lib/integrations/route-errors';

// Accept either `zones: string[]` (the batch interface) OR a single `zone: string`
// (convenient for one-off lookups from the UI / curl).
// The zone becomes geographic_scope on a shared factor row: only zones with a
// curated reference value are accepted.
const Zone = z.string().refine(isSyncZone, {
  message: `Zone must be one of: ${SYNC_ZONES.join(', ')}`,
});

const Body = z.object({
  zones: z.array(Zone).min(1).max(20).optional(),
  zone: Zone.optional(),
  method: z.enum(SUPPORTED_METHODS).optional(),
}).refine(b => Boolean(b.zones?.length) || Boolean(b.zone), {
  message: 'Provide either `zone` (string) or `zones` (string[])',
});

export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    // Emit the zod issues so callers can see which field is wrong (was generic "Invalid body").
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const zonesToFetch = parsed.data.zones ?? (parsed.data.zone ? [parsed.data.zone] : []);

  const results: Array<{ zone: string; factorValue?: number; inserted?: boolean; error?: string }> = [];
  const errors: Array<{ zone: string; error: string }> = [];
  let failed = 0;
  for (const zone of zonesToFetch) {
    try {
      const r = await syncZoneFactor(zone, parsed.data.method);
      results.push(r);
    } catch (e) {
      failed++;
      console.error(`Electricity sync failed for zone ${zone}:`, e);
      errors.push({ zone, error: errorText(e) });
      results.push({ zone, error: 'Sync failed for this zone' });
    }
  }
  const written = results.filter(r => r.inserted === true).length;
  const allFailed = results.length > 0 && failed === results.length;
  // The real per-zone errors go to the admin-only log, not the response.
  await logSafely({
    source: 'electricity_maps', action: 'sync_zones',
    recordsAffected: written,
    executedBy: userId,
    status: failed === 0 ? 'success' : allFailed ? 'failed' : 'partial',
    details: { zones: zonesToFetch, results, errors },
  }, 'Electricity sync');
  if (allFailed) {
    return NextResponse.json({ success: false, error: 'No zone could be synced', results }, { status: 502 });
  }
  return NextResponse.json({ success: true, results });
}
