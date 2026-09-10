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
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { generateAssessmentPDF, type ReportData } from '@/lib/pdf-generator';
import { generateAssessmentPPTX } from '@/lib/pptx-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { runId: runIdParam } = await params;
    const runId = parseInt(runIdParam);

    // format=pdf (default) | pptx — committees often want an editable deck.
    const format = (new URL(request.url).searchParams.get('format') || 'pdf').toLowerCase();

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
       JOIN account a ON ar.executed_by = a.id
       JOIN account owner ON p.owner_id = owner.id
       WHERE ar.run_id = ?`,
      [runId]
    );

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Exports carry the full report; require at least viewer access on the
    // owning project (this was the one resource route without the check).
    const hasAccess = await checkProjectAccess(userId, assessment.project_id, 'viewer');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 2. Get all components for the case
    const components = await query<any>(
      `SELECT component_id, component_name, component_type, hierarchy_level,
              quantity, unit, opex, capex
       FROM component
       WHERE case_id = ?
       ORDER BY hierarchy_level, component_id`,
      [assessment.case_id]
    );

    // 3. Get assessment results
    const results = await query<any>(
      `SELECT c.component_name, ic.category_name, ar.impact_value, ar.unit
       FROM assessment_results ar
       JOIN component c ON ar.component_id = c.component_id
       JOIN impact_categories ic ON ar.category_id = ic.category_id
       WHERE ar.run_id = ?
       ORDER BY ic.category_name, c.hierarchy_level`,
      [runId]
    );

    // 4. Get total impacts aggregated by category
    const totalImpacts = await query<any>(
      `SELECT ic.category_name, SUM(ar.impact_value) as total_value, ar.unit
       FROM assessment_results ar
       JOIN impact_categories ic ON ar.category_id = ic.category_id
       WHERE ar.run_id = ?
       GROUP BY ic.category_id, ic.category_name, ar.unit
       ORDER BY total_value DESC`,
      [runId]
    );

    // 5. Get all flows for the case. The live `flows` table uses `direction`
    // and `amount` columns (a prior migration renamed them from
    // flow_type/quantity); querying the old names 500'd the export.
    const flows = await query<any>(
      `SELECT c.component_name, s.substance_name,
              f.flow_type AS direction, f.quantity AS amount, f.unit
       FROM flows f
       JOIN component c ON f.component_id = c.component_id
       JOIN substances s ON f.substance_id = s.substance_id
       WHERE c.case_id = ?
       ORDER BY c.hierarchy_level, c.component_id, f.flow_type`,
      [assessment.case_id]
    );

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
      factorSources = await query<any>(
        `SELECT DISTINCT dif.source_reference
           FROM assessment_results ar
           JOIN driver_impact_factors dif ON dif.category_id = ar.category_id
          WHERE ar.run_id = ?
            AND dif.geographic_scope IN (?, 'global', 'Global')
            AND dif.source_reference IS NOT NULL`,
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

    // 7. Build report data
    const reportData: ReportData = {
      project: {
        project_id: assessment.project_id,
        project_name: assessment.project_name,
        description: assessment.project_description,
        owner_username: assessment.owner_username,
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
        executed_by_username: assessment.executed_by_username,
      },
      components: components as any[],
      results: results as any[],
      total_impacts: (totalImpacts as any[]).map(r => ({
        category_name: r.category_name,
        total_value: parseFloat(r.total_value),
        unit: r.unit,
      })),
      flows: flows as any[],
      dataSources: {
        valuation_method: methodName,
        region_code: regionCode,
        impact_factor_sources: (factorSources as any[]).map(r => r.source_reference).filter(Boolean),
        cost_rate_sources: (costSources as any[]).map(r => r.source).filter(Boolean),
      },
    };

    const safeName = assessment.project_name.replace(/[^a-zA-Z0-9]/g, '_');

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
    if (error.message === 'No authentication token provided' || error.message === 'Invalid or expired token') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report', details: error.message },
      { status: 500 }
    );
  }
}
