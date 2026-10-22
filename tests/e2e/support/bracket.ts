/**
 * The bracket study (tests/fixtures/bracket-study.ts) built through the app's
 * own HTTP API in one account: the project and its question, the base case
 * per 1 bracket, its 17 steps with their stages, the flows and the costs, and
 * a run. The commercial version has no sample study, so this is how the
 * journeys get a finished case whose numbers are known: 1.72 kg CO2-eq per
 * bracket (TRACI 2.1 / US).
 *
 * One line differs from the API suite's database builder: "Packaging tape,
 * 1 roll" is left out. The API refuses a unit its factor cannot take (only a
 * document import records one), and no journey reads that line.
 */
import type { Api } from './api';
import { SAMPLE_BASE_CASE, SAMPLE_PROJECT, SAMPLE_STEPS, type SampleCost } from '../../fixtures/bracket-study';

export type Bracket = {
  projectId: number;
  baseCaseId: number;
  baseRunId: number;
  /** Step ids by name ("10. Cut blank" → id). */
  steps: Map<string, number>;
};

/** A library substance by name: the name itself, or "<name> (library)". */
function substanceIdOf(subs: Array<{ substance_id: number; substance_name: string; is_custom?: unknown }>, name: string): number {
  const library = subs.filter((s) => !Number(s.is_custom ?? 0));
  const hit = library.find((s) => s.substance_name === name) ?? library.find((s) => s.substance_name === `${name} (library)`);
  if (!hit) throw new Error(`bracket: the library has no "${name}"`);
  return hit.substance_id;
}

/** The costs route body for one cost line: reference rates by lookup, the rest as entered. */
function costBody(c: SampleCost): Record<string, unknown> {
  if (c.source === 'entered') return { kind: c.kind, mode: 'entered', amount: c.amount, rate_label: c.label };
  if ((c.kind === 'labor' || c.kind === 'energy') && c.rateCode) {
    return {
      kind: c.kind,
      mode: 'lookup',
      prefer: 'reference',
      rate_code: c.rateCode,
      region: 'US',
      driver_quantity: c.driver,
      ...(c.kind === 'energy' ? { driver_unit: c.driverUnit } : {}),
    };
  }
  return {
    kind: c.kind,
    mode: 'entered',
    driver_quantity: c.driver,
    driver_unit: c.driverUnit,
    rate: c.rate,
    rate_unit: c.rateUnit,
    rate_label: c.rateLabel,
  };
}

export async function buildBracket(as: Api, projectName: string = SAMPLE_PROJECT.name): Promise<Bracket> {
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', {
    project_name: projectName,
    description: SAMPLE_PROJECT.description,
  })).project.project_id;
  await as.put(`/api/projects/${projectId}`, {
    lcia_method: SAMPLE_PROJECT.method,
    region_code: SAMPLE_PROJECT.region,
    goal_statement: SAMPLE_PROJECT.goal,
    functional_unit: SAMPLE_PROJECT.functionalUnit,
    system_boundary: SAMPLE_PROJECT.boundary,
    boundary_notes: SAMPLE_PROJECT.boundaryNotes,
  });
  const baseCaseId = (await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, {
    case_name: SAMPLE_BASE_CASE.name,
    case_type: 'base',
    description: 'The bracket as it is made today.',
  })).case.case_id;
  await as.put(`/api/cases/${baseCaseId}`, {
    reference_flow: SAMPLE_BASE_CASE.referenceFlow,
    reference_flow_unit: SAMPLE_BASE_CASE.referenceFlowUnit,
  });

  const subs = (await as.get<{ substances: Array<{ substance_id: number; substance_name: string; is_custom?: unknown }> }>('/api/substances')).substances;
  const steps = new Map<string, number>();
  for (const s of SAMPLE_STEPS) {
    const parent = s.parent ? steps.get(s.parent) : null;
    if (s.parent && parent == null) throw new Error(`bracket: ${s.name} comes before its parent`);
    const id = (await as.post<{ component: { component_id: number } }>(`/api/cases/${baseCaseId}/components`, {
      component_name: s.name,
      component_type: s.tier,
      parent_component_id: parent ?? null,
      quantity: s.quantity ?? 1,
      unit: s.unit ?? 'unit',
      ...(s.description ? { description: s.description } : {}),
      ...(s.stage ? { life_cycle_stage: s.stage } : {}),
    })).component.component_id;
    steps.set(s.name, id);
    for (const f of s.flows ?? []) {
      if (f.unit === 'roll') continue; // see the file comment
      await as.post(`/api/components/${id}/flows`, {
        substance_id: substanceIdOf(subs, f.substance),
        flow_type: f.direction,
        quantity: f.quantity,
        unit: f.unit,
      });
    }
    for (const c of s.costs ?? []) await as.put(`/api/components/${id}/costs`, costBody(c));
  }

  const run = await as.post<{ run_id: number }>(`/api/cases/${baseCaseId}/assessments`, { run_name: 'Assessment' });
  return { projectId, baseCaseId, baseRunId: run.run_id, steps };
}
