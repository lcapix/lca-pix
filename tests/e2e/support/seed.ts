/**
 * The shared world every read-only spec (visual, a11y, contracts and the
 * read-only journeys) looks at. Built once per run, in a fixed order, through
 * the app's own HTTP API, on a database that was empty a moment before — so
 * ids and names come out the same on every run.
 *
 *   owner    Olivia Owner, onboarded
 *     P1  "Example: painted steel bracket" (POST /api/example-project, TRACI 2.1 / US)
 *         C1  base "Painted steel bracket"                     run R1
 *         C2  comparative "Painted steel bracket (lighter blank)" — duplicate of C1 with
 *             the Steel input cut from 0.8 to 0.6 kg              run R2
 *     P2  "Five-tier bicycle frame" (CML 2001 / Global)
 *         C5  base "Frame build": Product → Machine/Line → Subprocess → Operation → Elemental task
 *   viewer   Victor Viewer, onboarded, viewer on P1, not a member of P2
 *   empty    Emma Empty, onboarded, no projects (the empty dashboard)
 *   newcomer Nico Newcomer, signed up but not onboarded (the onboarding page)
 */
import type { APIRequestContext } from '@playwright/test';
import { Api, type ApiUser } from './api';

export type Seed = {
  baseURL: string;
  users: { owner: ApiUser; viewer: ApiUser; empty: ApiUser; newcomer: ApiUser };
  example: {
    projectId: number;
    projectName: string;
    baseCaseId: number;
    baseCaseName: string;
    compCaseId: number;
    compCaseName: string;
    baseRunId: number;
    compRunId: number;
    baseTotal: number;
    productId: number;
    /** The operation carrying the Steel + Electricity inputs. */
    cutBlankId: number;
  };
  fiveTier: {
    projectId: number;
    projectName: string;
    caseId: number;
    ids: { product: number; line: number; subprocess: number; operation: number; task: number };
  };
};

export const EXAMPLE_COMP_NAME = 'Painted steel bracket (lighter blank)';
export const FIVE_TIER_PROJECT = 'Five-tier bicycle frame';

type Component = { component_id: number; component_name: string; parent_component_id: number | null };

async function substanceId(api: Api, name: string): Promise<number> {
  const res = await api.get<{ substances: Array<{ substance_id: number; substance_name: string }> }>('/api/substances');
  const hit = res.substances.find((s) => s.substance_name === name);
  if (!hit) throw new Error(`seed: substance "${name}" is not in the library`);
  return hit.substance_id;
}

function globalWarming(totals: unknown): number {
  const rows = Array.isArray(totals) ? totals : Object.entries((totals ?? {}) as Record<string, any>).map(([k, v]) => ({ category_name: k, ...(typeof v === 'object' ? v : { total: v }) }));
  const gw = rows.find((r: any) => /global warming|climate/i.test(String(r.category_name ?? r.category ?? r.name ?? '')));
  const v = Number(gw?.total_impact ?? gw?.total ?? gw?.value ?? gw?.impact_value);
  return Number.isFinite(v) ? v : NaN;
}

export async function buildSeed(request: APIRequestContext, baseURL: string): Promise<Seed> {
  const anon = new Api(request, undefined, baseURL);

  const owner = await anon.createUser({ email: 'owner@e2e.lcapix.test', fullName: 'Olivia Owner' });
  const viewer = await anon.createUser({ email: 'viewer@e2e.lcapix.test', fullName: 'Victor Viewer' });
  const empty = await anon.createUser({ email: 'empty@e2e.lcapix.test', fullName: 'Emma Empty' });
  const newcomer = await anon.createUser({ email: 'newcomer@e2e.lcapix.test', fullName: 'Nico Newcomer', onboard: false });
  const api = anon.as(owner.token);

  // ── P1: the worked example, with its functional unit set and a run ─────────
  const ex = await api.post<{ project_id: number; case_id: number }>('/api/example-project');
  await api.put(`/api/projects/${ex.project_id}`, {
    functional_unit: '1 painted steel bracket, at the factory gate',
    system_boundary: 'cradle-to-gate',
  });
  const run1 = await api.post<{ run_id: number; total_impacts: unknown }>(`/api/cases/${ex.case_id}/assessments`, {
    run_name: 'Assessment',
  });

  const baseComponents = (await api.get<{ components: Component[] }>(`/api/cases/${ex.case_id}/components`)).components;
  const product = baseComponents.find((c) => c.parent_component_id == null)!;
  const cutBlank = baseComponents.find((c) => c.component_name === '10. Cut blank')!;

  // ── C2: duplicate, change one thing, run ──────────────────────────────────
  const dup = await api.post<{ case_id: number }>(`/api/cases/${ex.case_id}/duplicate`, { case_name: EXAMPLE_COMP_NAME });
  const compComponents = (await api.get<{ components: Component[] }>(`/api/cases/${dup.case_id}/components`)).components;
  const compCut = compComponents.find((c) => c.component_name === '10. Cut blank')!;
  const compFlows = (await api.get<{ flows: Array<{ flow_id: number; substance_name?: string; name?: string }> }>(
    `/api/components/${compCut.component_id}/flows`,
  )).flows;
  const steel = compFlows.find((f) => (f.substance_name ?? f.name) === 'Steel');
  if (!steel) throw new Error('seed: the duplicated case has no Steel flow on "10. Cut blank"');
  await api.put(`/api/flows/${steel.flow_id}`, { quantity: 0.6 });
  const run2 = await api.post<{ run_id: number }>(`/api/cases/${dup.case_id}/assessments`, { run_name: 'Assessment' });

  // ── P2: a five-tier tree ──────────────────────────────────────────────────
  const p2 = (await api.post<{ project: { project_id: number } }>('/api/projects', {
    project_name: FIVE_TIER_PROJECT,
    description: 'Every tier of the process hierarchy, one level each.',
  })).project.project_id;
  await api.put(`/api/projects/${p2}`, {
    lcia_method: 'CML 2001',
    region_code: 'Global',
    functional_unit: '1 bicycle frame',
    system_boundary: 'cradle-to-gate',
  });
  const c5 = (await api.post<{ case: { case_id: number } }>(`/api/projects/${p2}/cases`, {
    case_name: 'Frame build',
    case_type: 'base',
    description: 'Five tiers, one step each.',
  })).case.case_id;
  const add = async (name: string, type: string, parent: number | null, quantity = 1, unit = 'unit') =>
    (await api.post<{ component: { component_id: number } }>(`/api/cases/${c5}/components`, {
      component_name: name,
      component_type: type,
      parent_component_id: parent,
      quantity,
      unit,
    })).component.component_id;
  const t1 = await add('Bicycle frame', 'product', null);
  const t2 = await add('Frame line', 'machine_line', t1);
  const t3 = await add('Tube preparation', 'subprocess', t2);
  const t4 = await add('Cut tubes', 'operation', t3);
  const t5 = await add('Saw cut', 'elemental_task', t4);
  const electricity = await substanceId(api, 'Electricity');
  await api.post(`/api/components/${t5}/flows`, { substance_id: electricity, flow_type: 'input', quantity: 0.25, unit: 'kWh' });

  // ── Membership: the viewer can read P1 only ───────────────────────────────
  await api.post(`/api/projects/${ex.project_id}/members`, { email: viewer.email, role: 'viewer' });

  const baseCase = await api.get<{ case: { case_name: string } }>(`/api/cases/${ex.case_id}`);
  return {
    baseURL,
    users: { owner, viewer, empty, newcomer },
    example: {
      projectId: ex.project_id,
      projectName: 'Example: painted steel bracket',
      baseCaseId: ex.case_id,
      baseCaseName: baseCase.case?.case_name ?? 'Painted steel bracket',
      compCaseId: dup.case_id,
      compCaseName: EXAMPLE_COMP_NAME,
      baseRunId: run1.run_id,
      compRunId: run2.run_id,
      baseTotal: globalWarming(run1.total_impacts),
      productId: product.component_id,
      cutBlankId: cutBlank.component_id,
    },
    fiveTier: {
      projectId: p2,
      projectName: FIVE_TIER_PROJECT,
      caseId: c5,
      ids: { product: t1, line: t2, subprocess: t3, operation: t4, task: t5 },
    },
  };
}
