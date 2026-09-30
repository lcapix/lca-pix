// app/api/components/[componentId]/auto-costs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { projectAccessDenied } from '@/lib/route-guard';
import { queryOne } from '@/lib/db-helpers';
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
  const id = Number(componentId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Component not found' }, { status: 404 });
  }

  // This writes labor_cost / energy_cost on the component, so it needs the
  // same editor check as PUT /api/components/[id]: resolve the owning project
  // through component -> case_table first.
  let projectId: number;
  try {
    const owner = await queryOne<any>(
      `SELECT ct.project_id
         FROM component c
         JOIN case_table ct ON c.case_id = ct.case_id
        WHERE c.component_id = ?`,
      [id],
    );
    if (!owner || owner.project_id == null) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }
    projectId = Number(owner.project_id);
    const denied = await projectAccessDenied(userId, projectId, 'editor', { notFound: 'Component not found' });
    if (denied) return denied;
  } catch (err) {
    console.error('auto-costs access check failed:', err);
    return NextResponse.json({ error: 'Failed to auto-populate costs' }, { status: 500 });
  }

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
    console.error('auto-costs failed:', err);
    try {
      await logIntegration({
        source: 'eia', action: 'auto_populate_costs',
        recordsAffected: 0, executedBy: userId, status: 'failed',
        details: { componentId: id, error: err?.message ?? String(err) },
      });
    } catch (logErr) {
      console.error('auto-costs failure could not be logged:', logErr);
    }
    return NextResponse.json({ error: 'Failed to auto-populate costs' }, { status: 500 });
  }
}
