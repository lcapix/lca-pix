/**
 * The standard world (docs/flows/TEST_PLAN.md §2.3), built through the API,
 * with SQL only where no API exists (platform admin, deactivation, a legacy
 * comparison row, a password-hash change).
 *
 *   P      "E2E Coffee Mug LCA" owned by `owner`; members editor / viewer /
 *          adminm (admin), plus `deactivated` and `revoked` as editors (so a
 *          401 for them can only come from authentication)
 *   P.base "Standard Production": Ceramic Coffee Mug (350ml) → Forming Line →
 *          Slip Casting → Mold Filling (Natural Gas 1.8 m3) → Mold Cleaning
 *          (Electricity 2.5 kWh); one completed CML 2001 / US run
 *   P.comp "Recycled Clay Variant": duplicate of base, Electricity 1.6,
 *          Natural Gas 1.1, one run
 *   Q      userB's project "Bamboo Bikes (B)": one case, a product, a flow, a
 *          run; userB's private custom substance "Bamboo fibre (B)"
 *
 * Every name carries the run tag, so a body can be searched for another
 * tenant's names.
 */
import { api, expectStatus } from './api';
import { sql, sqlOne } from './db';
import {
  changePasswordHash,
  createUser,
  deactivate,
  makePlatformAdmin,
  RUN,
  wrongSecretToken,
  type TestUser,
} from './users';

export const ROLES = ['anon', 'nonmem', 'viewer', 'editor', 'adminm', 'owner', 'padmin'] as const;
export type Role = (typeof ROLES)[number];
export const EXTRA_CALLERS = ['deactivated', 'revoked', 'tampered'] as const;
export type ExtraCaller = (typeof EXTRA_CALLERS)[number];
/** userB owns Q and is not a member of P: the cross-tenant caller. */
export type Caller = Role | ExtraCaller | 'userB';

export async function substanceId(name: string): Promise<number> {
  const row = await sqlOne<{ substance_id: number }>(
    'SELECT substance_id FROM substances WHERE substance_name = ? AND (is_custom = 0 OR is_custom IS NULL) LIMIT 1',
    [name],
  );
  if (!row) throw new Error(`Seed substance "${name}" is missing from the fresh database`);
  return Number(row.substance_id);
}

export async function createProject(user: TestUser, name: string, put?: Record<string, unknown>): Promise<number> {
  const res = expectStatus(
    await api.post('/api/projects', { token: user.token, json: { project_name: name, description: `${name} goal` } }),
    201,
    `create project ${name}`,
  );
  const id = Number(res.json.project.project_id);
  if (put) expectStatus(await api.put(`/api/projects/${id}`, { token: user.token, json: put }), 200, `PUT project ${name}`);
  return id;
}

export async function addMember(owner: TestUser, projectId: number, member: TestUser, role: 'viewer' | 'editor' | 'admin') {
  expectStatus(
    await api.post(`/api/projects/${projectId}/members`, { token: owner.token, json: { email: member.email, role } }),
    200,
    `add ${member.label} as ${role}`,
  );
}

export async function createCase(user: TestUser, projectId: number, name: string, type: 'base' | 'comparative' = 'base') {
  const res = expectStatus(
    await api.post(`/api/projects/${projectId}/cases`, { token: user.token, json: { case_name: name, case_type: type } }),
    201,
    `create case ${name}`,
  );
  return Number(res.json.case.case_id);
}

export async function createComponent(user: TestUser, caseId: number, body: Record<string, unknown>) {
  const res = expectStatus(
    await api.post(`/api/cases/${caseId}/components`, { token: user.token, json: body }),
    201,
    `create component ${String(body.component_name)}`,
  );
  return Number(res.json.component.component_id);
}

export async function addFlow(user: TestUser, componentId: number, body: Record<string, unknown>) {
  const res = expectStatus(
    await api.post(`/api/components/${componentId}/flows`, { token: user.token, json: body }),
    201,
    `add flow to ${componentId}`,
  );
  return Number(res.json.flow.flow_id);
}

export async function runAssessment(user: TestUser, caseId: number, body: Record<string, unknown> = {}) {
  const res = expectStatus(
    await api.post(`/api/cases/${caseId}/assessments`, {
      token: user.token,
      json: { calculation_method: 'CML 2001', region_code: 'US', run_name: 'Test run', ...body },
    }),
    201,
    `run case ${caseId}`,
  );
  return res.json;
}

const TIERS = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'] as const;

/** Five tiers under one another; returns the ids top-down. */
export async function buildTree(user: TestUser, caseId: number, names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const [i, type] of TIERS.entries()) {
    ids.push(
      await createComponent(user, caseId, {
        component_name: names[i],
        component_type: type,
        parent_component_id: i === 0 ? null : ids[i - 1],
        ...(i === 0 ? { quantity: 1, unit: 'unit' } : {}),
      }),
    );
  }
  return ids;
}

export interface World {
  tag: string;
  users: Record<
    'owner' | 'editor' | 'viewer' | 'adminm' | 'nonmem' | 'userB' | 'padmin' | 'deactivated' | 'revoked' | 'invitee',
    TestUser
  >;
  /** Bearer token per caller (null for anon). */
  token: (caller: Caller) => string | null;
  user: (caller: Caller) => TestUser | null;
  substances: { electricity: number; naturalGas: number; steel: number };
  P: {
    id: number;
    name: string;
    base: { id: number; name: string; product: number; machine: number; subprocess: number; op: number; task: number; flow: number; gasFlow: number; run: number };
    comp: { id: number; name: string; run: number };
  };
  Q: { id: number; name: string; caseId: number; caseName: string; component: number; componentName: string; flow: number; run: number; substance: number; substanceName: string };
  legacyComparison: number;
  /** Names of P's and Q's resources, for "no data in the body" checks. */
  secretsOfP: string[];
  secretsOfQ: string[];
  fresh: {
    project: () => Promise<number>;
    emptyCase: () => Promise<number>;
    invitee: () => Promise<number>;
    document: () => Promise<number>;
    caseCopy: () => Promise<number>;
    leaf: () => Promise<number>;
    flow: () => Promise<number>;
    legacyComparison: () => Promise<number>;
  };
}

export async function buildWorld(opts: { runs?: boolean } = {}): Promise<World> {
  const tag = `${RUN}${Math.random().toString(36).slice(2, 6)}`;
  const [owner, editor, viewer, adminm, nonmem, userB, padmin, deactivated, revoked, invitee] = await Promise.all(
    ['owner', 'editor', 'viewer', 'adminm', 'nonmem', 'userB', 'padmin', 'dee', 'revoked', 'invitee'].map((l) =>
      createUser(l, { fullName: `${l} ${tag}` }),
    ),
  );
  await makePlatformAdmin(padmin);

  const electricity = await substanceId('Electricity');
  const naturalGas = await substanceId('Natural Gas');
  const steel = await substanceId('Steel');

  // ── P ────────────────────────────────────────────────────────────────────
  const pName = `E2E Coffee Mug LCA ${tag}`;
  const pId = await createProject(owner, pName, {
    functional_unit: '1 ceramic mug (350 ml), at the factory gate',
    system_boundary: 'cradle-to-gate',
    lcia_method: 'CML 2001',
    region_code: 'US',
  });
  await addMember(owner, pId, editor, 'editor');
  await addMember(owner, pId, viewer, 'viewer');
  await addMember(owner, pId, adminm, 'admin');
  await addMember(owner, pId, deactivated, 'editor');
  await addMember(owner, pId, revoked, 'editor');

  const baseName = `Standard Production ${tag}`;
  const baseId = await createCase(owner, pId, baseName, 'base');
  const [product, machine, subprocess, op, task] = await buildTree(owner, baseId, [
    `Ceramic Coffee Mug (350ml) ${tag}`,
    `Forming Line ${tag}`,
    `Slip Casting ${tag}`,
    `Mold Filling ${tag}`,
    `Mold Cleaning ${tag}`,
  ]);
  const gasFlow = await addFlow(owner, op, { substance_id: naturalGas, flow_type: 'input', quantity: 1.8, unit: 'm3' });
  const flow = await addFlow(owner, task, { substance_id: electricity, flow_type: 'input', quantity: 2.5, unit: 'kWh' });
  const baseRun = opts.runs === false ? 0 : Number((await runAssessment(owner, baseId)).run_id);

  const compName = `Recycled Clay Variant ${tag}`;
  const dup = expectStatus(
    await api.post(`/api/cases/${baseId}/duplicate`, { token: owner.token, json: { case_name: compName } }),
    201,
    'duplicate base',
  );
  const compId = Number(dup.json.case_id);
  const compFlows = await sql<{ flow_id: number; substance_id: number }>(
    `SELECT f.flow_id, f.substance_id FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?`,
    [compId],
  );
  for (const f of compFlows) {
    const quantity = Number(f.substance_id) === electricity ? 1.6 : 1.1;
    expectStatus(await api.put(`/api/flows/${f.flow_id}`, { token: owner.token, json: { quantity } }), 200, 'lower comp flow');
  }
  const compRun = opts.runs === false ? 0 : Number((await runAssessment(owner, compId)).run_id);

  // ── Q (userB) ────────────────────────────────────────────────────────────
  const qName = `Bamboo Bikes (B) ${tag}`;
  const qId = await createProject(userB, qName, { functional_unit: '1 bike frame', lcia_method: 'CML 2001', region_code: 'US' });
  const qCaseName = `Bamboo Frame Case (B) ${tag}`;
  const qCase = await createCase(userB, qId, qCaseName, 'base');
  const qComponentName = `Secret Bamboo Frame (B) ${tag}`;
  const qComponent = await createComponent(userB, qCase, { component_name: qComponentName, component_type: 'product' });
  const qSubstanceName = `Bamboo fibre (B) ${tag}`;
  const sub = expectStatus(
    await api.post('/api/substances', {
      token: userB.token,
      json: {
        name: qSubstanceName,
        kind: 'input',
        unit: 'kg',
        method: 'CML 2001',
        impactCategory: 'Global Warming',
        factorValue: 0.42,
        source: 'Supplier EPD 2025 (B private)',
      },
    }),
    201,
    'userB custom substance',
  );
  const qSubstance = Number(sub.json.substance.substance_id);
  const qFlow = await addFlow(userB, qComponent, { substance_id: qSubstance, flow_type: 'input', quantity: 3, unit: 'kg' });
  const qRun = opts.runs === false ? 0 : Number((await runAssessment(userB, qCase)).run_id);

  // Tokens that must be refused: minted while valid, then invalidated.
  const deactivatedToken = deactivated.token;
  await deactivate(deactivated);
  const revokedToken = revoked.token;
  await changePasswordHash(revoked);
  const tampered = wrongSecretToken(owner);

  const legacyComparisonRow = async () => {
    const r: any = await sql(
      `INSERT INTO comparison_runs (comparison_name, project_id, case_ids, base_case_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [`Legacy comparison ${tag}`, pId, JSON.stringify([baseId, compId]), baseId, owner.id],
    );
    return Number(r.insertId);
  };
  const legacyComparison = await legacyComparisonRow();

  const users = { owner, editor, viewer, adminm, nonmem, userB, padmin, deactivated, revoked, invitee };
  const byCaller: Record<Caller, TestUser | null> = {
    anon: null,
    nonmem,
    viewer,
    editor,
    adminm,
    owner,
    padmin,
    deactivated,
    revoked,
    tampered: owner,
    userB,
  };
  let seq = 0;
  const next = () => `${tag}-${++seq}`;

  return {
    tag,
    users,
    user: (c) => byCaller[c],
    token: (c) =>
      c === 'anon' ? null : c === 'deactivated' ? deactivatedToken : c === 'revoked' ? revokedToken : c === 'tampered' ? tampered : byCaller[c]!.token,
    substances: { electricity, naturalGas, steel },
    P: {
      id: pId,
      name: pName,
      base: { id: baseId, name: baseName, product, machine, subprocess, op, task, flow, gasFlow, run: baseRun },
      comp: { id: compId, name: compName, run: compRun },
    },
    Q: {
      id: qId,
      name: qName,
      caseId: qCase,
      caseName: qCaseName,
      component: qComponent,
      componentName: qComponentName,
      flow: qFlow,
      run: qRun,
      substance: qSubstance,
      substanceName: qSubstanceName,
    },
    legacyComparison,
    secretsOfP: [pName, baseName, compName, `Mold Cleaning ${tag}`, `Ceramic Coffee Mug (350ml) ${tag}`],
    secretsOfQ: [qName, qCaseName, qComponentName, qSubstanceName],
    fresh: {
      project: async () => {
        const id = await createProject(owner, `Fresh project ${next()}`);
        await addMember(owner, id, editor, 'editor');
        await addMember(owner, id, viewer, 'viewer');
        await addMember(owner, id, adminm, 'admin');
        await sql(
          `INSERT INTO project_members (project_id, user_id, permission_id)
           SELECT ?, a.id, p.permission_id FROM account a, permissions p
            WHERE a.id IN (?, ?) AND p.permission_name = 'editor'`,
          [id, deactivated.id, revoked.id],
        );
        return id;
      },
      emptyCase: async () => createCase(owner, pId, `Empty ${next()}`, 'comparative'),
      invitee: async () => {
        await addMember(owner, pId, invitee, 'viewer');
        return invitee.id;
      },
      document: async () => {
        const fd = new FormData();
        fd.append('file', new File([`Reference notes ${next()}\nkiln at 1200 C\n`], 'notes.txt', { type: 'text/plain' }));
        fd.append('doc_type', 'other');
        const res = expectStatus(await api.post(`/api/cases/${baseId}/documents`, { token: owner.token, form: fd }), 200, 'attach document');
        return Number(res.json.document.document_id);
      },
      caseCopy: async () => {
        const res = expectStatus(
          await api.post(`/api/cases/${baseId}/duplicate`, { token: owner.token, json: { case_name: `Copy ${next()}` } }),
          201,
          'fresh case copy',
        );
        return Number(res.json.case_id);
      },
      leaf: async () =>
        createComponent(owner, baseId, { component_name: `Glaze ${next()}`, component_type: 'operation', parent_component_id: subprocess }),
      flow: async () => addFlow(owner, task, { substance_id: electricity, flow_type: 'input', quantity: 0.25, unit: 'kWh' }),
      legacyComparison: legacyComparisonRow,
    },
  };
}
