import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

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

    const hasAccess = await checkProjectAccess(userId, assessment.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch results
    const results = await query(
      `SELECT ar.*, ic.category_name, c.component_name
       FROM assessment_results ar
       JOIN impact_categories ic ON ar.category_id = ic.category_id
       JOIN component c ON ar.component_id = c.component_id
       WHERE ar.run_id = ?
       ORDER BY ic.category_id, c.hierarchy_level`,
      [runId]
    );

    // Calculate total impacts per category
    const impactTotals = await query(
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

    // Calculate component breakdown
    const componentBreakdown = await query(
      `SELECT
         c.component_id,
         c.component_name,
         c.component_type,
         COUNT(DISTINCT f.flow_id) as flows_processed,
         ar.category_id,
         ic.category_name,
         ar.impact_value,
         ar.unit
       FROM component c
       JOIN assessment_results ar ON c.component_id = ar.component_id
       JOIN impact_categories ic ON ar.category_id = ic.category_id
       LEFT JOIN flows f ON c.component_id = f.component_id
       WHERE ar.run_id = ?
       GROUP BY c.component_id, c.component_name, c.component_type, ar.category_id, ic.category_name, ar.impact_value, ar.unit
       ORDER BY c.hierarchy_level, ic.category_id`,
      [runId]
    );

    // Group component breakdown by component
    const componentMap = new Map();
    for (const row of componentBreakdown) {
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

    const formattedComponentBreakdown = Array.from(componentMap.values());

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
      component_breakdown: formattedComponentBreakdown
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get assessment details error:', error);
    return NextResponse.json({ error: 'Failed to fetch assessment details' }, { status: 500 });
  }
}
