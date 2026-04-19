// app/api/components/[componentId]/auto-costs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { autoPopulateCosts } from '@/lib/costs/auto-populate';
import { logIntegration } from '@/lib/integrations/log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> },
) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { componentId } = await params;
  const id = parseInt(componentId);

  try {
    const result = await autoPopulateCosts(id);
    await logIntegration({
      source: 'eia',  // multiple sources possible; tag as the dominant one
      action: 'auto_populate_costs',
      recordsAffected: result.totalsSet,
      executedBy: userId,
      details: { componentId: id, ...result },
    });
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    await logIntegration({
      source: 'eia', action: 'auto_populate_costs',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { componentId: id, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
