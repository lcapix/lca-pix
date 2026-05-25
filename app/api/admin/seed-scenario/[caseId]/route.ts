// One-shot scenario reseeder. Given a case + scenario id, re-scales the
// latest assessment_results so the comp case shows realistic per-category
// deltas (not a uniform 0.72 across the board). Also renames the substituted
// component and rewrites the case description to explain the variant.
import { NextRequest, NextResponse } from 'next/server';
import { execute, query, queryOne } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

interface Scenario {
  description: string;
  /** Per-category multipliers vs the base case (1.0 = no change). */
  categoryScales: Record<string, number>;
  /**
   * Component swaps: { fromContains: 'Steel Sheet', to: 'Recycled Steel Sheet' }
   * runs on this case's components and renames the first match.
   */
  swaps?: { fromContains: string; to: string }[];
}

const SCENARIOS: Record<string, Scenario> = {
  'recycled-steel': {
    description:
      'Substitutes virgin steel sheet with 95% post-consumer recycled steel from a secondary EAF mill. Saves significant GWP from avoided iron-ore reduction, with a small smog/acidification trade-off from secondary-mill electricity.',
    categoryScales: {
      'Global warming': 0.35, // -65%: huge cut from no blast furnace
      'Ozone depletion': 0.98, // ~unchanged
      'Smog formation': 1.18, // +18%: more secondary-mill NOx
      'Acidification': 0.78, // -22%: less mining SO2
      'Particulate matter': 0.5, // -50%: less mining dust
    },
    swaps: [
      { fromContains: 'Steel Sheet', to: 'Recycled Steel Sheet (95% PCR)' },
      {
        fromContains: 'Sheet Metal Stamping',
        to: 'Sheet Metal Stamping (recycled stock)',
      },
      {
        fromContains: 'Metal Cutting',
        to: 'Recycled Steel Cutting',
      },
    ],
  },
  'powder-coating': {
    description:
      'Replaces solvent-based spray paint with electrostatic powder coating. Cuts VOC emissions and paint waste dramatically, but the curing oven adds energy load — net win on toxicity, modest win on GWP.',
    categoryScales: {
      'Global warming': 0.82, // -18%: net energy slightly higher, but no solvent
      'Ozone depletion': 0.4, // -60%: no VOC solvents
      'Smog formation': 0.45, // -55%: VOC reduction
      'Acidification': 0.95, // small change
      'Particulate matter': 0.6, // -40%: less overspray
    },
    swaps: [
      { fromContains: 'Spray Paint', to: 'Powder Coat (electrostatic)' },
      {
        fromContains: 'Paint Application',
        to: 'Powder Coat Application + Cure',
      },
    ],
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);
    const { scenario: scenarioId } = await request.json();
    const scenario = SCENARIOS[scenarioId as string];
    if (!scenario) {
      return NextResponse.json(
        {
          error: 'Unknown scenario',
          available: Object.keys(SCENARIOS),
        },
        { status: 400 },
      );
    }

    const targetCase = await queryOne<any>(
      `SELECT project_id, case_name FROM case_table WHERE case_id = ?`,
      [caseId],
    );
    if (!targetCase)
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const hasAccess = await checkProjectAccess(
      userId,
      targetCase.project_id,
      'editor',
    );
    if (!hasAccess)
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // 1. Rewrite the description so users understand what this case represents.
    await execute(
      `UPDATE case_table SET description = ? WHERE case_id = ?`,
      [scenario.description, caseId],
    );

    // 2. Apply component renames (just the first match for each swap).
    let renamed = 0;
    for (const swap of scenario.swaps ?? []) {
      const match = await queryOne<any>(
        `SELECT component_id FROM component
          WHERE case_id = ? AND component_name LIKE ?
          ORDER BY component_id LIMIT 1`,
        [caseId, `%${swap.fromContains}%`],
      );
      if (match) {
        await execute(
          `UPDATE component SET component_name = ? WHERE component_id = ?`,
          [swap.to, match.component_id],
        );
        renamed++;
      }
    }

    // 3. Re-scale the latest run's results per category — idempotently.
    // We look up the matching base-case result row (same component, same
    // category) and set target = base.value * scenarioScale. That way running
    // the seeder twice in a row produces the same numbers.
    const baseCase = await queryOne<any>(
      `SELECT case_id FROM case_table
        WHERE project_id = ? AND case_type = 'base' LIMIT 1`,
      [targetCase.project_id],
    );
    const latestRun = await queryOne<any>(
      `SELECT run_id FROM assessment_runs
        WHERE case_id = ? AND status = 'completed'
        ORDER BY run_at DESC LIMIT 1`,
      [caseId],
    );
    const baseRun = baseCase
      ? await queryOne<any>(
          `SELECT run_id FROM assessment_runs
            WHERE case_id = ? AND status = 'completed'
            ORDER BY run_at DESC LIMIT 1`,
          [baseCase.case_id],
        )
      : null;
    let rescaledRows = 0;
    if (latestRun && baseRun) {
      const targetRows = await query<any>(
        `SELECT ar.result_id, ar.component_id, ar.category_id, c.component_name,
                ic.category_name
           FROM assessment_results ar
           JOIN component c          ON c.component_id = ar.component_id
           JOIN impact_categories ic ON ic.category_id = ar.category_id
          WHERE ar.run_id = ?`,
        [latestRun.run_id],
      );
      // Index base values by (component_name, category_id) so we don't depend
      // on the cloned component_id mapping that may have drifted.
      const baseRowsRaw = await query<any>(
        `SELECT c.component_name, ar.category_id, ar.impact_value
           FROM assessment_results ar
           JOIN component c ON c.component_id = ar.component_id
          WHERE ar.run_id = ?`,
        [baseRun.run_id],
      );
      const baseByKey = new Map<string, number>();
      for (const r of baseRowsRaw) {
        baseByKey.set(
          `${r.component_name}::${r.category_id}`,
          Number(r.impact_value),
        );
      }
      for (const t of targetRows) {
        // The renames we just applied won't appear in baseByKey, so strip the
        // suffix to find the original component name.
        const candidates = [
          t.component_name,
          t.component_name.replace(/ \(.+\)$/, ''),
          t.component_name
            .replace('Recycled Steel Sheet (95% PCR)', 'Steel Sheet')
            .replace('Sheet Metal Stamping (recycled stock)', 'Sheet Metal Stamping')
            .replace('Recycled Steel Cutting', 'Metal Cutting')
            .replace('Powder Coat (electrostatic)', 'Spray Paint')
            .replace('Powder Coat Application + Cure', 'Paint Application'),
        ];
        let baseVal: number | undefined;
        for (const name of candidates) {
          const v = baseByKey.get(`${name}::${t.category_id}`);
          if (v != null) {
            baseVal = v;
            break;
          }
        }
        if (baseVal == null) continue;
        const scale = scenario.categoryScales[t.category_name] ?? 1.0;
        const next = baseVal * scale;
        await execute(
          `UPDATE assessment_results SET impact_value = ? WHERE result_id = ?`,
          [next, t.result_id],
        );
        rescaledRows++;
      }
    }

    return NextResponse.json({
      success: true,
      caseId,
      scenario: scenarioId,
      renamed,
      rescaledRows,
    });
  } catch (error: any) {
    if (
      error.message === 'Unauthorized' ||
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token' ||
      error.message === 'User account not found or inactive'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Seed-scenario error:', error);
    return NextResponse.json(
      { error: 'Failed to seed scenario' },
      { status: 500 },
    );
  }
}
