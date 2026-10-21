import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { newestRunIds } from '@/lib/runs/newest-first';
import { calculateCaseImpacts } from '@/lib/lca-engine';
import { canonicalizeRegion } from '@/lib/factor-selection';
import { canonicalMethod, parseRunSnapshot } from '@/lib/run-snapshot';
import { buildInventory, changedFlowCount, isClimate, statusCounts, type CaseFlowRow } from '@/lib/workspace/inventory';

// GET /api/cases/[caseId]/inventory?method=&region=
// The case's inventory as it stands now, for the workspace (E03 rows, E04
// table, the Out of date banner): every flow with its status and, for a
// counted one, amount × factor = impact for climate. It is the engine's own
// pass over the case (reads only; no run is written), under the method and
// region a run would use by default: the project's method, the case's region.

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const caseId = parseId((await params).caseId);
    const denied = await caseAccessDenied(userId, caseId, undefined, { notFound: 'Case not found' });
    if (denied) return denied;

    const scope = await queryOne<any>(
      `SELECT c.region_code AS case_region, p.lcia_method, p.region_code AS project_region
         FROM case_table c JOIN project p ON p.project_id = c.project_id WHERE c.case_id = ?`,
      [caseId],
    );
    const sp = request.nextUrl.searchParams;
    const method = canonicalMethod(sp.get('method') || scope?.lcia_method || 'CML 2001');
    if (!method) return NextResponse.json({ error: 'Unknown method' }, { status: 400 });
    const region = canonicalizeRegion(sp.get('region') || scope?.case_region || scope?.project_region || 'Global');

    const flows = await query<any>(
      `SELECT f.flow_id, f.component_id, f.substance_id, s.substance_name, s.unit AS substance_unit,
              f.flow_type, f.quantity, f.unit, f.driver_description
         FROM flows f
         JOIN component c ON c.component_id = f.component_id
         JOIN substances s ON s.substance_id = f.substance_id
        WHERE c.case_id = ?
        ORDER BY c.hierarchy_level, c.component_id, f.flow_type, f.flow_id`,
      [caseId],
    );

    const conn = await getPool().getConnection();
    let result;
    try {
      result = await calculateCaseImpacts(caseId, conn as any, { method, regionCode: region });
    } finally {
      conn.release();
    }

    const rows = buildInventory(
      flows.map((f) => ({ ...f, quantity: f.quantity == null ? null : Number(f.quantity) })) as CaseFlowRow[],
      result,
    );
    const climate = result.total_impacts.find((t) => isClimate(t.category_name)) ?? null;

    // The latest completed run, and how many flows changed since it froze them.
    // The id first, then the row: the snapshot never enters a sort (lib/runs/newest-first).
    const [lastId] = await newestRunIds(caseId, { status: 'completed', order: 'id', limit: 1 });
    const last = lastId
      ? await queryOne<any>(
          `SELECT run_id, calculation_method, region_code, run_date, run_snapshot FROM assessment_runs WHERE run_id = ?`,
          [lastId],
        )
      : null;
    const snap = last ? parseRunSnapshot(last.run_snapshot) : null;
    const now = rows.map((r) => ({ flow_id: r.flow_id, substance: r.substance, direction: r.direction, amount: r.amount, unit: r.unit }));
    const frozen = snap?.inventory ?? null;

    return NextResponse.json({
      success: true,
      method,
      region,
      rows,
      counts: statusCounts(rows),
      climate: climate ? { value: climate.impact_value, unit: climate.unit } : null,
      steps: result.component_results.map((r) => ({
        component_id: r.component_id,
        climate: r.impacts.find((i) => isClimate(i.category_name))?.impact_value ?? 0,
      })),
      latest_run: last
        ? {
            run_id: Number(last.run_id),
            method: last.calculation_method,
            region: last.region_code,
            run_date: last.run_date,
            // null when the run froze no inventory (an older run): we cannot tell.
            changed_flows: frozen ? changedFlowCount(frozen, now) : null,
          }
        : null,
    });
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Case inventory error:', error);
    return NextResponse.json({ error: 'Failed to read the inventory' }, { status: 500 });
  }
}
