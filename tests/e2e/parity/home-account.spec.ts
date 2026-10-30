/**
 * Task 8 (group F): Home's counts, filters, search, grid and list, cards and
 * pins; the empty Home; the libraries in the shell; Profile; onboarding; and
 * the findings from discovery runs 1 and 2 that belong here. Every row's test
 * title starts with its ID.
 */
import { expect, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

test('G06 G07 G08 G09 G10 G11 G12 G15 G18 G19 G20 G21 G22 G24 Home counts, filters, search, grid and list, cards and pins', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('home-later');
  const as = api.as(user.token);
  const one = (await as.post('/api/projects', { project_name: 'Frame study', description: 'Steel against aluminium frames' })).project.project_id as number;
  const base = (await as.post(`/api/projects/${one}/cases`, { case_name: 'Steel frame', case_type: 'base', description: 'Base' })).case.case_id as number;
  const step = (await as.post(`/api/cases/${base}/components`, { component_name: 'Frame', component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' })).component.component_id as number;
  const steel = (await as.get('/api/substances')).substances.find((s: any) => s.substance_name === 'Steel').substance_id;
  await as.post(`/api/components/${step}/flows`, { substance_id: steel, flow_type: 'input', quantity: 2, unit: 'kg' });
  await as.post(`/api/cases/${base}/assessments`, {});
  await as.post(`/api/cases/${base}/duplicate`, { case_name: 'Aluminium frame' });
  await as.post('/api/projects', { project_name: 'Second study', description: 'One case only' });
  const { page } = await signIn(user);
  await open(page, '/home', { ready: 'Your projects' });

  const counts = page.getByRole('list', { name: 'Home counts' });
  await row(counts.getByText(/^Projects/i), 'G06', 'KPI tile: projects');
  await row(counts.getByText(/^Cases/i), 'G07', 'KPI tile: cases and steps');
  await row(counts.getByRole('link', { name: /Factors/i }), 'G08', 'KPI tile: factors, links to the factor library');
  await row(counts.getByRole('link', { name: /Substances/i }), 'G09', 'KPI tile: substances, links to the substance library');
  await expect.soft(counts.getByText('Loading…'), note('G08', 'the counts load')).toHaveCount(0, NAV);

  const card = page.locator('.home-project').filter({ hasText: 'Frame study' });
  await row(card.getByText('Steel against aluminium frames'), 'G15', 'Card shows the description');
  await row(card.getByText(/\d+ steps/), 'G18', 'Card shows the step count');
  await row(card.getByText(/Last run /), 'G19', 'Card shows the last run time');
  await row(card.getByText('Comparison', { exact: true }), 'G20', 'Single case / Comparison chip');
  await row(card.getByText(/Updated /), 'G21', '"Updated X ago"');

  const show = page.getByRole('radiogroup', { name: 'Show projects' });
  await show.getByRole('radio', { name: 'Single case' }).click();
  await expect.soft(page.locator('.home-project').filter({ hasText: 'Frame study' }), note('G10', 'Single case leaves out a comparison')).toHaveCount(0);
  await row(page.locator('.home-project').filter({ hasText: 'Second study' }), 'G10', 'All / Single case / Comparison filter');
  await show.getByRole('radio', { name: 'All' }).click();

  await page.getByRole('radiogroup', { name: 'Layout' }).getByRole('radio', { name: 'List' }).click();
  const list = page.getByRole('table', { name: 'Your projects' });
  await row(list, 'G12', 'Grid / list switch');
  for (const col of ['Name', 'Type', 'Cases', 'Steps', 'Last run', 'Updated']) await row(list.getByRole('columnheader', { name: col }), 'G22', 'List view columns');
  await page.getByRole('radiogroup', { name: 'Layout' }).getByRole('radio', { name: 'Grid' }).click();

  const pin = page.getByRole('button', { name: 'Pin Frame study' });
  await pin.click();
  await row(page.getByRole('button', { name: 'Unpin Frame study' }), 'G24', 'Pin a project');
  await page.getByRole('button', { name: 'Unpin Frame study' }).click();
  await row(page.getByRole('button', { name: 'Pin Frame study' }), 'G24', 'and unpin it');

  await page.getByRole('combobox', { name: 'Find a project or case' }).fill('aluminium frames');
  await row(page.getByText('Frame study').last(), 'G11', 'Search matches descriptions');
});

test('G27 G30 G147 the empty Home shows the ISO path and the standards, and offers a teacher a class', async ({ api, newUser, signIn }) => {
  const user = await newUser('home-empty');
  await api.as(user.token).put('/api/auth/profile', { fullName: 'Tess Teacher', useCase: 'teaching' });
  const { page } = await signIn(user);
  await open(page, '/home', { ready: 'Welcome to LCAPIX' });
  await row(page.getByRole('heading', { name: /ISO 14040 · 5 phases/i }), 'G27', 'Empty: ISO 14040 five-phase rail');
  await row(page.getByText('Goal & scope').first(), 'G27', 'the five phases');
  await row(page.getByRole('heading', { name: /Built on standards you can defend/i }), 'G30', 'Empty: trust strip');
  await row(page.getByText('ISO 14044'), 'G30', 'the standards named');
  await page.getByRole('button', { name: 'Set up a class' }).click();
  await expect(page).toHaveURL(/\/project\/\d+\/people$/, NAV);
  const id = Number(/\/project\/(\d+)\//.exec(page.url())![1]);
  const p = (await api.as(user.token).get(`/api/projects/${id}`)).project;
  expect.soft(p.members_see_own_cases, note('G147', 'the class project has "see only their own case" on (2.1)')).toBe(true);
});

test('G32 G45 G123 G124 the libraries open from the sidebar and Home, inside the shell', async ({ newUser, signIn }) => {
  const user = await newUser('home-libraries');
  const { page } = await signIn(user);
  await open(page, '/home', { ready: 'Welcome' });
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Factors' }).click();
  await row(page.getByRole('heading', { name: 'Factor library' }), 'G123', 'Factor library linked from the sidebar');
  await row(nav, 'G32', 'the factor library sits inside the shell');
  await nav.getByRole('link', { name: 'Substances' }).click();
  await row(page.getByRole('heading', { name: 'Substance catalog' }), 'G124', 'Substance library linked from the sidebar');
  await row(nav, 'G45', 'the substance library sits inside the shell');
});

test('G61 G64 G66 G104 G106 G148 G149 G150 profile and About you: optional institution, one set of choices, honest buttons and names', async ({ api, newUser, signIn, page: anon }) => {
  // G148 (1.11): the sign-up line names students.
  await open(anon, '/auth/signup', { ready: 'Create your account' });
  await row(anon.getByText(/For students, instructors and researchers/), 'G148', 'Sign-up names students');

  const fresh = await newUser('home-onboard', { onboard: false });
  const { page } = await signIn(fresh);
  await open(page, '/auth/onboarding', { ready: 'About you' });
  await row(page.getByRole('radio', { name: /Student in a class/ }), 'G104', 'Onboarding use cases, matching Profile');
  await row(page.getByText(/Kept on this device/), 'G149', 'Guided mode says where it is kept, with no COMING SOON (1.12)');
  await expect.soft(page.getByText(/COMING SOON/i), note('G149', 'no COMING SOON')).toHaveCount(0);
  await row(page.getByRole('button', { name: 'Open the sample study' }), 'G106', 'Save builds the sample only when the account has none');

  // Not onboarded yet (an onboarded account is sent on from About you), but already owning a project.
  const owner = await newUser('home-profile', { onboard: false });
  const s2 = await signIn(owner);
  await api.as(owner.token).post('/api/projects', { project_name: 'Mine', description: '' });
  await open(s2.page, '/auth/onboarding', { ready: 'About you' });
  await expect.soft(s2.page.getByRole('button', { name: 'Save and go to Home' }), note('G106', 'with a project, Save says it goes Home')).toBeVisible();
  // A current choice: an old one ("product") is offered only to whoever already has it.
  await api.as(owner.token).put('/api/auth/profile', { fullName: 'Pat Profile', company: '', role: 'Lecturer', useCase: 'lab', country: 'United States' });

  await open(s2.page, '/profile', { ready: 'ACCOUNT' });
  await row(s2.page.getByText('Institution or company (optional)'), 'G64', 'Institution optional on Profile');
  const useCase = s2.page.getByRole('combobox').filter({ has: s2.page.locator('option', { hasText: 'Student in a class' }) });
  await row(useCase, 'G66', 'Profile use-case options are onboarding\'s');
  await expect.soft(useCase.locator('option', { hasText: 'Product LCA' }), note('G66', 'old choices are not offered to everyone')).toHaveCount(0);
  await useCase.selectOption({ label: 'Teaching a class' });
  await s2.page.getByRole('button', { name: /Save/ }).first().click();
  await row(s2.page.getByText('Teaching a class').first(), 'G61', 'The meta row shows the new value');

  // G150 (1.13): New project's start choice and dropdowns have names.
  await open(s2.page, '/project/new', { ready: 'Start your own project' });
  await row(s2.page.getByRole('radio', { name: 'Start from a file' }), 'G150', 'readable names for the start choice');
  for (const n of ['System boundary', 'Method', 'Region']) await row(s2.page.getByRole('combobox', { name: n }), 'G150', `readable name for ${n}`);
});
