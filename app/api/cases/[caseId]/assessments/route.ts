import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne, execute, transaction } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { calculateCaseImpacts, formatAlgorithmSteps, type LCAResult } from '@/lib/lca-engine';

// GET /api/cases/[caseId]/assessments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, caseData.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const assessments = await query(
      `SELECT ar.*, a.username as executed_by_username
       FROM assessment_runs ar
       LEFT JOIN account a ON ar.executed_by = a.id
       WHERE ar.case_id = ?
       ORDER BY ar.run_date DESC`,
      [caseId]
    );

    // For each assessment, fetch the actual impact results
    const assessmentsWithResults = await Promise.all(
      (assessments as any[]).map(async (assessment) => {
        // Get impact results for this run, aggregated by category
        const results = await query(
          `SELECT ic.category_name, SUM(ar.impact_value) as total_value, ar.unit
           FROM assessment_results ar
           JOIN impact_categories ic ON ar.category_id = ic.category_id
           WHERE ar.run_id = ?
           GROUP BY ic.category_id, ic.category_name, ar.unit`,
          [assessment.run_id]
        );

        // Transform to impacts object
        const impacts: Record<string, { value: number; unit: string }> = {};
        (results as any[]).forEach(r => {
          impacts[r.category_name] = {
            value: parseFloat(r.total_value) || 0,
            unit: r.unit
          };
        });

        // Get component breakdown
        const componentResults = await query(
          `SELECT
            c.component_id,
            c.component_name,
            c.process_type as component_type,
            COUNT(DISTINCT ar.result_id) as flows_processed,
            JSON_ARRAYAGG(
              JSON_OBJECT(
                'category_id', ic.category_id,
                'category_name', ic.category_name,
                'impact_value', ar.impact_value,
                'unit', ar.unit
              )
            ) as impacts
           FROM assessment_results ar
           JOIN component c ON ar.component_id = c.component_id
           JOIN impact_categories ic ON ar.category_id = ic.category_id
           WHERE ar.run_id = ?
           GROUP BY c.component_id, c.component_name, c.process_type`,
          [assessment.run_id]
        );

        // Parse JSON impacts for each component
        const componentBreakdown = (componentResults as any[]).map(comp => ({
          component_id: comp.component_id,
          component_name: comp.component_name,
          component_type: comp.component_type,
          flows_processed: comp.flows_processed,
          impacts: typeof comp.impacts === 'string' ? JSON.parse(comp.impacts) : comp.impacts
        }));

        return {
          ...assessment,
          impacts,
          componentBreakdown
        };
      })
    );

    return NextResponse.json({ success: true, assessments: assessmentsWithResults });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get assessments error:', error);
    return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 });
  }
}

// POST /api/cases/[caseId]/assessments
// Runs a new LCA assessment using the core calculation engine
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id, case_name FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, caseData.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { run_name, calculation_method, region_code } = await request.json();
    const method = calculation_method || 'CML 2001';
    const regionCode = region_code || undefined;

    const result = await transaction(async (conn) => {
      // Create assessment run record
      const timestamp = Date.now();
      const defaultName = `Assessment-${timestamp}`;

      const [runResult] = await conn.query(
        `INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by)
         VALUES (?, ?, ?, 'running', ?)`,
        [caseId, run_name || defaultName, method, userId]
      );

      const runId = (runResult as any).insertId;

      try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔬 RUNNING LCA ASSESSMENT - Run ID: ${runId}`);
        console.log(`   Case: ${caseData.case_name} (ID: ${caseId})`);
        console.log(`   Method: ${method}`);
        console.log(`${'='.repeat(80)}\n`);

        // Run LCA calculation using the core engine
        const lcaResult: LCAResult = await calculateCaseImpacts(caseId, conn, { method, regionCode });

        // Log algorithm steps to console
        console.log('\n📊 ALGORITHM EXECUTION STEPS:\n');
        const formattedSteps = formatAlgorithmSteps(lcaResult.algorithm_steps);
        formattedSteps.forEach(step => console.log(step));

        console.log(`\n✅ CALCULATION SUMMARY:`);
        console.log(`   • Total Components: ${lcaResult.summary.total_components}`);
        console.log(`   • Components with Flows: ${lcaResult.summary.components_with_flows}`);
        console.log(`   • Total Flows Processed: ${lcaResult.summary.total_flows_processed}`);
        console.log(`   • Impact Categories: ${lcaResult.summary.impact_categories_calculated}`);

        // Store results in database
        for (const compResult of lcaResult.component_results) {
          for (const impact of compResult.impacts) {
            await conn.query(
              `INSERT INTO assessment_results
               (run_id, component_id, category_id, impact_value, unit)
               VALUES (?, ?, ?, ?, ?)`,
              [runId, compResult.component_id, impact.category_id, impact.impact_value, impact.unit]
            );
          }
        }

        console.log(`\n💾 Stored ${lcaResult.component_results.reduce((sum, cr) => sum + cr.impacts.length, 0)} results in database\n`);

        // Mark as completed
        await conn.query(
          `UPDATE assessment_runs SET status = 'completed' WHERE run_id = ?`,
          [runId]
        );

        console.log(`${'='.repeat(80)}`);
        console.log(`✅ ASSESSMENT COMPLETED SUCCESSFULLY`);
        console.log(`${'='.repeat(80)}\n`);

        return { runId, lcaResult };
      } catch (calcError: any) {
        console.error(`\n❌ ASSESSMENT FAILED:`, calcError);

        await conn.query(
          `UPDATE assessment_runs SET status = 'failed', error_log = ? WHERE run_id = ?`,
          [calcError.message, runId]
        );

        throw calcError;
      }
    });

    // Fetch complete assessment data
    const newAssessment = await queryOne(
      `SELECT ar.*, a.username as executed_by_username
       FROM assessment_runs ar
       LEFT JOIN account a ON ar.executed_by = a.id
       WHERE ar.run_id = ?`,
      [result.runId]
    );

    // Fetch results
    const results = await query(
      `SELECT ar.*, ic.category_name, c.component_name
       FROM assessment_results ar
       JOIN impact_categories ic ON ar.category_id = ic.category_id
       JOIN component c ON ar.component_id = c.component_id
       WHERE ar.run_id = ?
       ORDER BY ic.category_id, c.hierarchy_level`,
      [result.runId]
    );

    // Detect "zero inventory" runs and warn the caller — otherwise the user sees
    // an empty results page with no explanation. (Bug #7 in the E2E audit.)
    const warnings: string[] = [];
    if (result.lcaResult.summary.components_with_flows === 0) {
      warnings.push(
        'No components in this case have any input/output flows yet. The assessment ran successfully but every impact is 0. Add at least one flow on a leaf component (Elemental Task) and re-run.',
      );
    }

    // Return comprehensive response with algorithm details
    return NextResponse.json({
      success: true,
      assessment: newAssessment,
      // Promote run_id to the top level too — clients shouldn't have to dig into `assessment.run_id`. (Bug #8.)
      run_id: result.runId,
      summary: result.lcaResult.summary,
      ...(warnings.length ? { warnings } : {}),
      results,
      total_impacts: result.lcaResult.total_impacts,
      algorithm_steps: result.lcaResult.algorithm_steps.map(step => step.step_description),
      component_breakdown: result.lcaResult.component_results.map(cr => ({
        component_id: cr.component_id,
        component_name: cr.component_name,
        component_type: cr.component_type,
        flows_processed: cr.total_flows_processed,
        impacts: cr.impacts
      }))
    }, { status: 201 });

  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Run assessment error:', error);
    return NextResponse.json({
      error: 'Failed to run assessment',
      details: error.message
    }, { status: 500 });
  }
}
