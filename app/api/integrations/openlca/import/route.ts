// app/api/integrations/openlca/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { importFactorMethod } from '@/lib/integrations/openlca/import';
import { logIntegration } from '@/lib/integrations/log';
import { CML_2001_V4_FACTORS } from '@/lib/integrations/openlca/data/cml-2001-v4';
import { RECIPE_MIDPOINT_H_FACTORS } from '@/lib/integrations/openlca/data/recipe-midpoint-h';
import { TRACI_21_FACTORS } from '@/lib/integrations/openlca/data/traci-2.1';

const SUPPORTED: Record<string, typeof CML_2001_V4_FACTORS> = {
  'CML 2001': CML_2001_V4_FACTORS,
  'ReCiPe Midpoint (H)': RECIPE_MIDPOINT_H_FACTORS,
  'TRACI 2.1': TRACI_21_FACTORS,
};

const Body = z.object({
  method: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const methodName = parsed.data.method;
  const seeds = SUPPORTED[methodName];
  if (!seeds) {
    return NextResponse.json({
      error: `Method "${methodName}" not supported. Available: ${Object.keys(SUPPORTED).join(', ')}`,
    }, { status: 400 });
  }

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
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    await logIntegration({
      source: 'openlca', action: 'import_method',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { method: methodName, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    methods: Object.keys(SUPPORTED).map(name => ({
      name,
      seedCount: SUPPORTED[name].length,
    })),
  });
}
