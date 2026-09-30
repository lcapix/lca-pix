/**
 * PDF Export API Route
 *
 * GET /api/assessments/[runId]/export?format=pdf
 *
 * Generates and streams a professional PDF report for an LCA assessment run.
 * Includes project overview, process hierarchy, impact results, component
 * breakdown, and environmental flows detail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { generateAssessmentPDF, type ReportData } from '@/lib/pdf-generator';
import { generateAssessmentPPTX } from '@/lib/pptx-generator';
import {
  buildInventoryCsv,
  LEGACY_RESULTS_SOURCE,
  parseRunSnapshot,
  snapshotReportParts,
} from '@/lib/run-snapshot';
import { parseId } from '@/lib/ids';

const FORMATS = new Set(['pdf', 'pptx', 'ppt', 'csv']);

/** Printed beside the process tree and flow list of a run that did not freeze them (EXP-1). */
const LEGACY_INVENTORY_NOTE =
  'This run was made before its inventory was frozen with it: the process tree and flows below are ' +
  `${LEGACY_RESULTS_SOURCE} and may differ from what the run computed. Re-run the assessment to freeze them.`;

// "EPA eGRID 2023 US national average (0.350 kg CO2e/kWh) [EGRID-2023]; added by
// audit 2026-09-09" → "EPA eGRID 2023 US national average": the citation a
// reader needs, once each, in a stable order.
function shortSources(raw: string[]): string[] {
  const seen = new Set<string>()
  for (const r of raw) {
    const short = String(r ?? '').split(/\s\(|\s\[|;/)[0].trim()
    if (short) seen.add(short)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { runId: runIdParam } = await params;
    const runId = parseId(runIdParam);

    // format=pdf (default) | pptx — committees often want an editable deck.
    const format = (new URL(request.url).searchParams.get('format') || 'pdf').toLowerCase();
    if (!FORMATS.has(format)) {
      return NextResponse.json({ error: `Unknown export format "${format.slice(0, 16)}": use pdf, pptx or csv` }, { status: 400 });
    }

    // 1. Get assessment run with case and project info
    const assessment = await queryOne<any>(
      `SELECT ar.*, ct.case_name, ct.case_type, ct.description as case_description,
              p.project_id, p.project_name, p.description as project_description,
              a.username as executed_by_username,
              owner.username as owner_username,
              p.created_at as project_created_at
       FROM assessment_runs ar
       JOIN case_table ct ON ar.case_id = ct.case_id
       JOIN project p ON ct.project_id = p.project_id
       LEFT JOIN account a ON ar.executed_by = a.id
       LEFT JOIN account owner ON p.owner_id = owner.id
       WHERE ar.run_id = ?`,
      [runId]
    );

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Exports carry the full report; require at least viewer access on the
    // owning project (this was the one resource route without the check).
    const denied = await projectAccessDenied(userId, assessment.project_id, 'viewer', {
      notFound: 'Assessment not found',
    });
    if (denied) return denied;

    // 2-5. The inventory and results the report prints. A frozen run
    // (snapshot v3) reads all of it from the snapshot: the tree, stages, costs
    // and flows as they were when the run was made (EXP-1). A run made before
    // that reads the live tables and the report says so beside them.
    const snapshot = parseRunSnapshot(assessment.run_snapshot);
    const frozen = snapshotReportParts(snapshot);

    let components: any[];
    let results: any[];
    let totalImpacts: Array<{ category_name: string; total_value: number; unit: string }>;
    let flows: any[];
    if (frozen) {
      ({ components, results, flows } = frozen);
      totalImpacts = frozen.total_impacts;
    } else {
      // The life-cycle stage comes along so the report can split the result by
      // stage; a database without migrate-022 falls back and every step reads
      // as production.
      const componentSql = (withStage: boolean) =>
        `SELECT component_id, component_name, component_type, hierarchy_level,
                quantity, unit, opex, capex${withStage ? ', life_cycle_stage' : ''}
         FROM component
         WHERE case_id = ?
         ORDER BY hierarchy_level, component_id`;
      try {
        components = await query<any>(componentSql(true), [assessment.case_id]);
      } catch (stageErr: any) {
        if (stageErr?.code !== 'ER_BAD_FIELD_ERROR') throw stageErr;
        components = await query<any>(componentSql(false), [assessment.case_id]);
      }

      results = await query<any>(
        `SELECT ar.component_id, COALESCE(c.component_name, 'Removed step') AS component_name,
                ic.category_name, ar.impact_value, ar.unit
         FROM assessment_results ar
         LEFT JOIN component c ON ar.component_id = c.component_id
         JOIN impact_categories ic ON ar.category_id = ic.category_id
         WHERE ar.run_id = ?
         ORDER BY ic.category_name, c.hierarchy_level`,
        [runId]
      );

      totalImpacts = (
        await query<any>(
          `SELECT ic.category_name, SUM(ar.impact_value) as total_value, ar.unit
           FROM assessment_results ar
           JOIN impact_categories ic ON ar.category_id = ic.category_id
           WHERE ar.run_id = ?
           GROUP BY ic.category_id, ic.category_name, ar.unit
           ORDER BY total_value DESC`,
          [runId]
        )
      ).map((r: any) => ({
        category_name: r.category_name,
        total_value: parseFloat(r.total_value),
        unit: r.unit,
      }));

      flows = await query<any>(
        `SELECT c.component_id, c.component_name, s.substance_name,
                f.flow_type AS direction, f.quantity AS amount, f.unit
         FROM flows f
         JOIN component c ON f.component_id = c.component_id
         JOIN substances s ON f.substance_id = s.substance_id
         WHERE c.case_id = ?
         ORDER BY c.hierarchy_level, c.component_id, f.flow_type`,
        [assessment.case_id]
      );
    }

    // 6. Data sources for attribution. These two lookups touch columns/tables
    // that vary across environments (schema drift left some DBs without
    // `driver_impact_factors.source_reference` or the `cost_rates` table). They
    // are attribution niceties, not core report data, so make them best-effort:
    // a failed lookup yields an empty source list rather than 500-ing the whole
    // export. The real impact-factor source is `data_source`.
    const methodName: string = assessment.calculation_method ?? 'CML 2001';
    const regionCode: string = assessment.region_code ?? 'Global';

    // Prod schema: driver_impact_factors uses source_reference + geographic_scope
    // (NOT data_source / geographic_region). Wrapped so attribution never blocks
    // the export.
    let factorSources: any[] = [];
    try {
      // Only the factors this case's own flows can use under this run's
      // method. Joining on category alone listed every source in the whole
      // factor library (hundreds of lines on one slide).
      factorSources = await query<any>(
        `SELECT DISTINCT dif.source_reference
           FROM flows f
           JOIN component c ON c.component_id = f.component_id
           JOIN assessment_runs r ON r.case_id = c.case_id AND r.run_id = ?
           JOIN driver_impact_factors dif
             ON dif.substance_id = f.substance_id AND dif.method_name = r.calculation_method
          WHERE dif.geographic_scope IN (?, 'global', 'Global')
            AND dif.source_reference IS NOT NULL
            AND dif.factor_value <> 0`,
        [runId, regionCode],
      );
    } catch {
      factorSources = [];
    }

    let costSources: any[] = [];
    try {
      costSources = await query<any>(
        `SELECT DISTINCT source FROM cost_rates
           WHERE region_code IN (?, 'Global') ORDER BY source`,
        [regionCode],
      );
    } catch {
      costSources = [];
    }

    // The author's own interpretation and assumptions (ISO 14044 5.1). Asked
    // for separately and tolerantly: a database that has not run migration 021
    // still exports a report, just without these two sections filled in.
    let writeup: { interpretation?: string | null; assumptions?: string | null } = {};
    try {
      writeup =
        (await queryOne<any>(
          'SELECT interpretation, assumptions FROM case_table WHERE case_id = ?',
          [assessment.case_id],
        )) ?? {};
    } catch (err: any) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    }

    // 7. Build report data
    const reportData: ReportData = {
      goal_scope: snapshot?.goal_scope ?? null,
      data_quality: snapshot?.data_quality ?? null,
      interpretation: writeup.interpretation ?? null,
      assumptions: writeup.assumptions ?? null,
      project: {
        project_id: assessment.project_id,
        project_name: assessment.project_name,
        description: assessment.project_description,
        owner_username: assessment.owner_username ?? 'Removed account',
        created_at: assessment.project_created_at,
      },
      case_info: {
        case_id: assessment.case_id,
        case_name: assessment.case_name,
        case_type: assessment.case_type,
        case_description: assessment.case_description,
      },
      assessment: {
        run_id: assessment.run_id,
        run_name: assessment.run_name,
        // Canonical timestamp column is `run_at`; `run_date` is a missing alias
        // in some DBs. Fall back so the report always shows a date.
        run_at: assessment.run_at ?? assessment.run_date,
        calculation_method: assessment.calculation_method || 'CML 2001',
        executed_by_username: assessment.executed_by_username ?? 'Removed account',
      },
      components,
      results,
      total_impacts: totalImpacts,
      flows,
      inventory_note: frozen ? null : LEGACY_INVENTORY_NOTE,
      dataSources: {
        valuation_method: methodName,
        region_code: regionCode,
        impact_factor_sources: shortSources(
          snapshot?.flow_detail?.length
            ? snapshot.flow_detail.map((f) => f.source ?? '')
            : (factorSources as any[]).map((r) => r.source_reference),
        ),
        cost_rate_sources: (costSources as any[]).map(r => r.source).filter(Boolean),
      },
    };

    const safeName = assessment.project_name.replace(/[^a-zA-Z0-9]/g, '_');

    // 7a0. Row-level CSV: the inventory as the engine computed it, one line per
    // flow x category, with the factor, its source and the arithmetic. This is
    // what a student pastes into a write-up or checks in a spreadsheet, and
    // what a reviewer asks for when they doubt a number.
    if (format === 'csv') {
      // Stage per step id (STAGE-2): from the frozen steps for a v3 run, from
      // the live steps (and said so in the file) for an older one.
      const stageById = new Map<number, string | null>();
      const stageByName = new Map<string, string | null>();
      for (const c of components) {
        stageById.set(Number(c.component_id), c.life_cycle_stage ?? null);
        if (!stageByName.has(c.component_name)) stageByName.set(c.component_name, c.life_cycle_stage ?? null);
      }
      const unitByCategory = new Map(totalImpacts.map((t) => [t.category_name, t.unit]));
      const body = buildInventoryCsv({
        runId,
        projectName: reportData.project.project_name,
        caseName: reportData.case_info.case_name,
        method: methodName,
        region: regionCode,
        functionalUnit: reportData.goal_scope?.functional_unit ?? null,
        exportedAt: new Date().toISOString(),
        rows: snapshot?.flow_detail ?? [],
        stageFor: (f) =>
          f.component_id != null && stageById.has(f.component_id)
            ? stageById.get(f.component_id) ?? null
            : stageByName.get(f.component) ?? null,
        unitFor: (category) => unitByCategory.get(category) ?? null,
        note: frozen ? null : `Life-cycle stages ${LEGACY_RESULTS_SOURCE}: this run predates frozen stages.`,
      });

      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="LCAPIX_inventory_${safeName}_${runId}.csv"`,
        },
      });
    }

    // 7a. PowerPoint export — generate and stream a .pptx deck.
    if (format === 'pptx' || format === 'ppt') {
      const pptxBuffer = await generateAssessmentPPTX(reportData);
      return new NextResponse(new Uint8Array(pptxBuffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="LCAPIX_Report_${safeName}_${runId}.pptx"`,
          'Content-Length': String(pptxBuffer.length),
        },
      });
    }

    // 7b. Generate PDF (default)
    const doc = generateAssessmentPDF(reportData);

    // 8. Stream response
    const chunks: Buffer[] = [];

    return new Promise<NextResponse>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);

        const filename = `LCAPIX_Report_${assessment.project_name.replace(/[^a-zA-Z0-9]/g, '_')}_${runId}.pdf`;

        resolve(
          new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': String(pdfBuffer.length),
            },
          })
        );
      });
      doc.on('error', reject);
      doc.end();
    });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // The error text can carry SQL, schema or host details: log it, never send it (L1).
    console.error('PDF export error:', error);
    return NextResponse.json({ error: 'Failed to generate the report' }, { status: 500 });
  }
}
