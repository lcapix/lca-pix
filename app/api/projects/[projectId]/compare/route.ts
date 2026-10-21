import { NextRequest, NextResponse } from 'next/server';
import { COMPARE_MAX_CASES } from '@/lib/compare/comparability';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied, reachableCasesFilter } from '@/lib/route-guard';
import { hasFrozenResults, parseRunSnapshot } from '@/lib/run-snapshot';
import {
  diffInventories,
  diffScope,
  type CaseInventory,
  type CostKey,
  type RunScope,
} from '@/lib/compare/diff';
import { compareStatus, runResults, snapshotDrift, type LegacyRunRows } from '@/lib/compare/run-results';
import { parseId } from '@/lib/ids';
import { editedAfterRun } from '@/lib/runs/stale';
import { inRunOrder, newestRunIds, placeholders } from '@/lib/runs/newest-first';
import { describeOwnFactors } from '@/lib/factor-override';

// GET /api/projects/[projectId]/compare?cases=209,212[&base=209][&runs=209:173,212:176]
//
// Everything Compare Cases shows, in one read: for each case the run it is
// compared on, that run's results per functional unit (totals, per step with
// the step costs, per exchange), its data-quality summary, whether the case can
// be ranked at all (status), and what differs from the base (scope and
// inventory). A frozen run (snapshot v3) answers from its snapshot only; an
// older run falls back to its stored result rows and says so (resultsSource).
//
// Which run: a copy uses its latest completed run. The base uses the run whose
// method and region match the copies (so a grid try on the base does not leak
// into a material comparison), else the study's own method and region, else
// its latest. `runs` overrides any of these.

const MAX_CASES = COMPARE_MAX_CASES;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: 'Invalid project' }, { status: 400 });
    }
    // Any member may compare; to anyone else the project does not exist.
    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;

    const sp = request.nextUrl.searchParams;
    const requested = Array.from(
      new Set(
        (sp.get('cases') ?? '')
          .split(',')
          .map((x) => parseId(x))
          .filter((x) => Number.isFinite(x))
      )
    );
    // At most MAX_CASES; the answer says how many were left out, never silently.
    const ids = requested.slice(0, MAX_CASES);
    const leftOut = requested.length - ids.length;
    if (!ids.length) {
      return NextResponse.json({ error: 'Pick at least one case' }, { status: 400 });
    }
    const runOverrides = new Map<number, number>();
    for (const pair of (sp.get('runs') ?? '').split(',')) {
      const [c, r] = pair.split(':').map((x) => parseId(x));
      if (Number.isFinite(c) && Number.isFinite(r)) runOverrides.set(c, r);
    }

    const project = await queryOne<any>(`SELECT * FROM project WHERE project_id = ?`, [projectId]);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // A case the caller cannot reach (B-A1) is left out like a missing id.
    const only = await reachableCasesFilter(userId, projectId, 'case_table');
    const caseRows = await query<any>(
      `SELECT * FROM case_table WHERE project_id = ? AND case_id IN (${ids.map(() => '?').join(',')})${only.sql}`,
      [projectId, ...ids, ...only.params]
    );
    const cases = ids.map((id) => caseRows.find((c: any) => c.case_id === id)).filter(Boolean) as any[];
    if (!cases.length) {
      return NextResponse.json({ error: 'No such cases in this project' }, { status: 404 });
    }
    const baseParam = parseId(sp.get('base') ?? '');
    const base =
      cases.find((c) => c.case_id === baseParam) ??
      cases.find((c) => c.case_type === 'base') ??
      cases[0];

    // Completed runs, newest first.
    const runsByCase = new Map<number, any[]>();
    // Ids sorted alone, rows read by id: sorting rows that carry their
    // snapshot fails on a large case (lib/runs/newest-first).
    for (const c of cases) {
      const ids = await newestRunIds(Number(c.case_id), { status: 'completed-or-unset' });
      const runs = ids.length
        ? inRunOrder(
            ids,
            await query<any>(
              `SELECT run_id, calculation_method, region_code, run_date, run_snapshot
                 FROM assessment_runs WHERE run_id IN (${placeholders(ids.length)})`,
              ids,
            ),
          )
        : [];
      runsByCase.set(c.case_id, runs);
    }

    const chosen = new Map<number, { run: any | null; reason: string }>();
    const pickOverride = (caseId: number) => {
      const want = runOverrides.get(caseId);
      return want ? (runsByCase.get(caseId) ?? []).find((r) => r.run_id === want) ?? null : null;
    };
    for (const c of cases) {
      if (c === base) continue;
      const o = pickOverride(c.case_id);
      const runs = runsByCase.get(c.case_id) ?? [];
      chosen.set(c.case_id, o ? { run: o, reason: 'picked' } : { run: runs[0] ?? null, reason: 'latest' });
    }
    {
      const runs = runsByCase.get(base.case_id) ?? [];
      const o = pickOverride(base.case_id);
      const scopes = new Set(
        Array.from(chosen.values())
          .map((x) => x.run)
          .filter(Boolean)
          .map((r) => `${r.calculation_method}|${r.region_code}`)
      );
      const match = (key: string) => runs.find((r) => `${r.calculation_method}|${r.region_code}` === key) ?? null;
      const copiesScope = scopes.size === 1 ? match(Array.from(scopes)[0]) : null;
      const studyScope = match(`${project.lcia_method}|${project.region_code}`);
      chosen.set(
        base.case_id,
        o
          ? { run: o, reason: 'picked' }
          : copiesScope
            ? { run: copiesScope, reason: 'matches-copies' }
            : studyScope
              ? { run: studyScope, reason: 'matches-study' }
              : { run: runs[0] ?? null, reason: 'latest' }
      );
    }

    const out: any[] = [];
    const inventories = new Map<number, CaseInventory>();
    const scopes = new Map<number, RunScope>();

    for (const c of cases) {
      const { run, reason } = chosen.get(c.case_id)!;
      const snapshot = run ? parseRunSnapshot(run.run_snapshot) : null;
      const gs = snapshot?.goal_scope ?? null;
      const scale = Number(gs?.per_fu_scale) > 0 ? Number(gs!.per_fu_scale) : 1;

      // Current inventory: steps with their names, paths and costs; exchanges.
      const comps = await query<any>(
        `SELECT component_id, parent_component_id, component_name, component_type, labor_hours,
                labor_cost, energy_cost, transportation_cost, material_cost, equipment_cost,
                overhead_cost, opex, capex
           FROM component WHERE case_id = ?`,
        [c.case_id]
      );
      const byId = new Map<number, any>(comps.map((k: any) => [k.component_id, k]));
      const pathOf = (k: any): string[] => {
        const names: string[] = [];
        const seen = new Set<number>();
        let cur = k;
        while (cur && !seen.has(cur.component_id)) {
          seen.add(cur.component_id);
          names.unshift(cur.component_name);
          cur = cur.parent_component_id ? byId.get(cur.parent_component_id) : null;
        }
        return names;
      };
      const costOf = (k: any): Record<CostKey, number> => ({
        material: num(k.material_cost),
        labor: num(k.labor_cost),
        energy: num(k.energy_cost),
        transportation: num(k.transportation_cost),
        equipment: num(k.equipment_cost),
        overhead: num(k.overhead_cost),
        opex: num(k.opex),
        capex: num(k.capex),
      });
      const flowRows = await query<any>(
        `SELECT f.flow_id, f.component_id, COALESCE(s.substance_name, CONCAT('Substance #', f.substance_id)) AS substance,
                f.flow_type, f.quantity, f.unit
           FROM flows f
           JOIN component k ON k.component_id = f.component_id
           LEFT JOIN substances s ON s.substance_id = f.substance_id
          WHERE k.case_id = ?`,
        [c.case_id]
      );
      // Each flow's own factors (migrate-034): a copy that changes only a
      // factor must not read as "nothing else changed".
      const ownByFlow = new Map<number, any[]>();
      try {
        const own = await query<any>(
          `SELECT o.flow_id, ic.category_name, o.factor_value, o.impact_unit, o.per_unit
             FROM flow_factor_overrides o
             JOIN flows f ON f.flow_id = o.flow_id
             JOIN component k ON k.component_id = f.component_id
             JOIN impact_categories ic ON ic.category_id = o.category_id
            WHERE k.case_id = ?`,
          [c.case_id]
        );
        for (const r of own) ownByFlow.set(Number(r.flow_id), [...(ownByFlow.get(Number(r.flow_id)) ?? []), r]);
      } catch (ownErr: any) {
        if (ownErr?.code !== 'ER_NO_SUCH_TABLE') throw ownErr;
      }
      inventories.set(c.case_id, {
        steps: comps.map((k: any) => ({
          id: String(k.component_id),
          path: pathOf(k),
          name: k.component_name,
          type: k.component_type,
          costs: costOf(k),
          laborHours: k.labor_hours === null || k.labor_hours === undefined ? null : num(k.labor_hours),
        })),
        flows: flowRows.map((f: any) => ({
          stepId: String(f.component_id),
          substance: f.substance,
          dir: f.flow_type === 'output' ? 'output' : 'input',
          quantity: f.quantity === null || f.quantity === undefined ? null : num(f.quantity),
          unit: f.unit ?? '',
          ownFactor: describeOwnFactors(ownByFlow.get(Number(f.flow_id)) ?? []),
        })),
      });

      scopes.set(c.case_id, {
        method: run?.calculation_method ?? null,
        region: run?.region_code ?? null,
        functionalUnit: gs?.functional_unit ?? project.functional_unit ?? null,
        boundary: gs?.system_boundary ?? project.system_boundary ?? null,
        referenceFlow: gs ? num(gs.reference_flow) : c.reference_flow != null ? num(c.reference_flow) : null,
        referenceFlowUnit: gs?.reference_flow_unit ?? c.reference_flow_unit ?? null,
        modeledOutput: gs ? num(gs.modeled_output) : c.modeled_output != null ? num(c.modeled_output) : null,
      });

      // Results of the run: frozen runs from the snapshot, older runs from
      // their stored rows (read only when needed).
      let legacy: LegacyRunRows | undefined;
      let stale = false;
      if (run) {
        if (!hasFrozenResults(snapshot)) {
          legacy = {
            totals: (
              await query<any>(
                `SELECT ic.category_name AS category, ar.unit, SUM(ar.impact_value) AS value
                   FROM assessment_results ar
                   JOIN impact_categories ic ON ic.category_id = ar.category_id
                  WHERE ar.run_id = ?
                  GROUP BY ic.category_name, ar.unit`,
                [run.run_id]
              )
            ).map((t: any) => ({ category: t.category, unit: t.unit, value: num(t.value) })),
            byStep: (
              await query<any>(
                `SELECT ar.component_id, ic.category_name AS category, SUM(ar.impact_value) AS value
                   FROM assessment_results ar
                   JOIN impact_categories ic ON ic.category_id = ar.category_id
                  WHERE ar.run_id = ?
                  GROUP BY ar.component_id, ic.category_name`,
                [run.run_id]
              )
            ).map((r: any) => ({
              componentId: r.component_id === null || r.component_id === undefined ? null : Number(r.component_id),
              category: r.category,
              value: num(r.value),
            })),
          };
        }
        // Edited after the run? Then its results no longer describe the case.
        // updated_at catches edits; a delete leaves nothing behind, so a frozen
        // run also compares its steps, flows and data basis with the case now.
        // An own factor set or changed after the run counts too (migrate-034);
        // a database without the table asks without it.
        stale =
          (await editedAfterRun(Number(run.run_id))) ||
          snapshotDrift(snapshot, {
            componentIds: comps.map((k: any) => Number(k.component_id)),
            flowIds: flowRows.map((f: any) => Number(f.flow_id)),
            referenceFlow: c.reference_flow ?? null,
            modeledOutput: c.modeled_output ?? null,
            ownFactorFlowIds: [...ownByFlow.keys()],
          });
      }
      const results = runResults({
        snapshot: run ? snapshot : null,
        scale,
        legacy,
        currentSteps: comps.map((k: any) => ({
          id: Number(k.component_id),
          name: k.component_name,
          costs: costOf(k),
        })),
      });
      const { status, reason: statusReason } = compareStatus({
        hasRun: !!run,
        currentFlows: flowRows.length,
        characterizedFlows: run ? results.characterizedFlows : null,
        zeroInventory: results.zeroInventory,
        editedSinceRun: stale,
      });

      out.push({
        caseId: String(c.case_id),
        name: c.case_name,
        type: c.case_type,
        isBase: c === base,
        run: run
          ? {
              runId: run.run_id,
              method: run.calculation_method,
              region: run.region_code,
              runDate: run.run_date,
              reason,
              stale,
              perFuScale: scale,
              functionalUnit: gs?.functional_unit ?? null,
              hasSnapshot: !!snapshot,
              resultsSource: results.source,
              costsSource: results.costsSource,
            }
          : null,
        status,
        statusReason,
        runs: (runsByCase.get(c.case_id) ?? []).map((r) => ({
          runId: r.run_id,
          method: r.calculation_method,
          region: r.region_code,
          runDate: r.run_date,
        })),
        totals: run ? results.totals : [],
        byStep: run ? results.byStep : [],
        flows: (snapshot?.flow_detail ?? []).map((r) => ({
          step: r.component,
          substance: r.substance,
          category: r.category_name,
          value: num(r.impact) * scale,
          tier: r.source_tier ?? null,
          scope: r.scope ?? null,
        })),
        dataQuality: snapshot?.data_quality ?? null,
        warnings: snapshot?.warnings ?? [],
        costs: results.costs,
        inventory: {
          steps: comps.length,
          flows: flowRows.length,
        },
        // What each step takes in and gives out now, by step name (E09's
        // "Steel 0.8 kg · Electricity 0.05 kWh" under each step).
        stepFlows: flowRows.map((f: any) => ({
          step: byId.get(f.component_id)?.component_name ?? '',
          substance: f.substance,
          dir: f.flow_type === 'output' ? 'output' : 'input',
          quantity: f.quantity === null || f.quantity === undefined ? null : num(f.quantity),
          unit: f.unit ?? '',
        })),
      });
    }

    const baseInv = inventories.get(base.case_id)!;
    const baseScope = scopes.get(base.case_id)!;
    const diffs = cases
      .filter((c) => c !== base)
      .map((c) => ({
        caseId: String(c.case_id),
        scope: diffScope(baseScope, scopes.get(c.case_id)!),
        inventory: diffInventories(baseInv, inventories.get(c.case_id)!),
      }));

    return NextResponse.json({
      success: true,
      project: {
        name: project.project_name,
        goal: project.goal_statement ?? null,
        functionalUnit: project.functional_unit ?? null,
        boundary: project.system_boundary ?? null,
        method: project.lcia_method ?? null,
        region: project.region_code ?? null,
      },
      baseCaseId: String(base.case_id),
      cases: out,
      diffs,
      limit: { maxCases: MAX_CASES, leftOut },
    });
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Compare cases error:', error);
    return NextResponse.json({ error: 'Failed to compare cases' }, { status: 500 });
  }
}
