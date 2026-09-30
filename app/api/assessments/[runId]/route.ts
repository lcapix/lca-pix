import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { projectAccessDenied } from '@/lib/route-guard';
import {
  hasFrozenResults,
  LEGACY_RESULTS_SOURCE,
  parseRunSnapshot,
  snapshotComponentBreakdown,
  snapshotResultRows,
} from '@/lib/run-snapshot';

const AUTH_ERRORS = new Set([
  'Unauthorized',
  'No authentication token provided',
  'Invalid or expired token',
  'User account not found or inactive',
]);

// GET /api/assessments/[runId]
// Fetches detailed results for a specific assessment run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { runId: runIdParam } = await params;
    const runId = parseInt(runIdParam);

    // Get assessment run with access check
    const assessment = await queryOne<any>(
      `SELECT ar.*, a.username as executed_by_username, c.project_id, c.case_name
       FROM assessment_runs ar
       LEFT JOIN account a ON ar.executed_by = a.id
       JOIN case_table c ON ar.case_id = c.case_id
       WHERE ar.run_id = ?`,
      [runId]
    );

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const denied = await projectAccessDenied(userId, assessment.project_id, undefined, { notFound: 'Assessment not found' });
    if (denied) return denied;

    const snapshot = parseRunSnapshot(assessment.run_snapshot);
    let results: any[];
    let impactTotals: any[];
    let formattedComponentBreakdown: any[];
    let resultsSource: string;

    if (hasFrozenResults(snapshot)) {
      // A frozen run (snapshot v3) reports what it computed: deleting or
      // renaming a step afterwards changes nothing here.
      results = snapshotResultRows(snapshot).map((r) => ({
        run_id: runId,
        component_id: r.component_id,
        category_id: r.category_id,
        impact_value: r.impact_value,
        unit: r.unit,
        category_name: r.category_name,
        component_name: r.component_name,
        life_cycle_stage: r.life_cycle_stage,
      }));
      impactTotals = snapshot.totals.map((t) => ({
        category_id: t.category_id,
        category_name: t.category_name,
        impact_value: t.value,
        unit: t.unit,
        flow_count: t.flow_count,
      }));
      formattedComponentBreakdown = snapshotComponentBreakdown(snapshot).map((c) => ({
        component_id: c.component_id,
        component_name: c.component_name,
        component_type: c.component_type,
        life_cycle_stage: c.life_cycle_stage,
        flows_processed: c.flows_processed,
        impacts: c.impacts,
      }));
      resultsSource = 'snapshot';
    } else {
      // Legacy run: the stored result rows, with step names read from the live
      // step table (a deleted step reads as "Removed step").
      results = await query(
        `SELECT ar.*, ic.category_name, COALESCE(c.component_name, 'Removed step') AS component_name
         FROM assessment_results ar
         JOIN impact_categories ic ON ar.category_id = ic.category_id
         LEFT JOIN component c ON ar.component_id = c.component_id
         WHERE ar.run_id = ?
         ORDER BY ic.category_id, c.hierarchy_level`,
        [runId]
      );

      impactTotals = await query(
        `SELECT
           ic.category_id,
           ic.category_name,
           SUM(ar.impact_value) as impact_value,
           ar.unit,
           COUNT(DISTINCT ar.component_id) as flow_count
         FROM assessment_results ar
         JOIN impact_categories ic ON ar.category_id = ic.category_id
         WHERE ar.run_id = ?
         GROUP BY ic.category_id, ic.category_name, ar.unit
         ORDER BY ic.category_id`,
        [runId]
      );

      const componentBreakdown = await query(
        `SELECT
           ar.component_id,
           COALESCE(c.component_name, 'Removed step') AS component_name,
           c.component_type,
           COUNT(DISTINCT f.flow_id) as flows_processed,
           ar.category_id,
           ic.category_name,
           ar.impact_value,
           ar.unit
         FROM assessment_results ar
         LEFT JOIN component c ON c.component_id = ar.component_id
         JOIN impact_categories ic ON ar.category_id = ic.category_id
         LEFT JOIN flows f ON c.component_id = f.component_id
         WHERE ar.run_id = ?
         GROUP BY ar.result_id, ar.component_id, c.component_name, c.component_type, ar.category_id, ic.category_name, ar.impact_value, ar.unit, c.hierarchy_level
         ORDER BY c.hierarchy_level, ar.category_id`,
        [runId]
      );

      const componentMap = new Map();
      for (const row of componentBreakdown as any[]) {
        if (!componentMap.has(row.component_id)) {
          componentMap.set(row.component_id, {
            component_id: row.component_id,
            component_name: row.component_name,
            component_type: row.component_type,
            flows_processed: row.flows_processed,
            impacts: []
          });
        }

        componentMap.get(row.component_id).impacts.push({
          category_id: row.category_id,
          category_name: row.category_name,
          impact_value: parseFloat(row.impact_value),
          unit: row.unit
        });
      }
      formattedComponentBreakdown = Array.from(componentMap.values());
      resultsSource = LEGACY_RESULTS_SOURCE;
    }
    delete assessment.run_snapshot;

    // Create summary
    const summary = {
      total_components: new Set(results.map((r: any) => r.component_id)).size,
      components_with_flows: formattedComponentBreakdown.length,
      total_flows_processed: formattedComponentBreakdown.reduce((sum, c) => sum + c.flows_processed, 0),
      impact_categories_calculated: impactTotals.length,
      calculation_method: assessment.calculation_method
    };

    return NextResponse.json({
      success: true,
      assessment,
      summary,
      results,
      total_impacts: impactTotals,
      component_breakdown: formattedComponentBreakdown,
      results_source: resultsSource,
    });

  } catch (error: any) {
    if (AUTH_ERRORS.has(error?.message)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get assessment details error:', error);
    return NextResponse.json({ error: 'Failed to fetch assessment details' }, { status: 500 });
  }
}
