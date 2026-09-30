import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { calculateCaseImpacts, formatAlgorithmSteps, type LCAResult } from '@/lib/lca-engine';
import { canonicalizeRegion } from '@/lib/factor-selection';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import {
  buildGoalScope,
  buildRunSnapshot,
  canonicalMethod,
  hasFrozenResults,
  LEGACY_RESULTS_SOURCE,
  parseRunSnapshot,
  snapshotComponentBreakdown,
  snapshotImpacts,
  SUPPORTED_METHODS,
  type GoalScope,
  type RunSnapshot,
} from '@/lib/run-snapshot';
import { parseId } from '@/lib/ids';

/** Flow-level detail of a snapshot, as the results screen reads it. */
function snapshotFlowDetail(snapshot: RunSnapshot) {
  return snapshot.flow_detail.map((r) => ({
    flow_id: r.flow_id,
    component_id: r.component_id ?? null,
    component: r.component,
    substance: r.substance,
    category_name: r.category_name,
    dir: r.dir,
    amount: r.amount,
    unit: r.unit,
    factor: r.factor,
    impact: r.impact,
    scope: r.scope,
    conversion: r.conversion,
    source_tier: r.source_tier ?? null,
    source: r.source ?? null,
    allocation: r.allocation ?? null,
  }));
}

/**
 * RUN-3: the run row is written inside the run's transaction, so a failure
 * rolls it back with everything else. Record the failed attempt afterwards, on
 * a pool connection of its own, so the case keeps a trace of it.
 */
async function recordFailedRun(args: {
  caseId: number;
  runName: string;
  method: string;
  regionCode: string;
  userId: number;
  error: unknown;
}): Promise<number | null> {
  const message = String((args.error as any)?.message ?? args.error ?? 'Unknown error').slice(0, 60000);
  try {
    return await insert(
      `INSERT INTO assessment_runs (case_id, run_name, calculation_method, region_code, status, error_log, executed_by)
       VALUES (?, ?, ?, ?, 'failed', ?, ?)`,
      [args.caseId, args.runName, args.method, args.regionCode, message, args.userId],
    );
  } catch (recordErr) {
    console.error('[assessments POST] could not record the failed run:', recordErr);
    return null;
  }
}

// GET /api/cases/[caseId]/assessments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseId(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, undefined, { notFound: 'Case not found' });
    if (denied) return denied;

    // The production `assessment_runs` table's timestamp column is `run_date`
    // (there is no `run_at` column). A prior "fix" selected/ordered by `ar.run_at`,
    // which threw "Unknown column 'ar.run_at'" and 500'd this whole endpoint —
    // making every case read as "Not Yet Assessed" even when completed runs with
    // results existed. Use `run_date` (present in prod) and also expose it under
    // the `run_at` alias so any client that still reads `run_at` keeps working.
    const assessments = await query(
      `SELECT ar.*, ar.run_date AS run_at, a.username as executed_by_username
       FROM assessment_runs ar
       LEFT JOIN account a ON ar.executed_by = a.id
       WHERE ar.case_id = ?
       ORDER BY ar.run_date DESC`,
      [caseId]
    );

    // Each run reports what it froze at run time (snapshot v3): totals, the
    // per-step breakdown with stages, flow detail. Runs made before v3 fall back
    // to their stored result rows joined to the live step table, and say so in
    // results_source.
    const assessmentsWithResults = await Promise.all(
      (assessments as any[]).map(async (assessment) => {
        const snapshot = parseRunSnapshot((assessment as any).run_snapshot);

        if (hasFrozenResults(snapshot)) {
          return {
            ...assessment,
            run_snapshot: undefined, // raw JSON not needed client-side twice
            impacts: snapshotImpacts(snapshot),
            componentBreakdown: snapshotComponentBreakdown(snapshot).map((c) => ({
              component_id: c.component_id,
              component_name: c.component_name,
              component_type: c.process_type ?? c.component_type,
              parent_component_id: c.parent_component_id,
              life_cycle_stage: c.life_cycle_stage ?? null,
              flows_processed: c.flows_processed,
              impacts: c.impacts,
            })),
            flowDetail: snapshotFlowDetail(snapshot),
            warnings: snapshot.warnings,
            goal_scope: snapshot.goal_scope ?? null,
            data_quality: snapshot.data_quality ?? null,
            detail_source: 'snapshot' as const,
            results_source: 'snapshot' as const,
          };
        }

        // Legacy run: impact results aggregated by category from the stored rows.
        const results = await query(
          `SELECT ic.category_name, SUM(ar.impact_value) as total_value, ar.unit
           FROM assessment_results ar
           JOIN impact_categories ic ON ar.category_id = ic.category_id
           WHERE ar.run_id = ?
           GROUP BY ic.category_id, ic.category_name, ar.unit`,
          [assessment.run_id]
        );

        const impacts: Record<string, { value: number; unit: string }> = {};
        (results as any[]).forEach(r => {
          impacts[r.category_name] = {
            value: parseFloat(r.total_value) || 0,
            unit: r.unit
          };
        });

        // Component breakdown, names and stages read from the live step table
        // (a deleted step reads as "Removed step"). A database without
        // migrate-022 falls back below and every step reads as production.
        const breakdownSql = (withStage: boolean) =>
          `SELECT
            ar.component_id,
            COALESCE(c.component_name, 'Removed step') AS component_name,
            c.process_type as component_type,
            ${withStage ? 'c.life_cycle_stage,' : ''}
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
           LEFT JOIN component c ON ar.component_id = c.component_id
           JOIN impact_categories ic ON ar.category_id = ic.category_id
           WHERE ar.run_id = ?
           GROUP BY ar.component_id, c.component_name, c.process_type${
             withStage ? ', c.life_cycle_stage' : ''
           }`;

        let componentResults: any[];
        try {
          componentResults = await query(breakdownSql(true), [assessment.run_id]);
        } catch (stageErr: any) {
          if (stageErr?.code !== 'ER_BAD_FIELD_ERROR') throw stageErr;
          componentResults = await query(breakdownSql(false), [assessment.run_id]);
        }

        const componentBreakdown = (componentResults as any[]).map(comp => ({
          component_id: comp.component_id,
          component_name: comp.component_name,
          component_type: comp.component_type,
          life_cycle_stage: comp.life_cycle_stage ?? null,
          flows_processed: comp.flows_processed,
          impacts: typeof comp.impacts === 'string' ? JSON.parse(comp.impacts) : comp.impacts
        }));

        // Flow-level detail: a v1/v2 snapshot still carries it (immutable);
        // older runs recompute it from live flows/factors, marked as such.
        if (snapshot) {
          return {
            ...assessment,
            run_snapshot: undefined,
            impacts,
            componentBreakdown,
            flowDetail: snapshotFlowDetail(snapshot),
            warnings: snapshot.warnings,
            goal_scope: snapshot.goal_scope ?? null,
            data_quality: snapshot.data_quality ?? null,
            detail_source: 'snapshot' as const,
            results_source: LEGACY_RESULTS_SOURCE,
          };
        }

        const flowRowsRaw = await query(
          `SELECT f.flow_id, c.component_name, c.hierarchy_level,
                  s.substance_name, f.flow_type, f.quantity, f.unit,
                  dif.category_id, ic.category_name,
                  dif.factor_value AS factor, dif.geographic_scope
           FROM flows f
           JOIN component c ON f.component_id = c.component_id
           JOIN substances s ON f.substance_id = s.substance_id
           JOIN driver_impact_factors dif
             ON f.substance_id = dif.substance_id AND dif.method_name = ?
           JOIN impact_categories ic ON dif.category_id = ic.category_id
           WHERE c.case_id = ?
           ORDER BY c.hierarchy_level, f.flow_id, ic.category_id`,
          [assessment.calculation_method, caseId]
        );

        // Dedupe to one factor per (flow, category): prefer a row whose
        // geographic_scope matches the run region, else 'Global', else first
        // seen — mirroring the engine's region-preference logic.
        const region = (assessment.region_code || '').toLowerCase();
        const picked = new Map<string, any>();
        for (const row of flowRowsRaw as any[]) {
          const key = `${row.flow_id}:${row.category_id}`;
          const scope = (row.geographic_scope || '').toLowerCase();
          const score = region && scope === region ? 2 : scope === 'global' ? 1 : 0;
          const prev = picked.get(key);
          if (!prev || score > prev._score) picked.set(key, { ...row, _score: score });
        }
        const flowDetail = Array.from(picked.values()).map((row) => {
          const amount = parseFloat(row.quantity) || 0;
          const factor = parseFloat(row.factor) || 0;
          return {
            flow_id: row.flow_id,
            component: row.component_name,
            substance: row.substance_name,
            category_name: row.category_name,
            dir: row.flow_type === 'input' ? 'IN' : 'OUT',
            amount,
            unit: row.unit,
            factor,
            impact: amount * factor,
          };
        });

        return {
          ...assessment,
          impacts,
          componentBreakdown,
          flowDetail,
          warnings: [],
          goal_scope: null,
          data_quality: null,
          detail_source: 'recomputed-legacy' as const,
          results_source: LEGACY_RESULTS_SOURCE,
        };
      })
    );

    return NextResponse.json({ success: true, assessments: assessmentsWithResults });
  } catch (error: any) {
    if (isAuthError(error)) {
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
    const caseId = parseId(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id, case_name FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, 'editor', { notFound: 'Case not found' });
    if (denied) return denied;

    // REC H5: a run holds a DB transaction for the whole engine pass.
    const limited = await enforceRateLimit(RATE_LIMITS.assessments, [userId]);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }
    const { run_name, calculation_method, region_code } = body as Record<string, unknown>;
    for (const [field, value] of Object.entries({ run_name, calculation_method, region_code })) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
      }
    }
    // A run that names no method or region uses the study's scope: the
    // project's LCIA method, the case's region (where the product is made),
    // then the project's region, then CML 2001 / Global.
    let scope: { method?: string | null; region?: string | null } = {};
    if (!calculation_method || !region_code) {
      try {
        const row = await queryOne<any>(
          `SELECT c.region_code AS case_region, p.lcia_method, p.region_code AS project_region
             FROM case_table c JOIN project p ON p.project_id = c.project_id
            WHERE c.case_id = ?`,
          [caseId]
        );
        scope = { method: row?.lcia_method, region: row?.case_region || row?.project_region };
      } catch {
        try {
          // Before migrate-018: the case's region only.
          const row = await queryOne<any>(`SELECT region_code FROM case_table WHERE case_id = ?`, [caseId]);
          scope = { region: row?.region_code };
        } catch {
          /* no region column: Global */
        }
      }
    }
    // RUN-6: only a method the factor table carries. Any other string used to
    // produce an all-zero "completed" run.
    const requestedMethod = (calculation_method as string) || scope.method || 'CML 2001';
    const method = canonicalMethod(requestedMethod);
    if (!method) {
      return NextResponse.json(
        {
          error: `Unknown impact-assessment method "${String(requestedMethod).slice(0, 64)}". Use one of: ${SUPPORTED_METHODS.join(', ')}.`,
          supported_methods: SUPPORTED_METHODS,
        },
        { status: 400 },
      );
    }
    // Canonical zone code ('US Grid' → 'US'); stored on the run so results are
    // attributable to the region actually used, not the UI label.
    const regionCode = canonicalizeRegion((region_code as string) || scope.region);
    if (regionCode.length > 20) {
      return NextResponse.json({ error: 'region_code is too long' }, { status: 400 });
    }
    const runName = String(run_name || `Assessment-${Date.now()}`).slice(0, 100);

    // Goal & scope in force for this run (ISO 14044 4.2), frozen into the
    // snapshot. SELECT * reads whichever columns exist, so a database without
    // migrate-014 still runs and the snapshot records the defaults.
    let goalScope: GoalScope | null = null;
    try {
      const [projectRow, caseRow] = await Promise.all([
        queryOne<any>(`SELECT * FROM project WHERE project_id = ?`, [caseData.project_id]),
        queryOne<any>(`SELECT * FROM case_table WHERE case_id = ?`, [caseId]),
      ]);
      goalScope = buildGoalScope(projectRow, caseRow);
    } catch (gsErr) {
      console.warn('[assessments POST] could not read goal & scope:', gsErr);
    }

    let result: { runId: number; lcaResult: LCAResult; snapshot: RunSnapshot };
    try {
      result = await transaction(async (conn) => {
        const [runResult] = await conn.query(
          `INSERT INTO assessment_runs (case_id, run_name, calculation_method, region_code, status, executed_by)
           VALUES (?, ?, ?, ?, 'running', ?)`,
          [caseId, runName, method, regionCode, userId]
        );
        const runId = (runResult as any).insertId;

        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔬 RUNNING LCA ASSESSMENT - Run ID: ${runId}`);
        console.log(`   Case: ${caseData.case_name} (ID: ${caseId})`);
        console.log(`   Method: ${method}`);
        console.log(`${'='.repeat(80)}\n`);

        // Run LCA calculation using the core engine
        const lcaResult: LCAResult = await calculateCaseImpacts(caseId, conn, { method, regionCode });

        console.log('\n📊 ALGORITHM EXECUTION STEPS:\n');
        formatAlgorithmSteps(lcaResult.algorithm_steps).forEach(step => console.log(step));
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

        // Freeze what this run computed AND what it was computed from: totals,
        // every step (id, name, parent, stage, per-category values, costs) and
        // every flow as entered (snapshot v3), read inside the same transaction
        // as the engine so they describe exactly the inventory it used.
        const [components] = await conn.query(
          `SELECT * FROM component WHERE case_id = ? ORDER BY hierarchy_level, component_id`,
          [caseId]
        );
        const [flows] = await conn.query(
          `SELECT f.flow_id, f.component_id, c.component_name, f.substance_id, s.substance_name,
                  f.flow_type, f.quantity, f.unit
             FROM flows f
             JOIN component c ON c.component_id = f.component_id
             LEFT JOIN substances s ON s.substance_id = f.substance_id
            WHERE c.case_id = ?
            ORDER BY c.hierarchy_level, c.component_id, f.flow_type, f.flow_id`,
          [caseId]
        );
        const snapshot = buildRunSnapshot(lcaResult, method, regionCode, goalScope, {
          components: components as any[],
          flows: flows as any[],
        });

        await conn.query(
          `UPDATE assessment_runs SET status = 'completed', run_snapshot = ? WHERE run_id = ?`,
          [JSON.stringify(snapshot), runId]
        );

        console.log(`✅ ASSESSMENT COMPLETED SUCCESSFULLY (run ${runId})\n`);
        return { runId, lcaResult, snapshot };
      });
    } catch (calcError: any) {
      console.error(`\n❌ ASSESSMENT FAILED:`, calcError);
      // The transaction rolled the run row back; keep a record of the attempt.
      const failedRunId = await recordFailedRun({
        caseId,
        runName,
        method,
        regionCode,
        userId,
        error: calcError,
      });
      return NextResponse.json(
        {
          error: 'Failed to run assessment',
          details: calcError?.message ?? String(calcError),
          ...(failedRunId ? { run_id: failedRunId, status: 'failed' } : {}),
        },
        { status: 500 },
      );
    }

    // Fetch complete assessment data
    const newAssessment = await queryOne<any>(
      `SELECT ar.*, a.username as executed_by_username
       FROM assessment_runs ar
       LEFT JOIN account a ON ar.executed_by = a.id
       WHERE ar.run_id = ?`,
      [result.runId]
    );
    if (newAssessment) delete newAssessment.run_snapshot;

    // Fetch results
    const results = await query(
      `SELECT ar.*, ic.category_name, COALESCE(c.component_name, 'Removed step') AS component_name
       FROM assessment_results ar
       JOIN impact_categories ic ON ar.category_id = ic.category_id
       LEFT JOIN component c ON ar.component_id = c.component_id
       WHERE ar.run_id = ?
       ORDER BY ic.category_id, c.hierarchy_level`,
      [result.runId]
    );

    // The snapshot's warnings: the zero-inventory notice (RUN-6) plus the
    // engine's data-quality warnings, the same list every later GET returns.
    const warnings = result.snapshot.warnings;

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
      goal_scope: goalScope,
      data_quality: result.lcaResult.data_quality ?? null,
      algorithm_steps: result.lcaResult.algorithm_steps.map(step => step.step_description),
      component_breakdown: result.lcaResult.component_results.map(cr => ({
        component_id: cr.component_id,
        component_name: cr.component_name,
        component_type: cr.component_type,
        life_cycle_stage: cr.life_cycle_stage ?? null,
        flows_processed: cr.total_flows_processed,
        impacts: cr.impacts
      })),
      results_source: 'snapshot',
    }, { status: 201 });

  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Run assessment error:', error);
    return NextResponse.json({
      error: 'Failed to run assessment',
      details: error.message
    }, { status: 500 });
  }
}
