// app/api/integrations/pubchem/enrich/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import { enrichSubstance, enrichAllSubstances } from '@/lib/integrations/pubchem/enrich';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  substance_id: z.number().int().positive().optional(),
  only_missing: z.boolean().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

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
      limit: parsed.data.limit,
    });
    await logIntegration({
      source: 'pubchem', action: 'enrich_all',
      recordsAffected: summary.enriched,
      executedBy: userId,
      status: summary.failed > 0 ? 'partial' : 'success',
      details: summary,
    });
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    await logIntegration({
      source: 'pubchem', action: 'enrich',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
