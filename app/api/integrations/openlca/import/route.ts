// app/api/integrations/openlca/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import { importFactorMethod } from '@/lib/integrations/openlca/import';
import { SUPPORTED_METHODS, type SupportedMethod } from '@/lib/integrations/openlca/methods';
import { logIntegration } from '@/lib/integrations/log';
import { logFailure } from '@/lib/integrations/route-errors';
import { CML_2001_V4_FACTORS } from '@/lib/integrations/openlca/data/cml-2001-v4';
import { RECIPE_MIDPOINT_H_FACTORS } from '@/lib/integrations/openlca/data/recipe-midpoint-h';
import { TRACI_21_FACTORS } from '@/lib/integrations/openlca/data/traci-2.1';

const SUPPORTED: Record<SupportedMethod, typeof CML_2001_V4_FACTORS> = {
  'CML 2001': CML_2001_V4_FACTORS,
  'ReCiPe Midpoint (H)': RECIPE_MIDPOINT_H_FACTORS,
  'TRACI 2.1': TRACI_21_FACTORS,
};

const Body = z.object({
  method: z.enum(SUPPORTED_METHODS),
});

export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request);
  if (guard.response) return guard.response;
  const userId = guard.userId;

  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json({
      error: `Unsupported method. Available: ${SUPPORTED_METHODS.join(', ')}`,
    }, { status: 400 });
  }

  const methodName = parsed.data.method;
  const seeds = SUPPORTED[methodName];

  try {
    const result = await importFactorMethod(methodName, seeds);
    await logIntegration({
      source: 'openlca',
      action: 'import_method',
      recordsAffected: result.inserted,
      executedBy: userId,
      status: result.errors.length ? 'partial' : 'success',
      details: result as unknown as Record<string, unknown>,
    });
    // Per-row DB errors stay in integration_log; the client gets a count.
    const { errors, ...counts } = result;
    return NextResponse.json({ success: true, result: { ...counts, failed: errors.length } });
  } catch (err) {
    await logFailure(
      { source: 'openlca', action: 'import_method', executedBy: userId, details: { method: methodName } },
      err, 'openLCA import failed',
    );
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try { await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  return NextResponse.json({
    success: true,
    methods: SUPPORTED_METHODS.map(name => ({
      name,
      seedCount: SUPPORTED[name].length,
    })),
  });
}
