// app/api/integrations/pubchem/enrich/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import {
  enrichSubstance, enrichAllSubstances, ENRICH_DEFAULT_LIMIT, ENRICH_MAX_LIMIT,
} from '@/lib/integrations/pubchem/enrich';
import { logIntegration } from '@/lib/integrations/log';
import { logFailure } from '@/lib/integrations/route-errors';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const Body = z.object({
  substance_id: z.number().int().positive().optional(),
  only_missing: z.boolean().optional(),
  limit: z.number().int().positive().max(ENRICH_MAX_LIMIT).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

  // One call can make hundreds of PubChem requests.
  const limited = await enforceRateLimit(RATE_LIMITS.pubchemEnrich, [userId]);
  if (limited) return limited;

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    if (parsed.data.substance_id) {
      const result = await enrichSubstance(parsed.data.substance_id);
      await logIntegration({
        source: 'pubchem', action: 'enrich_substance',
        recordsAffected: result.status === 'enriched' ? 1 : 0,
        executedBy: userId,
        details: { substance_id: parsed.data.substance_id, ...result },
      });
      return NextResponse.json({ success: true, result });
    }

    const summary = await enrichAllSubstances({
      onlyMissing: parsed.data.only_missing ?? true,
      limit: parsed.data.limit ?? ENRICH_DEFAULT_LIMIT,
    });
    await logIntegration({
      source: 'pubchem', action: 'enrich_all',
      recordsAffected: summary.enriched,
      executedBy: userId,
      status: summary.failed > 0 ? 'partial' : 'success',
      details: summary,
    });
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    await logFailure(
      { source: 'pubchem', action: 'enrich', executedBy: userId,
        details: { substance_id: parsed.data.substance_id ?? null } },
      err, 'PubChem enrich failed',
    );
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}
