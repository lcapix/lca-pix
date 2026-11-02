/**
 * Task 6 (group D): the project Overview for every project, roles, settings,
 * the comparison line, the Cases menu, the one New case form, the New project
 * form, and the findings from discovery runs 1 to 3 that belong to the hub.
 * Every row's test title starts with its ID.
 */
import { workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

async function studyWithCase(as: any, name = 'Hub study') {
  const projectId = (await as.post('/api/projects', { project_name: name, description: 'A study of one frame.' })).project.project_id as number;
  const baseId = (await as.post(`/api/projects/${projectId}/cases`, { case_name: 'Cut frame', case_type: 'base', description: 'The base way.' })).case.case_id as number;
  await as.post(`/api/cases/${baseId}/components`, { component_name: 'Frame product', component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' });
  return { projectId, baseId };
}

test('P01 the sample study opens on the new Overview, read-only, with Make my own copy', async ({ api, newUser, signIn }) => {
  const user = await newUser('hub-sample');
  const sample = await api.as(user.token).post<{ project_id: number }>('/api/example-project');
  const { page } = await signIn(user);
  await open(page, `/project/${sample.project_id}`, { ready: 'The sample study is read-only.' });
  await row(page.getByRole('heading', { level: 1 }), 'P01', 'Overview shown for every project');
  await row(page.getByRole('list', { name: 'Project summary' }), 'P01', 'the KPI strip on the sample too');
  await expect.soft(page.getByRole('button', { name: 'Import Data' }), note('P01', 'the sample is read-only')).toHaveCount(0);
  const copied = page.waitForResponse((r) => /\/api\/cases\/\d+\/duplicate/.test(r.url()) && r.request().method() === 'POST', NAV);
  await page.getByRole('button', { name: 'Make my own copy' }).click();
  expect((await copied).status()).toBe(201);
  await expect(page).toHaveURL(/\/project\/\d+\/case\/\d+$/, NAV);
});

test('P30 each role sees only the controls it may use, and the server refuses the rest', async ({ api, newUser, signIn }) => {
  test.setTimeout(240_000);
  const owner = await newUser('hub-owner');
  const as = api.as(owner.token);
  const { projectId, baseId } = await studyWithCase(as, 'Roles study');
  const users = { editor: await newUser('hub-editor'), viewer: await newUser('hub-viewer'), admin: await newUser('hub-admin') };
  for (const [role, u] of Object.entries(users)) await as.post(`/api/projects/${projectId}/members`, { email: u.email, role });

  const expectFor = async (u: any, want: Record<string, boolean>, label: string) => {
    const { page, context } = await signIn(u);
    await open(page, `/project/${projectId}`, { ready: 'Roles study' });
    for (const [name, shown] of Object.entries(want)) {
      const control = name === 'settings' ? page.getByRole('form', { name: 'Project settings' }) : page.getByRole('button', { name, exact: true });
      await expect.soft(control, note('P30', `${label}: ${name} ${shown ? 'shown' : 'hidden'}`)).toHaveCount(shown ? 1 : 0);
    }
    await context.close();
  };
  await expectFor(users.viewer, { 'Import Data': false, 'Add Case': false, 'Run Assessment': false, 'Rename case': false, 'Delete case': false, Delete: false, settings: false }, 'viewer');
  await expectFor(users.editor, { 'Import Data': true, 'Add Case': true, 'Run Assessment': true, 'Rename case': true, 'Delete case': false, Delete: false, settings: false }, 'editor');
  await expectFor(users.admin, { 'Rename case': true, 'Delete case': true, Delete: false, settings: true }, 'admin');
  await expectFor(owner, { 'Delete case': true, Delete: true, settings: true }, 'owner');

  // The server still says no to what a role cannot do.
  const editorApi = api.as(users.editor.token);
  await expect.soft(editorApi.del(`/api/cases/${baseId}`), note('P30', 'an editor cannot delete a case')).rejects.toThrow(/403/);
  await expect.soft(api.as(users.viewer.token).put(`/api/cases/${baseId}`, { case_name: 'Renamed' }), note('P30', 'a viewer cannot rename')).rejects.toThrow(/403/);
});

test('P13 the comparison line shows the runs\' own numbers, or why there are none', async ({ api, newUser, signIn }) => {
  const user = await newUser('hub-banner');
  const as = api.as(user.token);
  const { projectId, caseId, baseCaseId } = await workedExample(api, user, 'Lighter blank');
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}`, { ready: 'Comparing' });
  // The copy has no run yet: the line names the two cases and says why there is no number.
  const banner = page.getByRole('region', { name: 'Comparison' });
  await row(banner.getByText(/No number yet/), 'P13', 'Comparison banner, nothing invented when the checks fail');
  await as.post(`/api/cases/${caseId}/assessments`, {});
  await page.reload();
  await row(banner.getByText(/the same climate impact/), 'P13', 'Comparison banner with the runs\' own numbers');
  await expect.soft(page.getByText(/28\.0%|\+\$240/), note('P13', 'no invented numbers')).toHaveCount(0);
  expect(baseCaseId).toBeTruthy();
});

test('P123 P126 P127 G144 project settings save, show at once, and keep the AI switch as stored', async ({ api, newUser, signIn }) => {
  const user = await newUser('hub-settings');
  const as = api.as(user.token);
  const { projectId } = await studyWithCase(as, 'Settings study');
  await as.put(`/api/projects/${projectId}`, { ai_enabled: false });
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}`, { ready: 'Project settings' });
  const form = page.getByRole('form', { name: 'Project settings' });
  await expect.soft(form.getByRole('checkbox', { name: /AI may read/ }), note('G144', 'the AI switch starts as stored (off)')).not.toBeChecked();
  await form.getByLabel('Name', { exact: true }).fill('Renamed study');
  await form.getByLabel(/Functional unit/).fill('1 frame');
  await form.getByLabel(/Default method/).selectOption('TRACI 2.1');
  await form.getByLabel(/Default region/).selectOption('US');
  await form.getByRole('button', { name: 'Save settings' }).click();
  await row(form.getByText('Settings saved.'), 'P123', 'Rename the project');
  await row(page.getByRole('heading', { level: 1, name: /Renamed study/ }), 'P123', 'the header shows the new name at once');
  const saved = (await as.get(`/api/projects/${projectId}`)).project;
  expect.soft(saved.functional_unit, note('P126', 'Edit FU, boundary, goal, exclusions')).toBe('1 frame');
  expect.soft([saved.lcia_method, saved.region_code], note('P127', 'Default method and region')).toEqual(['TRACI 2.1', 'US']);
  expect.soft(saved.ai_enabled, note('G144', 'saving other settings never turns AI back on or off')).toBe(false);
});

test('P118 P137 the Cases menu renames, copies, runs and deletes, and the sidebar counts follow', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('hub-menu');
  const { projectId } = await workedExample(api, user, 'Menu copy');
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/cases`, { ready: 'Cases' });
  const count = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Cases/ });
  const before = Number((await count.textContent())?.match(/\d+/)?.[0] ?? 0);
  const menu = page.getByRole('button', { name: 'Menu for Menu copy' });
  await menu.click();
  await row(page.getByRole('menu', { name: 'Menu copy menu' }), 'P118', 'Case row menu');
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('dialog', { name: 'Rename case' }).getByLabel('Case name').fill('Menu copy renamed');
  await page.getByRole('dialog', { name: 'Rename case' }).getByRole('button', { name: 'Rename' }).click();
  await row(page.getByText('Menu copy renamed').first(), 'P118', 'Rename in a dialog');
  await page.getByRole('button', { name: 'Menu for Menu copy renamed', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Copy' }).click();
  await expect.soft(count, note('P137', 'the sidebar counts a new case without a reload (1.9)')).toContainText(String(before + 1), NAV);
  await page.getByRole('button', { name: 'Menu for Menu copy renamed', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog', { name: 'Delete this case?' }).getByRole('button', { name: 'Delete case' }).click();
  await expect.soft(page.getByText('Menu copy renamed', { exact: true }), note('P118', 'Delete with a confirm')).toHaveCount(0, NAV);
  await expect.soft(count, note('P137', 'and after a delete')).toContainText(String(before), NAV);
});

test('P85 P86 P87 P88 P102 G125 one New case form, every choice, and the old addresses lead to it', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('hub-newcase');
  const as = api.as(user.token);
  const { projectId, baseId } = await studyWithCase(as, 'New case study');
  const { page } = await signIn(user);
  for (const [path, kind] of [
    ['start', 'hand'],
    ['case/base/new', 'base'],
    ['case/comparative/new', 'whatif'],
  ] as const) {
    await page.goto(`/project/${projectId}/${path}`);
    await expect.soft(page, note(path === 'start' ? 'G125' : 'P85', `${path} leads to the one form`)).toHaveURL(new RegExp(`/case/new\\?kind=${kind}`), NAV);
  }
  await row(page.getByRole('link', { name: 'Open the project and decide later' }), 'P88', 'Open the project and decide later');

  await page.goto(`/project/${projectId}/case/new?kind=emptycomp`);
  await page.getByLabel('Case name').fill('Blank alternative');
  await page.getByRole('button', { name: /Make the case/ }).click();
  await expect(page).toHaveURL(/\/case\/\d+$/, NAV);
  const blank = (await as.get(`/api/projects/${projectId}/cases`)).cases.find((c: any) => c.case_name === 'Blank alternative');
  expect.soft(blank?.case_type, note('P102', 'Empty comparative')).toBe('comparative');
  expect.soft(Number(blank?.parent_case_id), note('P102', 'linked to its base case')).toBe(baseId);

  await page.goto(`/project/${projectId}/case/new?kind=hand`);
  await page.getByRole('radio', { name: /A new base case/ }).check();
  await page.getByLabel('Case name').fill('By hand');
  await page.getByRole('button', { name: /Make the case/ }).click();
  await expect(page).toHaveURL(/\/case\/\d+\?learn=1$/, NAV);
  await row(page.getByText('Building it by hand?'), 'P86', 'Build by hand opens with ?learn=1');
  const hand = (await as.get(`/api/projects/${projectId}/cases`)).cases.find((c: any) => c.case_name === 'By hand');
  expect.soft(hand?.description, note('P86', '"Built by hand"')).toBe('Built by hand');

  await page.goto(`/project/${projectId}/case/new?kind=base`);
  await page.getByRole('radio', { name: /From a file/ }).check();
  await page.getByRole('button', { name: /Choose the file/ }).click();
  await expect.soft(page, note('P87', 'From documents opens /import?first=1')).toHaveURL(/\/import\?first=1$/, NAV);
});

test('P106 P111 P112 P87 the New project form saves the goal, explains each field and shows the five phases', async ({ newUser, signIn, api }) => {
  const user = await newUser('hub-newproj');
  const { page } = await signIn(user);
  await open(page, '/project/new', { ready: 'Start your own project' });
  await row(page.getByText("The five phases you'll work through"), 'P112', 'ISO five-phase rail');
  await row(page.getByText("You're here. Name the study and choose its boundaries."), 'P112', 'the classic text');
  for (const tip of ['What goes in the goal?', 'What is a functional unit?', 'What is a system boundary?', 'What is a methodology?', 'What does the regional context do?']) {
    await row(page.getByRole('button', { name: tip }), 'P111', 'ISO help tips');
  }
  await page.getByRole('button', { name: 'What is a functional unit?' }).click();
  await row(page.getByRole('note').getByText(/ISO 14044 4\.2\.3\.2/), 'P111', 'a tip opens its explanation');
  await page.keyboard.press('Escape');
  await page.getByLabel(/Project name/).fill('Goal study');
  await page.getByLabel(/Goal of the study/).fill('Which frame material has the lower footprint.');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect.soft(page, note('P87', 'a first file opens the guided import')).toHaveURL(/\/import\?first=1$/, NAV);
  const p = (await api.as(user.token).get('/api/projects')).projects.find((x: any) => x.project_name === 'Goal study');
  expect.soft(p?.description, note('P106', 'Goal of the study (description + goal_statement)')).toBe('Which frame material has the lower footprint.');
});

test('P59 P60 P63 P65 P67 P68 P69 P71 P72 P74 P75 P77 P78 P79 P80 P81 P84 G126 P139 P140 Compare chooses any cases and reads every view', async ({
  api,
  newUser,
  signIn,
}) => {
  test.setTimeout(240_000);
  const user = await newUser('hub-compare');
  const as = api.as(user.token);
  const { projectId, caseId, baseCaseId } = await workedExample(api, user, 'Copy one');
  await as.post(`/api/cases/${caseId}/assessments`, {});
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'CML 2001' });
  const second = (await as.post(`/api/cases/${baseCaseId}/duplicate`, { case_name: 'Copy two' })).case_id as number;
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/comparison`, { ready: 'Compare' });
  const chips = page.getByRole('group', { name: 'Cases to compare' });
  await row(chips.getByRole('button', { name: /Base case/, pressed: true }), 'P60', 'Default is the base plus every copy');
  await row(chips.getByRole('button', { name: /Copy two/, pressed: true }), 'P60', 'every copy');
  await chips.getByRole('button', { name: /Base case/ }).click();
  await expect.soft(chips.getByRole('button', { name: /Base case/ }), note('P59', 'the base can be deselected')).toHaveAttribute('aria-pressed', 'false');
  await chips.getByRole('button', { name: /Base case/ }).click();
  await row(page.getByLabel('Case A'), 'P140', 'Pickers for A and B (2.10)');
  await page.getByLabel('Case A').selectOption(String(caseId));
  await expect.soft(page.getByRole('region', { name: 'Totals' }).locator('.cmp-total').first(), note('P140', 'A on the page is the case picked as A')).toContainText('Copy one');
  await page.getByLabel('Case A').selectOption(String(baseCaseId));
  await page.getByLabel('Case B').selectOption(String(caseId));
  await expect.soft(page.getByRole('list', { name: 'Cases in this comparison' }).getByText('Copy one', { exact: true }), note('P140', 'a case is never listed twice')).toHaveCount(1);

  const cards = page.getByRole('list', { name: 'Cases in this comparison' });
  await row(cards.getByText(/\d+ steps · \d+ flows/).first(), 'P67', '"N steps · N flows" per case');
  const runPick = page.getByLabel('Run for Copy one');
  await row(runPick, 'P68', 'Run picker (number, method, region, date)');
  await expect.soft(runPick.locator('option').first(), note('P68', 'Run number, method, region, date')).toHaveText(/^Run 1 · TRACI 2\.1 · US · /);
  await runPick.selectOption({ index: 0 });
  await expect.soft(page, note('P68', 'the picked run is in the address')).toHaveURL(/runs=\d+:\d+/);
  await row(cards.getByText(/Compared on Run 1 because you picked it\./), 'P69', '"Compared on run #x because ..."');
  await row(page.getByRole('region', { name: 'Ranking' }), 'P74', 'Ranking with not-ranked reasons');
  await row(page.getByRole('link', { name: 'Duplicate the base' }), 'P75', '"Duplicate the base" button');
  const totals = page.getByRole('region', { name: 'Totals' });
  const nums = await totals.locator('.cmp-total-num').allTextContents();
  expect.soft(new Set(nums.map((n) => (n.split('.')[1] ?? '').length)).size, note('P139', 'A and B show the same decimals (2.9)')).toBe(1);
  for (const [tab, id] of [
    ['Every category', 'P78'],
    ['Hotspots', 'P80'],
    ['Cost', 'P81'],
    ['By step or material', 'P79'],
    ['What differs', 'P77'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await row(page.getByRole('tabpanel').or(page.locator('.cmp-more .pp-card')).first(), id, `${tab} always visible`);
  }
  // One case alone reads on its own.
  await page.goto(`/project/${projectId}/comparison?cases=${second}`);
  await row(page.getByRole('region', { name: 'One case' }), 'P84', 'One case reads on its own');
  await row(page.getByRole('region', { name: 'One case' }).getByRole('link', { name: 'Open the case' }), 'P72', 'An incomplete case gets "Open the case"');
  // Saved comparisons (G126): the list reads what was saved; saving new ones was retired (CMP-7, f12), so a
  // project with none says so instead of an empty list.
  await page.goto(`/project/${projectId}/comparison?tab=saved`);
  await row(page.getByText('No saved comparisons in this project yet.'), 'G126', 'Saved comparisons list');
  await page.goto(`/project/${projectId}/comparison?cases=${baseCaseId},${caseId}`);
  await row(page.getByRole('region', { name: 'Totals' }), 'P63', 'the Compare tab opens the chosen cases again');
  // Different regions refuse a percentage (A3, 2026-11-01): both totals stay, labelled as not comparable.
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'Global' });
  await page.goto(`/project/${projectId}/comparison?cases=${baseCaseId},${caseId}`);
  await row(page.getByRole('region', { name: 'Totals' }).getByText(/^Not comparable: Region differs: US vs Global\./), 'P65', 'Different regions: both totals, no percentage');
  // An older run (no frozen results) says so; the sample's base run is frozen, so this checks the wording is absent.
  await expect.soft(page.getByText(/An older run: made before results were saved/), note('P71', 'only for runs without a snapshot')).toHaveCount(0);
});

test('P138 P141 the Cases board counts who has no case from a view that sees every case, and the Overview uses Results\' formats', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const owner = await newUser('hub-board');
  const as = api.as(owner.token);
  const { projectId, baseId } = await studyWithCase(as, 'Board study');
  const a = await newUser('hub-board-a');
  const b = await newUser('hub-board-b');
  for (const u of [a, b]) await as.post(`/api/projects/${projectId}/members`, { email: u.email, role: 'editor' });
  await as.post(`/api/cases/${baseId}/assessments`, {});
  const { page } = await signIn(owner);
  await open(page, `/project/${projectId}/cases`, { ready: 'Cases' });
  await row(page.getByText(/2 people have no case yet/).first(), 'P138', 'the count of people with no case (2.7)');
  await expect.soft(page.getByText(/Cut frame · .*copied/), note('P138', 'the base case is not "copied"')).toHaveCount(0);
  await open(page, `/project/${projectId}`, { ready: 'Board study' });
  const kpis = page.getByRole('list', { name: 'Project summary' });
  await expect.soft(kpis.getByText(/^\$[\d,]+\.\d{2}$|^–$/).first(), note('P141', 'money as Results writes it (3.4)')).toBeVisible();
  await expect.soft(kpis.getByText(/^\d{1,3}(,\d{3})*\.\d{3}$/).first(), note('P141', 'an impact as Results writes it (3.4)')).toBeVisible();
  await expect.soft(page.getByText(/\d\.\d{3,}%/), note('P141', 'shares to one decimal, never "89.39187362460063%"')).toHaveCount(0);
});
