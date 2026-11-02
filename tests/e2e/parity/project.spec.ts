/**
 * Project pages that still work: the Cases board a project opens on, cases,
 * analytics, new case, new project, and reports. Duplicate (P129) is exercised
 * by the worked-example journey. Export (P120) is exercised by the results
 * journey.
 *
 * C1 (2026-11-01, her decision): the old project Overview (the hub) is gone; a
 * project opens on its Cases board. Its rows now read there, or are retired:
 *   moved to the Cases board: P02 name, P04 description (settings), P06 Compare
 *     (sidebar), P09 P15 Add case (+ New case), P10 P124 Delete project
 *     (settings), P14 the cases, P16 a case's description, P18 open a case,
 *     P25 goal and scope (settings), P26 Run, P28 P130 Rename, P29 P131 Delete
 *     case (the case's menu), P27 Results (the case's own tab).
 *   retired with the hub: P03 "comparison" chip, P07 Class button (/class
 *     redirects, P31), P08 Import Data (the New case form's From a file, P119),
 *     P11 breadcrumb (the sidebar), P12 KPI strip, P13 comparison banner
 *     (Compare's verdict), P17 mini canvas, P19 View Full Hierarchy, P20 node
 *     details (the case's step panel), P21 Clone from base on an empty
 *     comparative (the New case form's what-if copies the base, P101, and its
 *     empty comparative, P102), P22 Impact overview, P23 Top contributors,
 *     P24 Cost summary (the Results tab).
 */
import { expect, storagePath, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

test('P02 P04 P06 P09 P10 P14 P15 P16 P18 P25 P26 P27 P28 P29 P124 P130 P131 a project opens on its Cases board, and what the Overview did is there', async ({
  api,
  newUser,
  signIn,
}) => {
  test.setTimeout(240_000);
  const user = await newUser('parity-overview');
  const as = api.as(user.token);
  const projectId = (
    await as.post<{ project: { project_id: number } }>('/api/projects', {
      project_name: 'Parity study',
      description: 'A study of one frame.',
    })
  ).project.project_id;
  const base = (
    await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, {
      case_name: 'Cut frame',
      case_type: 'base',
      description: 'The base way of making it.',
    })
  ).case.case_id;
  const product = (
    await as.post<{ component: { component_id: number } }>(`/api/cases/${base}/components`, {
      component_name: 'Frame product',
      component_type: 'product',
      parent_component_id: null,
      quantity: 1,
      unit: 'unit',
    })
  ).component.component_id;
  await as.post(`/api/components/${product}/flows`, {
    substance_id: await substance(as, 'Steel'),
    flow_type: 'input',
    quantity: 1,
    unit: 'kg',
  });

  await as.post(`/api/cases/${base}/duplicate`, { case_name: 'Lighter frame' });
  await as.post(`/api/projects/${projectId}/cases`, { case_name: 'Blank alternative', case_type: 'comparative', description: 'Nothing in it yet.' });

  const { page } = await signIn(user);
  await open(page, `/project/${projectId}`, { ready: 'Parity study' });
  await expect.soft(page, note('P02', 'the project opens on its Cases board')).toHaveURL(new RegExp(`/project/${projectId}/cases$`), { timeout: 90_000 });

  await row(page.getByText('Parity study').first(), 'P02', 'Project name heading');
  await row(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Compare/ }), 'P06', 'Compare the cases');
  await row(page.getByRole('link', { name: '+ New case' }).first(), 'P09', 'Add Case (to base/new or comparative/new)');
  await row(page.getByRole('link', { name: '+ New case' }).first(), 'P15', 'Add comparative / Add case');
  await row(page.getByRole('link', { name: /Cut frame/ }).first(), 'P14', 'The cases: base and comparatives, with counts');
  await row(page.getByRole('link', { name: /Lighter frame/ }).first(), 'P14', 'The cases: base and comparatives, with counts');
  await row(page.getByText('The base way of making it.').first(), 'P16', 'A case\'s description');
  await row(page.getByText(/1 step · 1 flow · 0 runs/).first(), 'P14', 'show counts');

  // Settings: name, description, goal and scope; Delete project (owner) with a confirm.
  await page.getByRole('button', { name: 'Project settings' }).click();
  const settings = page.getByRole('form', { name: 'Project settings' });
  await expect.soft(settings.getByLabel('Description'), note('P04', 'Project description')).toHaveValue('A study of one frame.');
  await row(settings.getByLabel('Functional unit'), 'P25', 'Goal and scope');
  await page.getByRole('button', { name: 'Delete project' }).click();
  await row(page.getByRole('alertdialog', { name: 'Delete "Parity study"?' }), 'P10', 'Delete project (confirm)');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await row(page.getByRole('button', { name: 'Delete project' }), 'P124', 'Delete project');
  await page.getByRole('button', { name: 'Close settings' }).click();

  // A case's menu: Rename, Run, Delete (P118 walks each one).
  await page.getByRole('button', { name: 'Menu for Cut frame' }).click();
  await row(page.getByRole('menuitem', { name: 'Run' }), 'P26', 'Run Assessment');
  await row(page.getByRole('menuitem', { name: 'Rename' }), 'P130', 'Rename case');
  await row(page.getByRole('menuitem', { name: 'Delete' }), 'P131', 'Delete case');
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await row(page.getByRole('dialog', { name: 'Rename case' }), 'P28', 'Rename case (dialog)');
  await page.getByRole('dialog', { name: 'Rename case' }).getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Menu for Cut frame' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await row(page.getByRole('alertdialog', { name: 'Delete this case?' }), 'P29', 'Delete case (confirm)');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();

  // Open a case: its own tabs hold the tree and the results.
  await page.getByRole('link', { name: /Cut frame/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/case/${base}$`), { timeout: 90_000 });
  await row(page.getByRole('tree'), 'P18', 'Open the case');
  await row(page.getByRole('tab', { name: /^Results/ }), 'P27', 'Results');
});

test('P49 P57 analytics says when it cannot load, and the sidebar goes back', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-analytics');
  const projectId = (await api.as(user.token).post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Parity analytics', description: '' }))
    .project.project_id;
  const { page: signed } = await signIn(user);
  await signed.route(/\/api\/projects\/\d+\/progress/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"no"}' }));
  await open(signed, `/project/${projectId}/analytics`);
  await row(signed.getByRole('button', { name: 'Try again' }), 'P57', 'No-data card with Try again');
  await row(signed.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Cases/ }), 'P49', 'Back to project button and breadcrumb');
});

test('P99 P100 P101 P103 P119 a new case copies, and refuses a name that is taken', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-newcase');
  const as = api.as(user.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Parity cases', description: 'Names' })).project.project_id;
  const baseId = (await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, { case_name: 'Cut frame', case_type: 'base', description: 'The base' })).case.case_id;
  await as.post(`/api/cases/${baseId}/components`, { component_name: 'Bracket', component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' });
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/case/new`, { ready: 'What kind of case?' });
  await row(page.getByText('A what-if: copy a case and change one thing'), 'P100', 'Comparative: pick reference base case');
  await row(page.getByLabel('Copy from'), 'P100', 'Comparative: pick reference base case');
  await row(page.getByText('The copy keeps every step and flow.'), 'P101', 'Copy base steps, flows, costs (checkbox, on by default)');
  await row(page.getByLabel('Case name'), 'P99', 'Base case: name + multi-line description');
  await row(page.getByLabel(/What will you change/), 'P99', 'Base case: name + multi-line description');
  await page.getByRole('radio', { name: /A new base case/ }).click();
  await row(page.getByText('From a file'), 'P119', 'Import from the case list');
  await page.getByRole('radio', { name: /A what-if/ }).click();
  await page.getByLabel('Case name').fill('Cut frame');
  await page.getByRole('button', { name: /Make the case/ }).click();
  await row(page.getByText(/already has a case called/), 'P103', 'Name clash 409 shown');
});

test('P104 P117 the case list reaches a new case', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-caselist');
  const as = api.as(user.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Parity list', description: '' })).project.project_id;
  const baseId = (await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, { case_name: 'Cut frame', case_type: 'base', description: 'Base' })).case.case_id;
  await as.post(`/api/cases/${baseId}/components`, { component_name: 'Bracket', component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' });
  await as.post(`/api/cases/${baseId}/duplicate`, { case_name: 'Lighter frame' });
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/cases`, { ready: 'Cases' });
  await row(page.getByRole('heading', { name: /^Cases/ }), 'P117', 'Case list with base/comparative');
  await row(page.getByText('Cut frame').first(), 'P117', 'Case list with base/comparative');
  await row(page.getByText('Lighter frame').first(), 'P117', 'Case list with base/comparative');
  await row(page.getByRole('link', { name: 'New case' }), 'P104', 'Reach the forms');
});

test('P105 P107 P108 P109 P110 P113 P114 P115 a new project asks the study question', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-newproj');
  await api.as(user.token).post('/api/projects', { project_name: 'Taken name', description: '' });
  const { page } = await signIn(user);
  await open(page, '/project/new', { ready: 'Start your own project' });
  await row(page.getByLabel(/Project name/), 'P105', 'Name, required, 409 inline');
  await page.locator('form').getByRole('button', { name: 'Continue →' }).click();
  await row(page.getByText('Give the project a name.'), 'P105', 'Name, required, 409 inline');
  await page.getByLabel(/Project name/).fill('Taken name');
  await page.locator('form').getByRole('button', { name: 'Continue →' }).click();
  await row(page.getByText(/already have a project called/), 'P105', 'Name, required, 409 inline');
  await row(page.getByLabel('Functional unit'), 'P107', 'Functional unit');
  await row(page.getByLabel('System boundary'), 'P108', 'System boundary');
  await row(page.getByLabel('Method'), 'P109', 'Method');
  await row(page.getByLabel('Region'), 'P110', 'Region');
  await row(page.getByText('From a file'), 'P114', 'Then choose how to start');
  await row(page.getByText('Empty', { exact: true }), 'P114', 'Then choose how to start');
  await row(page.getByRole('button', { name: 'Cancel' }), 'P115', 'Cancel / Back');

  await page.getByLabel(/Project name/).fill('Settings fail');
  await page.route(/\/api\/projects\/\d+/, (route) => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"no"}' });
    return route.continue();
  });
  await page.getByRole('button', { name: /Continue/ }).click();
  await row(page.getByRole('button', { name: 'Continue anyway' }), 'P113', 'Warning when settings fail to save');
  await row(page.getByRole('link', { name: 'Open the project' }), 'P113', 'Warning when settings fail to save');
});

test.describe('reports', () => {
  test.use({ storageState: storagePath('owner') });

  test('P121 reports lets you pick the project, the case and the run', async ({ page, seed }) => {
    await open(page, '/reports', { ready: 'Build a report' });
    await row(page.getByRole('combobox', { name: 'Project' }), 'P121', 'Pick project, case, run');
    await page.getByRole('combobox', { name: 'Project' }).selectOption({ label: seed.example.projectName });
    await row(page.getByRole('combobox', { name: 'Case' }), 'P121', 'Pick project, case, run');
    await expect.soft(page.getByRole('combobox', { name: 'Case' }), note('P121', 'Pick project, case, run')).toContainText(/Run \d+/);
  });
});

async function substance(api: { get<T>(path: string): Promise<T> }, name: string): Promise<number> {
  const res = await api.get<{ substances: Array<{ substance_id: number; substance_name: string }> }>('/api/substances');
  const hit = res.substances.find((s) => s.substance_name === name);
  if (!hit) throw new Error(`parity: substance ${name} is not in the library`);
  return hit.substance_id;
}
