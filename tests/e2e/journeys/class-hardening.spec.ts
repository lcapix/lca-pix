/**
 * Journey 6 hardened (v1-hardening-30, items 27 to 29): a teacher sets an
 * assignment, a student starts it, runs it and hands it in, and the teacher
 * reads the hand-in with its run. Three accounts: the teacher, a student who
 * can change, a student who can only read (and a second student who hands in
 * without a run). Each step is clicked; each outcome is checked in the data.
 *
 *   B1  People access waits for its Save
 *   B2  Enter in the assignment form never creates or publishes it; B4 a save says "Saved"
 *   D1  the frozen hand-in carries the run it was handed in with; with none, it says so
 *   D2  Hand-ins: the hand-in opens the frozen copy, "Its run" the copy's run, and the
 *       working case is a separate, labelled link
 *   D3  Cases and Home show the hand-in as handed in, never a second unrun case
 *   D4  after a run on an assignment case the step bar's Next is the write-up, then Hand in
 *   D5  one Start that starts; a can-read student is told why there is none; the case
 *       is named "<assignment> · <student>"; the teacher reads a student's case only
 */
import type { Page, Response } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };
const TITLE = 'Week 1: lighter blank';

const answered = (page: Page, re: RegExp, method = 'POST'): Promise<Response> =>
  page.waitForResponse((r) => re.test(new URL(r.url()).pathname) && r.request().method() === method, NAV);

test('journey 6, hardened: set, start, run, hand in, and the teacher opens the hand-in and its run', async ({ api, newUser, signIn }) => {
  test.setTimeout(420_000);
  const teacher = await newUser('class-teacher');
  const ana = await newUser('class-ana');
  const ben = await newUser('class-ben');
  const vic = await newUser('class-vic');
  const as = api.as(teacher.token);
  // Names that tell the three students apart on screen.
  await api.as(ana.token).put('/api/auth/profile', { fullName: 'Ana Ruiz', company: 'E2E Test Co', role: 'Student', useCase: 'product', country: 'United States' });
  await api.as(ben.token).put('/api/auth/profile', { fullName: 'Ben Okafor', company: 'E2E Test Co', role: 'Student', useCase: 'product', country: 'United States' });
  await api.as(vic.token).put('/api/auth/profile', { fullName: 'Vic Reader', company: 'E2E Test Co', role: 'Student', useCase: 'product', country: 'United States' });

  // The class (set up through the API, as a teacher would have before class): a base case with one counted flow.
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Bracket class', description: 'One bracket.' })).project.project_id;
  const baseId = (await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, { case_name: 'Bracket base', case_type: 'base', description: 'The brief' })).case.case_id;
  const product = (await as.post<{ component: { component_id: number } }>(`/api/cases/${baseId}/components`, {
    component_name: 'Bracket',
    component_type: 'product',
    parent_component_id: null,
    quantity: 1,
    unit: 'unit',
  })).component.component_id;
  const steel = (await as.get<{ substances: Array<{ substance_id: number; substance_name: string }> }>('/api/substances')).substances.find((s) => s.substance_name === 'Steel')!;
  await as.post(`/api/components/${product}/flows`, { substance_id: steel.substance_id, flow_type: 'input', quantity: 0.8, unit: 'kg' });
  await as.post(`/api/projects/${projectId}/members`, { email: ana.email, role: 'editor' });
  await as.post(`/api/projects/${projectId}/members`, { email: ben.email, role: 'editor' });
  await as.post(`/api/projects/${projectId}/members`, { email: vic.email, role: 'viewer' });

  const t = await signIn(teacher);
  const tp = t.page;

  await test.step('B2 B4 the teacher sets the assignment: Enter publishes nothing; the button does, and says Saved', async () => {
    await open(tp, `/project/${projectId}/assignments`, { ready: 'Assignments' });
    await tp.getByRole('button', { name: '+ New assignment' }).click();
    const form = tp.getByRole('form', { name: 'New assignment' });
    await form.getByLabel('Title').fill(TITLE);
    await form.getByLabel('Title').press('Enter');
    await tp.waitForTimeout(1500);
    expect((await as.get<{ assignments: any[] }>(`/api/projects/${projectId}/assignments`)).assignments).toHaveLength(0);
    await form.getByLabel('Instructions').fill('Make the blank lighter, run it, write what changed, then hand it in.');
    await form.getByLabel('Due').fill('2030-01-15T17:00');
    await form.getByLabel('Students start from').selectOption({ label: 'Bracket base (base case)' });
    const created = answered(tp, new RegExp(`^/api/projects/${projectId}/assignments$`));
    await form.getByRole('button', { name: 'Create assignment' }).click();
    expect((await created).status()).toBe(201);
    await expect(tp.getByText(`Saved. "${TITLE}" is set for your students.`)).toBeVisible(NAV);
    // Changing it: Save, and the page says so.
    await tp.getByRole('button', { name: 'Change' }).click();
    const edit = tp.getByRole('form', { name: 'Change the assignment' });
    await edit.getByLabel('Instructions').fill('Make the blank lighter (0.70 kg), run it, write what changed, then hand it in.');
    const put = answered(tp, /^\/api\/assignments\/\d+$/, 'PUT');
    await edit.getByRole('button', { name: 'Save' }).click();
    expect((await put).status()).toBe(200);
    await expect(tp.getByText(`Saved. "${TITLE}" is changed.`)).toBeVisible(NAV);
    expect((await as.get<{ assignments: any[] }>(`/api/projects/${projectId}/assignments`)).assignments[0].instructions).toMatch(/0\.70 kg/);
  });

  await test.step('B1 People: a new access waits for Save; Cancel leaves it as it was', async () => {
    await open(tp, `/project/${projectId}/people`, { ready: 'People' });
    const access = tp.getByLabel('Access for Ben Okafor');
    await access.selectOption('viewer');
    await tp.waitForTimeout(1000);
    const roleOf = async (email: string) => (await as.get<{ members: any[] }>(`/api/projects/${projectId}/members`)).members.find((m) => m.email === email)?.permission_name;
    expect(await roleOf(ben.email)).toBe('editor');
    await tp.getByRole('button', { name: /^Cancel\b.*access change for Ben Okafor/ }).click();
    await expect(access).toHaveValue('editor');
    await access.selectOption('viewer');
    const saved = answered(tp, /\/api\/projects\/\d+\/members$/, 'POST');
    await tp.getByRole('button', { name: /^Save\b.*access for Ben Okafor/ }).click();
    expect((await saved).ok()).toBe(true);
    await expect(tp.getByText(/^Saved\. Ben Okafor can now read only/)).toBeVisible(NAV);
    expect(await roleOf(ben.email)).toBe('viewer');
    // Put back: Ben can change again (he hands in later).
    await access.selectOption('editor');
    await tp.getByRole('button', { name: /^Save\b.*access for Ben Okafor/ }).click();
    await expect(tp.getByText(/^Saved\. Ben Okafor can now change cases/)).toBeVisible(NAV);
    expect(await roleOf(ben.email)).toBe('editor');
  });

  await test.step('D5 a student who can only read is told why there is no Start', async () => {
    const v = await signIn(vic);
    await open(v.page, '/home', { ready: 'Assigned to you' });
    const assigned = v.page.getByRole('region', { name: /Assigned to you/ });
    await expect(assigned.getByText(TITLE)).toBeVisible();
    await expect(assigned.getByText(/You can read this project, so you cannot start it/)).toBeVisible();
    await expect(assigned.getByRole('button', { name: /^Start/ })).toHaveCount(0);
    await v.context.close();
  });

  let workingId = 0;
  let frozenId = 0;
  const a = await signIn(ana);
  const ap = a.page;
  await test.step('D5 D4 Ana presses Start on Home: her own case, named for her; she runs it; the step bar takes her to the write-up, then to Hand in', async () => {
    await open(ap, '/home', { ready: 'Assigned to you' });
    const assigned = ap.getByRole('region', { name: /Assigned to you/ });
    // One way in: Start. No second, untied "Make your own case".
    await expect(ap.getByRole('button', { name: 'Make your own case' })).toHaveCount(0);
    const started = answered(ap, /^\/api\/assignments\/\d+\/start$/);
    await assigned.getByRole('button', { name: /^Start\b/ }).click();
    expect((await started).status()).toBe(201);
    await expect(ap).toHaveURL(/\/case\/\d+$/, NAV);
    workingId = Number(/\/case\/(\d+)$/.exec(new URL(ap.url()).pathname)![1]);
    const working = (await api.as(ana.token).get<{ case: any }>(`/api/cases/${workingId}`)).case;
    expect(working.case_name).toBe(`${TITLE} · Ana Ruiz`);
    expect(Number(working.assignment_id)).toBeGreaterThan(0);
    await expect(ap.getByRole('tree')).toBeVisible(NAV);

    const ran = answered(ap, /^\/api\/cases\/\d+\/assessments$/);
    await ap.getByRole('button', { name: 'Run Assessment', exact: true }).click();
    await ap.getByRole('dialog', { name: 'Run assessment' }).getByRole('button', { name: 'Run', exact: true }).click();
    expect((await ran).status()).toBe(201);
    await expect(ap).toHaveURL(/tab=results/, NAV);
    const bar = ap.getByRole('navigation', { name: 'Where this case stands' });
    await expect(bar.getByRole('button', { name: /^Impact assessment: done\. Run 1\./ })).toBeVisible(NAV);
    await bar.getByRole('button', { name: 'Next: Write the interpretation' }).click();
    await expect(ap).toHaveURL(/tab=writeup/, NAV);
    await ap.getByRole('textbox', { name: 'Interpretation' }).fill('Steel is all of it, so a lighter blank is the lever.');
    const wrote = answered(ap, /^\/api\/cases\/\d+$/, 'PUT');
    await ap.getByRole('button', { name: 'Save the write-up' }).click();
    expect((await wrote).status()).toBe(200);
    await expect(bar.getByRole('button', { name: /^Interpretation: done\./ })).toBeVisible(NAV);
    await bar.getByRole('button', { name: 'Next: Hand it in' }).click();
    await expect(ap).toHaveURL(new RegExp(`/project/${projectId}/assignments$`), NAV);
  });

  await test.step('D1 Ana hands in: the frozen copy carries her run', async () => {
    await ap.getByRole('button', { name: 'Hand in', exact: true }).click();
    const submitted = answered(ap, /^\/api\/assignments\/\d+\/submit$/);
    await ap.getByRole('alertdialog', { name: 'Hand in this case?' }).getByRole('button', { name: 'Hand in' }).click();
    const res = await submitted;
    expect(res.status()).toBe(200);
    const body = await res.json();
    frozenId = Number(body.case_id);
    expect(Number(body.run_id)).toBeGreaterThan(0);
    await expect(ap.getByText(/^Handed in /)).toBeVisible(NAV);
    // The copy's run is the working run's answer, frozen with it.
    const runsOf = async (caseId: number) => (await api.as(ana.token).get<{ assessments: any[] }>(`/api/cases/${caseId}/assessments`)).assessments;
    const [workingRun] = await runsOf(workingId);
    const frozenRuns = await runsOf(frozenId);
    expect(frozenRuns).toHaveLength(1);
    expect(frozenRuns[0].run_id).toBe(body.run_id);
    const gw = (r: any) => Object.entries(r.impacts ?? {}).find(([k]) => /global warming/i.test(k))?.[1] as any;
    expect(gw(frozenRuns[0]).value).toBeCloseTo(gw(workingRun).value, 12);
    // She keeps working on her live case; the hand-in does not move.
    const flows = (await api.as(ana.token).get<{ components: any[] }>(`/api/cases/${workingId}/components`)).components;
    const bracket = flows.find((c) => c.component_name === 'Bracket')!;
    const steelFlow = (await api.as(ana.token).get<{ flows: any[] }>(`/api/components/${bracket.component_id}/flows`)).flows[0];
    await api.as(ana.token).put(`/api/flows/${steelFlow.flow_id}`, { quantity: 0.7 });
    await a.context.close();
  });

  await test.step('D1 Ben hands in without a run, and it says so', async () => {
    const bs = api.as(ben.token);
    const assignmentId = (await bs.get<{ assignments: any[] }>(`/api/projects/${projectId}/assignments`)).assignments[0].assignment_id;
    await bs.post(`/api/assignments/${assignmentId}/start`, {});
    const r = await bs.post<{ case_id: number; run_id: number | null }>(`/api/assignments/${assignmentId}/submit`, {});
    expect(r.run_id).toBeNull();
  });

  await test.step('D2 D1 the teacher opens the hand-in, its run and its report, read-only; the working case is its own link', async () => {
    await open(tp, `/project/${projectId}/assignments`, { ready: TITLE });
    await tp.getByRole('button', { name: 'Hand-ins' }).click();
    const handins = tp.getByRole('table', { name: 'Hand-ins' });
    const anaRow = handins.getByRole('row').filter({ hasText: ana.email });
    await expect(anaRow.getByRole('link', { name: /^Working case \(still changing\)/ })).toHaveAttribute('href', new RegExp(`/case/${workingId}$`));
    await expect(handins.getByRole('row').filter({ hasText: ben.email }).getByText('Handed in without a run')).toBeVisible();

    // The first link is the hand-in: the frozen copy, with its run.
    await anaRow.getByRole('link', { name: /^Handed in / }).click();
    await expect(tp).toHaveURL(new RegExp(`/case/${frozenId}$`), NAV);
    await expect(tp.getByText(/Handed in, read-only/).first()).toBeVisible(NAV);
    await expect(tp.getByRole('tab', { name: /^Results/ })).toContainText('Run 1');
    await expect(tp.getByRole('button', { name: 'Run Assessment', exact: true })).toHaveCount(0);
    await tp.goBack();
    await expect(tp).toHaveURL(new RegExp(`/project/${projectId}/assignments$`), NAV);

    // "Its run" opens the frozen copy's run: the answer as handed in (0.8 kg, not her later 0.7).
    await tp.getByRole('button', { name: 'Hand-ins' }).click();
    const runLink = tp.getByRole('table', { name: 'Hand-ins' }).getByRole('row').filter({ hasText: ana.email }).getByRole('link', { name: /^Its run/ });
    await expect(runLink).toHaveAttribute('href', new RegExp(`/case/${frozenId}/results\\?run=\\d+$`));
    const frozenRun = Number(/run=(\d+)$/.exec((await runLink.getAttribute('href'))!)![1]);
    await runLink.click();
    await expect(tp).toHaveURL(new RegExp(`/case/${frozenId}/results\\?run=${frozenRun}$`), NAV);
    await expect(tp.getByText(/Global Warming/i).first()).toBeVisible(NAV);
    await expect(tp.getByText('Not run yet')).toHaveCount(0);
    // Its report exports, for the teacher, from the frozen run.
    const csv = await tp.request.get(`/api/assessments/${frozenRun}/export?format=csv`, { headers: { Authorization: `Bearer ${teacher.token}` } });
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toMatch(/Bracket/);

    // The working case: the teacher reads it, never edits it.
    await open(tp, `/project/${projectId}/case/${workingId}`, { ready: `${TITLE} · Ana Ruiz` });
    await expect(tp.getByText("A student's case.")).toBeVisible(NAV);
    await expect(tp.getByRole('button', { name: 'Run Assessment', exact: true })).toHaveCount(0);
    await expect(tp.getByRole('button', { name: /^\+ Add a step|^Add step$/ })).toHaveCount(0);
  });

  await test.step('D3 the Cases board and Home show the hand-in as handed in, never a second unrun case', async () => {
    await open(tp, `/project/${projectId}/cases`, { ready: 'Your cases' });
    // 1 base + 2 working cases; the 2 hand-ins are named apart.
    await expect(tp.getByText(/3 cases · 1 yours, 2 from members · 2 handed in/).first()).toBeVisible(NAV);
    await tp.getByRole('radio', { name: 'Table' }).click();
    const frozenRow = tp.getByRole('row', { name: new RegExp(`${TITLE} · Ana Ruiz \\(handed in\\)`) });
    await expect(frozenRow).toContainText('✓ Handed in');
    await expect(frozenRow).toContainText('Run 1');
    const benFrozen = tp.getByRole('row', { name: new RegExp(`${TITLE} · Ben Okafor \\(handed in\\)`) });
    await expect(benFrozen).toContainText('✓ Handed in');
    await expect(benFrozen).not.toContainText('Not handed in');

    // Home: Ben's working case has no run (1), his hand-in is not counted again.
    const listed = (await as.get<{ projects: any[] }>('/api/projects')).projects.find((p) => p.project_id === projectId);
    expect(Number(listed.member_cases_without_run)).toBe(1);
    expect(Number(listed.case_count)).toBe(3);
    expect(Number(listed.hand_ins)).toBe(2);
    await open(tp, '/home', { ready: /Welcome/ });
    await expect(tp.getByText('1 member case has no run yet')).toBeVisible(NAV);
    await expect(tp.getByText(/2 member cases have no run yet/)).toHaveCount(0);
  });
});
