/**
 * The walkthrough film, end to end (design/education/walkthrough/script.md).
 *
 * Dr. Elena Rivera arrives from the website, reads the finished sample study,
 * tries it on her own copy, starts her own project from a file, and teaches a
 * class with it; Ana Ruiz, one of her students, makes a case of her own,
 * writes it up, ticks it as her hand-in, and reads it on a phone. One
 * continuous journey in the film's order, with the film's own numbers wherever
 * the sample makes them (1.72, 89 %, 1.667, 3.1 % lower, $1.75, 1.682). The
 * film's class (34 cases, run 301) is its own; here the class is the one this
 * journey builds, and the numbers it checks are the ones that class gives.
 *
 * Runs on a database built from nothing, and on a copy of production
 * (E2E_FROM_DUMP, see support/serve.mjs). Everything the film shows is done
 * through the screens; only what it does not show (the class's base case and
 * the students' accounts) is set up through the API.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { newPassword, uniqueEmail, type Api, type ApiUser } from '../support/api';
import { CONTEXT_DEFAULTS, expect, test } from '../support/fixtures';
import { installNetGuard } from '../support/net';
import { E2E_DIR } from '../support/paths';
import { expectCleanCopy } from '../support/copy';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };
const doc = (name: string) => path.join(E2E_DIR, 'fixtures', 'import', name);

/**
 * E2E_CAPTURE_DIR=<dir>: a full-page screenshot at each moment a designed
 * screen appears, named by its design ID (design/education/screens), for the
 * side-by-side review (scripts/review/side-by-side.py). Off otherwise.
 */
const CAPTURE = process.env.E2E_CAPTURE_DIR;
if (CAPTURE) mkdirSync(CAPTURE, { recursive: true });
async function shot(page: Page, id: string): Promise<void> {
  // Every designed moment is also read the way a person reads it (support/copy.ts).
  await expectCleanCopy(page, id);
  if (!CAPTURE) return;
  await page.waitForLoadState('networkidle').catch(() => {});
  // The app scrolls inside its main column, not the document, so a full-page
  // screenshot stops at the window: grow the window to the tallest scroller.
  const size = page.viewportSize()!;
  const tall = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      ...Array.from(document.querySelectorAll<HTMLElement>('main, main *'))
        .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight)
        .map((e) => e.scrollHeight + e.getBoundingClientRect().top),
    ),
  );
  const grow = tall > size.height;
  if (grow) await page.setViewportSize({ width: size.width, height: Math.min(Math.ceil(tall), 8000) });
  await page.screenshot({ path: path.join(CAPTURE, `${id}.png`), fullPage: true, animations: 'disabled' });
  if (grow) await page.setViewportSize(size);
}

/** A person on their own network: the sign-up limit (3 an hour) is per address, as for real people. */
async function person(browser: Browser, opts: { phone?: boolean } = {}): Promise<{ context: BrowserContext; page: Page }> {
  const b = randomBytes(3);
  const context = await browser.newContext({
    ...CONTEXT_DEFAULTS,
    ...(opts.phone ? { viewport: { width: 390, height: 844 }, hasTouch: true } : {}),
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'x-forwarded-for': `10.${b[0]}.${b[1]}.${(b[2] % 250) + 1}` },
  });
  await installNetGuard(context);
  return { context, page: await context.newPage() };
}

const posted = (page: Page, re: RegExp, method = 'POST') =>
  page.waitForResponse((r) => re.test(new URL(r.url()).pathname) && r.request().method() === method, NAV);

/** Elena's class: a project with a base case built like the sample's (its 17 steps and flows), run. */
async function classProject(api: Api, elena: ApiUser, sample: { case_id: number }): Promise<{ projectId: number; baseCaseId: number }> {
  const as = api.as(elena.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', {
    project_name: 'ENVE 410 bracket study',
    description: 'The class project: one base case, one case each.',
  })).project.project_id;
  await as.put(`/api/projects/${projectId}`, {
    functional_unit: '1 painted steel bracket',
    system_boundary: 'cradle-to-gate',
    lcia_method: 'TRACI 2.1',
    region_code: 'US',
  });
  const baseCaseId = (await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, { case_name: 'Base case', case_type: 'base' })).case.case_id;
  // Per 1 bracket, as the sample's base case.
  await as.put(`/api/cases/${baseCaseId}`, { reference_flow: 1, reference_flow_unit: 'bracket' });
  type Comp = {
    component_id: number;
    component_name: string;
    component_type: string;
    parent_component_id: number | null;
    quantity: number | string | null;
    unit: string | null;
    description: string | null;
  };
  const comps = (await as.get<{ components: Comp[] }>(`/api/cases/${sample.case_id}/components`)).components;
  const made = new Map<number, number>();
  const pending = [...comps];
  while (pending.length) {
    const i = pending.findIndex((c) => c.parent_component_id == null || made.has(Number(c.parent_component_id)));
    const c = pending.splice(i, 1)[0];
    const d = await as.post<{ component: { component_id: number } }>(`/api/cases/${baseCaseId}/components`, {
      component_name: c.component_name,
      component_type: c.component_type,
      parent_component_id: c.parent_component_id == null ? null : made.get(Number(c.parent_component_id)),
      ...(c.quantity != null ? { quantity: Number(c.quantity) } : {}),
      ...(c.unit ? { unit: c.unit } : {}),
      ...(c.description ? { description: c.description } : {}),
    });
    made.set(Number(c.component_id), Number(d.component.component_id));
  }
  type Row = { component_id: number; substance_id: number; direction: string; amount: number; unit: string; status: string };
  for (const r of (await as.get<{ rows: Row[] }>(`/api/cases/${sample.case_id}/inventory`)).rows.filter((x) => x.status !== 'left_out')) {
    await as.post(`/api/components/${made.get(r.component_id)}/flows`, { substance_id: r.substance_id, flow_type: r.direction, quantity: r.amount, unit: r.unit });
  }
  await as.post(`/api/cases/${baseCaseId}/assessments`, {});
  return { projectId, baseCaseId };
}

test('the walkthrough film, chapter by chapter', async ({ browser, api }) => {
  test.setTimeout(25 * 60_000);
  const elena = { name: 'Elena Rivera', email: uniqueEmail('elena'), password: newPassword() };
  // A capture run is also the demo: who to log in as, next to the screenshots.
  if (CAPTURE) appendFileSync(path.join(CAPTURE, 'accounts.txt'), `elena (professor) ${elena.email}=${elena.password}\n`);
  const { context, page } = await person(browser);
  let sample = { project_id: 0, case_id: 0 };
  let copy = { projectId: 0, caseId: 0 };

  await test.step('1. Arrive: the landing, sign-up, About you, and the sample builds', async () => {
    await open(page, '/', { ready: 'Know the footprint of anything you make.' });
    // The product at work: the bracket's tree and its answer.
    await expect(page.getByText('1.72').first()).toBeVisible();
    await shot(page, 'F1.1-landing');
    await page.getByRole('link', { name: /^Get started/ }).first().click();
    await expect(page).toHaveURL(/\/auth\/signup/, NAV);
    // Continue with Google is the first stop.
    await expect(page.getByRole('link', { name: 'Continue with Google' }).or(page.getByRole('button', { name: 'Continue with Google' })).first()).toBeVisible(NAV);
    await shot(page, 'F1.2-sign-up');
    await page.getByLabel('Your name').fill(elena.name);
    await page.getByLabel('Email').fill(elena.email);
    await page.getByLabel('Password', { exact: true }).fill(elena.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // About you: one step, and Guided mode stays off.
    await expect(page.getByRole('heading', { name: 'Tell us a little about you.' })).toBeVisible(NAV);
    await expect(page.getByLabel('Full name')).toHaveValue(elena.name);
    await page.getByLabel(/^Institution/).fill('State University');
    await expect(page.getByRole('switch', { name: 'Guided mode' })).not.toBeChecked();
    await shot(page, 'F1.3-about-you');

    // Building the sample takes a few seconds.
    const built = posted(page, /^\/api\/example-project$/);
    await page.getByRole('button', { name: 'Open the sample study' }).click();
    await shot(page, 'F1.4-building-the-sample');
    const res = await built;
    expect(res.status()).toBe(200);
    sample = await res.json();
    await expect(page).toHaveURL(/\/home$/, NAV);
  });

  await test.step('2. Read the finished study: Home is the sample, in research order', async () => {
    await expect(page.getByText('Sample study', { exact: true })).toBeVisible(NAV);
    await expect(page.getByText('Read-only · made for you when you signed up')).toBeVisible();
    // The answer, what builds it, and the what-if.
    await expect(page.getByText('1.72', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('17 steps in five tiers, from the product down to each task.')).toBeVisible();
    await expect(page.getByText('89% comes from 10. Cut blank, almost all of it steel.')).toBeVisible();
    await expect(page.getByText('1.667').first()).toBeVisible();
    await expect(page.getByText(/3\.1\s?% lower/).first()).toBeVisible();
    await shot(page, 'E02-home-sample-study');
  });

  await test.step('3. Try it on her own copy: tree, panel, keys, inventory, results, costs', async () => {
    const copied = posted(page, /^\/api\/cases\/\d+\/duplicate$/);
    await page.locator('header').getByRole('button', { name: 'Make my own copy' }).click();
    const res = await copied;
    expect(res.status()).toBe(201);
    await expect(page).toHaveURL(/\/project\/\d+\/case\/\d+$/, NAV);
    const [, p, c] = /\/project\/(\d+)\/case\/(\d+)$/.exec(new URL(page.url()).pathname)!;
    copy = { projectId: Number(p), caseId: Number(c) };
    const tree = page.getByRole('tree');
    await expect(tree).toBeVisible(NAV);
    await expect(page.getByRole('treeitem')).toHaveCount(17);
    await expect(page.getByText(/not run yet/i).first()).toBeVisible();

    // The step panel: each flow is an amount times a factor (0.8 kg × 1.9 = 1.52).
    await page.getByRole('treeitem', { name: /^10\. Cut blank, / }).click();
    const panel = page.getByRole('complementary', { name: /10\. Cut blank/ });
    await expect(panel).toBeVisible(NAV);
    await expect(panel.getByText('1.52').first()).toBeVisible();
    await shot(page, 'E03-case-tree');

    // Hide the panel; Show panel brings it back.
    await page.getByRole('button', { name: 'Hide panel' }).click();
    await expect(panel).toBeHidden();
    await shot(page, 'E03b-tree-panel-hidden');
    await page.getByRole('button', { name: 'Show panel' }).click();
    await expect(panel).toBeVisible();

    // Keys: the tree is one Tab stop; M opens the selected step's menu.
    await tree.focus();
    await page.keyboard.press('m');
    const menu = page.getByRole('menu', { name: '10. Cut blank menu' });
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Delete step' })).toBeVisible();
    await shot(page, 'E03c-keyboard-and-step-menu');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Inventory: every flow with its status. The film's deburring line needs
    // an amount; the sample is finished, so clear it first, then the machine
    // calculator puts 0.75 kW x 8 s x 80 % = 0.0013 kWh back on the row.
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    const deburr = page.getByRole('row').filter({ hasText: 'Deburr edges · IN' });
    const box = deburr.getByRole('textbox', { name: 'Electricity' });
    await expect(box).toHaveValue('0.0013', NAV);
    const cleared = posted(page, /^\/api\/flows\/\d+$/, 'PUT');
    await box.fill('');
    await box.press('Enter');
    expect((await cleared).status()).toBe(200);
    const calc = page.getByRole('group', { name: 'Machine calculator for Electricity' });
    await calc.getByLabel('Power in kW').fill('0.75');
    await calc.getByLabel('Time in seconds').fill('8');
    await calc.getByLabel('Load in percent').fill('80');
    await shot(page, 'E04-case-inventory');
    const used = posted(page, /^\/api\/flows\/\d+$/, 'PUT');
    await calc.getByRole('button', { name: 'Use 0.0013 kWh' }).click();
    expect((await used).status()).toBe(200);
    await expect(box).toHaveValue('0.0013');

    // Results: the answer, and the cost beside it.
    const ran = posted(page, /^\/api\/cases\/\d+\/assessments$/);
    await page.getByRole('button', { name: 'Run Assessment', exact: true }).click();
    expect((await ran).status()).toBe(201);
    await expect(page).toHaveURL(/tab=results/, NAV);
    await expect(page.locator('.ws-answer-num')).toHaveText('1.720', NAV);
    // Cost beside impact: the weld tab is 31.4 % of the cost and 2.4 % of the impact.
    await expect(page.getByText('Cost beside impact')).toBeVisible();
    await expect(page.getByText('$1.75', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('row', { name: /^20\. Weld tab \$0\.55 31\.4% 0\.042/ })).toBeVisible();
    await shot(page, 'E05-case-results');

    // Step costs: the tree's Cost view; the weld tab is 55 cents, 4 of its 6 kinds set.
    await page.getByRole('tab', { name: /^Tree/ }).click();
    await page.getByRole('radio', { name: 'Cost' }).click();
    const weld = page.getByRole('treeitem', { name: /^20\. Weld tab, / });
    await expect(weld).toContainText('$0.55', NAV);
    await weld.click();
    await expect(page.getByText('4 of 6 set')).toBeVisible(NAV);
    const bracket = page.getByRole('treeitem', { name: /^Painted steel bracket, / });
    await expect(bracket).toContainText('Σ $1.75');
    await shot(page, 'E14-step-costs');

    // One addition reaches every place it touches: a box on Fold and tape
    // offers its material cost (0.2 kg × $0.60 = $0.12) and names the tape,
    // which has no price. Nothing changes until Use it; then the step, the
    // tree's sums and the Cost view all carry it.
    await page.getByRole('radio', { name: 'Impact' }).click();
    // The panel sits over the packing steps: hide it, pick the step, bring it back.
    await page.getByRole('button', { name: 'Hide panel' }).click();
    await page.getByRole('treeitem', { name: /^Fold and tape, / }).click();
    await page.getByRole('button', { name: 'Show panel' }).click();
    const fold = page.getByRole('complementary', { name: /Fold and tape/ });
    await fold.getByRole('button', { name: '+ Add a flow to this step' }).click();
    await fold.getByPlaceholder('Search substances…').fill('Cardboard');
    await fold.getByRole('button', { name: /^Cardboard\b/ }).first().click();
    await fold.getByPlaceholder('0.0').fill('0.2');
    await fold.getByPlaceholder('kg').fill('kg');
    const boxAdded = posted(page, /^\/api\/components\/\d+\/flows$/);
    await fold.getByRole('button', { name: 'Save flow' }).click();
    expect((await boxAdded).status()).toBe(201);
    await expect(fold.getByText('Material cost from these flows: $0.12')).toBeVisible(NAV);
    const addTape = fold.getByRole('button', { name: 'No price for Packaging tape: add its cost →' });
    await expect(addTape).toBeVisible();
    await expect(page.getByText('Flow added')).toBeHidden(NAV);
    await shot(page, 'E14b-cost-from-flows');
    const priced = posted(page, /^\/api\/components\/\d+\/costs$/, 'PUT');
    await fold.getByRole('button', { name: 'Use the material cost from these flows' }).click();
    const pricedRes = await priced;
    expect(pricedRes.status()).toBe(200);
    expect(pricedRes.request().postDataJSON()).toEqual({ kind: 'material', mode: 'flows' });
    await expect(fold.getByText('Saved · material from the flows on Fold and tape')).toBeVisible();
    await expect(fold.getByText(/Material cost from these flows/)).toBeHidden(NAV);
    // "add its cost" opens the Cost view on Material, the flows line by line.
    await addTape.click();
    await expect(page.getByRole('radio', { name: 'Cost' })).toBeChecked();
    await expect(fold.getByText('Set the material cost')).toBeVisible(NAV);
    await expect(fold.getByText('Cardboard 0.2 kg × $0.60/kg = $0.12')).toBeVisible();
    await expect(fold.getByText('2 of 6 set')).toBeVisible();
    await expect(bracket).toContainText('Σ $1.87');
    await page.getByRole('radio', { name: 'Impact' }).click();
  });

  let own = { projectId: 0, caseId: 0 };
  await test.step('4. Her own project, from a file: routing, bill of materials, a file that fails, start empty', async () => {
    // The question comes first, one unit for every case.
    await open(page, '/project/new', { ready: 'Start your own project' });
    await page.getByLabel(/^Project name/).fill('Aluminium enclosure');
    await page.getByLabel('Functional unit').fill('1 enclosure');
    await expect(page.getByRole('radio', { name: /^From a file/ })).toBeChecked();
    await shot(page, 'F2.1-new-project');
    await page.getByRole('button', { name: 'Continue →' }).click();
    await expect(page.getByText('What kind of file is it?')).toBeVisible(NAV);
    own.projectId = Number(/\/project\/(\d+)\//.exec(new URL(page.url()).pathname)![1]);

    // Other file types are coming soon, like utility bills and cost sheets.
    await expect(page.getByText('Utility bills, permits, transport records, cost sheets')).toBeVisible();
    // A routing: the steps in order, and their hours. Nothing is saved until Save.
    await page.getByRole('radio', { name: 'Routing' }).click();
    await page.locator('input[type="file"]').setInputFiles(doc('small-routing.csv'));
    await page.getByText('More details (optional)').click();
    await page.getByPlaceholder('e.g. Aluminium enclosure').fill('Aluminium enclosure');
    await shot(page, 'F2.2-add-a-file');
    const preview = posted(page, /^\/api\/ingest\/preview$/);
    await page.getByRole('button', { name: /^Check what we read/ }).click();
    expect((await preview).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
    await expect(page.getByText('Nothing is saved until you press Save.', { exact: false })).toBeVisible();
    for (const op of ['10. Cut tube', '20. Weld frame', '30. Pack']) await expect(page.getByRole('checkbox', { name: `Keep ${op}` })).toBeChecked();
    await page.getByLabel('Case name').fill('As routed');
    await shot(page, 'F2.3-check-what-we-read');
    const applied = posted(page, /^\/api\/ingest\/apply$/);
    await page.getByRole('button', { name: /Save \d+ steps? to a new case$/ }).click();
    const res = await applied;
    expect(res.status()).toBe(201);
    own.caseId = (await res.json()).case_id;
    await expect(page.getByText(/^Saved\./)).toBeVisible(NAV);
    // A checklist: the tree and the labour hours done; materials, energy and a run not yet.
    const stands = page.getByRole('region', { name: 'Where this case stands' }).or(page.locator('section[aria-labelledby="stands-h"]'));
    await expect(stands.getByText('Labour hours')).toBeVisible(NAV);
    await expect(stands.getByRole('listitem').filter({ hasText: 'Labour hours' })).toContainText('3 of 3');
    for (const row of ['Materials', 'Energy', 'Run']) await expect(stands.getByRole('listitem').filter({ hasText: row })).toContainText('Not yet');
    // The sidebar counts the new case at once (it said "0 cases" until a reload).
    await expect(page.getByRole('button', { name: /Switch project$/ }).first()).toContainText('1 case', NAV);
    await shot(page, 'F2.4-saved');

    // The bill of materials: each line is matched and goes on a step before Save.
    await open(page, `/project/${own.projectId}/import`, { ready: 'What kind of file is it?' });
    await page.getByRole('radio', { name: 'Bill of materials' }).click();
    await page.getByLabel('Into').selectOption(String(own.caseId));
    await page.locator('input[type="file"]').setInputFiles(doc('small-bom.csv'));
    const bomPreview = posted(page, /^\/api\/ingest\/preview$/);
    await page.getByRole('button', { name: /^Check what we read/ }).click();
    expect((await bomPreview).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
    for (const line of ['Frame tube set', 'Shipping box']) {
      await expect(page.locator('tr', { hasText: line }).last().getByLabel('Step this line is used at')).toHaveValue(/^\d+$/);
    }
    await shot(page, 'F2.6-add-bill-of-materials');
    const bomApplied = posted(page, /^\/api\/ingest\/apply$/);
    await page.getByRole('button', { name: /Save \d+ lines? to / }).click();
    expect((await bomApplied).status()).toBe(200);

    // The case the two files made: its steps read as written, and where each
    // came from shows quietly on the panel, never as a raw tag on the card.
    await open(page, `/project/${own.projectId}/case/${own.caseId}`);
    await expect(page.getByRole('tree')).toBeVisible(NAV);
    await expectCleanCopy(page, 'the case made from a routing and a bill of materials');
    await page.getByRole('treeitem', { name: /^Aluminium enclosure, Product/ }).click();
    await expect(page.getByText('From small-routing.csv', { exact: false }).first()).toBeVisible(NAV);

    // A file that cannot be read: a scanned PDF, with the fix right there.
    await open(page, `/project/${own.projectId}/import`, { ready: 'What kind of file is it?' });
    await page.getByRole('radio', { name: 'Routing' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'routing-scan.pdf', mimeType: 'application/pdf', buffer: blankPdf() });
    const failed = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
    await page.getByRole('button', { name: /^Check what we read/ }).click();
    await failed;
    const card = page.getByRole('alert').filter({ hasText: "We couldn't read routing-scan.pdf" });
    await expect(card).toContainText('It looks scanned, so there is no text to read.', NAV);
    await expect(card.getByRole('button', { name: 'Upload the spreadsheet version' })).toBeVisible();
    await shot(page, 'F2.2b-file-cant-be-read');

    // Or start empty: the product at the top, and the first step under it.
    await open(page, '/project/new', { ready: 'Start your own project' });
    await page.getByLabel(/^Project name/).fill('Enclosure, from scratch');
    await page.getByLabel('Functional unit').fill('1 enclosure');
    await page.getByRole('radio', { name: /^Empty/ }).click();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await expect(page.getByRole('heading', { name: 'Build the tree for 1 enclosure' })).toBeVisible(NAV);
    await shot(page, 'F2.5-start-empty');
    // She picks its tier, and gives it a name.
    await expect(page.getByRole('radiogroup', { name: 'Tier of the first step' }).getByRole('radio', { name: 'Machine / line' })).toBeChecked();
    await page.getByRole('textbox', { name: 'Name of the machine / line' }).fill('Press line');
    const added = posted(page, /^\/api\/cases\/\d+\/components$/);
    await page.getByRole('button', { name: '+ Add step' }).click();
    expect((await added).status()).toBe(201);
    await expect(page.getByRole('treeitem', { name: 'Press line, Machine / line' })).toBeVisible(NAV);
  });

  let cls = { projectId: 0, baseCaseId: 0 };
  let whatIfId = 0;
  let ana: ApiUser;
  await test.step('5. Teach with it: Home later, people, privacy, a what-if, Compare, Analytics, Reports', async () => {
    // What the film does not show being made: the class's base case (the
    // sample's tree, run) and the students' accounts (they need one; no email
    // is sent). Ben's case is made and run for him.
    const token = (await page.evaluate(() => localStorage.getItem('auth_token')))!;
    const elenaApi = { token } as ApiUser;
    cls = await classProject(api, elenaApi, sample);
    ana = await api.createUser({ email: uniqueEmail('ana'), fullName: 'Ana Ruiz', onboard: true });
    if (CAPTURE) appendFileSync(path.join(CAPTURE, 'accounts.txt'), `ana (student) ${ana.email}=${ana.password}\n`);
    const ben = await api.createUser({ email: uniqueEmail('ben'), fullName: 'Ben Okafor', onboard: true });

    // Home, later: her own work, and the switcher keeps the sidebar calm.
    await open(page, '/home');
    await expect(page.getByText('ENVE 410 bracket study').first()).toBeVisible(NAV);
    await shot(page, 'E12-home-later');
    await page.getByRole('button', { name: /Switch project$/ }).first().click();
    const switcher = page.getByRole('dialog', { name: 'Switch project' });
    await expect(switcher.getByRole('listbox', { name: 'Projects' })).toContainText('Aluminium enclosure');
    await shot(page, 'E19-many-projects');
    await page.keyboard.press('Escape');

    // People: added by email; each can change, or can only read.
    await open(page, `/project/${cls.projectId}/people`, { ready: 'Add people' });
    await page.getByLabel('Email addresses').fill(`${ana.email}\n${ben.email}`);
    await expect(page.getByRole('radio', { name: 'Can change' })).toBeChecked();
    const addedPeople = posted(page, new RegExp(`^/api/projects/${cls.projectId}/members$`));
    await page.getByRole('button', { name: 'Add to this project' }).click();
    expect((await addedPeople).status()).toBe(200);
    await expect(page.getByRole('row', { name: /^Ana Ruiz/ })).toBeVisible(NAV);
    await expect(page.getByRole('row', { name: /^Ben Okafor/ })).toBeVisible();
    await shot(page, 'E08-people');

    // Ben makes his case and runs it (off screen).
    const benCase = (await api.as(ben.token).post<{ case_id: number }>(`/api/cases/${cls.baseCaseId}/duplicate`, { case_name: "Ben's case" })).case_id;
    await api.as(ben.token).post(`/api/cases/${benCase}/assessments`, {});

    // One switch shows students only their own case; turning it on asks first.
    // With students on it, the switch says so ("Members" before anyone is added).
    await page.getByRole('switch', { name: 'Students see only their own case' }).click();
    const ask = page.getByRole('alertdialog');
    await expect(ask).toContainText('see only the cases they made', NAV);
    await expect(ask).toContainText('Ana Ruiz');
    await shot(page, 'E08b-privacy-confirm');
    await ask.getByRole('button', { name: 'Turn on' }).click();
    await expect(page.getByRole('switch', { name: 'Students see only their own case' })).toBeChecked(NAV);

    // Cases: what exists in each student's work, as a pipeline or a table. No reminders go out.
    await open(page, `/project/${cls.projectId}/cases`, { ready: /No reminders go out/ });
    await expect(page.getByText("Ben's case").first()).toBeVisible();
    await shot(page, 'E07-cases-pipeline');
    await page.getByRole('radio', { name: 'Table' }).click();
    await expect(page.getByRole('row', { name: /Ben's case/ })).toContainText('Not ticked');
    await shot(page, 'E07b-cases-table');

    // A new case is a what-if: copy the base case, and change one thing.
    await open(page, `/project/${cls.projectId}/case/new`, { ready: /New case/ });
    await page.getByLabel(/^Case name/).fill('Shorter cure cycle');
    await page.getByLabel(/^What will you change\?/).fill('The cure oven runs a shorter cycle (0.40 to 0.25 kWh).');
    await shot(page, 'E18-new-case');
    const made = posted(page, /^\/api\/cases\/\d+\/duplicate$/);
    await page.getByRole('button', { name: 'Make the case →' }).click();
    const madeRes = await made;
    expect(madeRes.status()).toBe(201);
    whatIfId = (await madeRes.json()).case_id;
    await expect(page.getByRole('tree')).toBeVisible(NAV);
    const whatIfUrl = page.url();
    // Before it runs, Compare says which check fails, and what to do.
    await open(page, `/project/${cls.projectId}/comparison?cases=${cls.baseCaseId},${whatIfId}`, { ready: 'Not comparable yet' });
    await expect(page.getByText('Fails: A case has no run')).toBeVisible();
    await shot(page, 'E09b-compare-failed-check');
    await open(page, new URL(whatIfUrl).pathname);
    await expect(page.getByRole('tree')).toBeVisible(NAV);
    await page.getByRole('treeitem', { name: /^30\. Powder coat and cure, / }).click();
    const cure = page.getByRole('complementary', { name: /30\. Powder coat and cure/ }).getByRole('textbox', { name: 'Electricity' });
    const changed = posted(page, /^\/api\/flows\/\d+$/, 'PUT');
    await cure.fill('0.25');
    await cure.press('Enter');
    expect((await changed).status()).toBe(200);
    const ranWhatIf = posted(page, /^\/api\/cases\/\d+\/assessments$/);
    await page.getByRole('button', { name: 'Run Assessment', exact: true }).click();
    expect((await ranWhatIf).status()).toBe(201);
    await expect(page.locator('.ws-answer-num')).toHaveText('1.667', NAV);

    // Compare: fair only when the four checks pass; 1.72 and 1.667.
    await open(page, `/project/${cls.projectId}/comparison?cases=${cls.baseCaseId},${whatIfId}`, { ready: 'Fair to compare' });
    await expect(page.getByText('1.72', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1.667', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change by step' })).toBeVisible();
    await shot(page, 'E09-compare');

    // Analytics: how far the class got. Reports: a case as a PDF.
    await open(page, `/project/${cls.projectId}/analytics`, { ready: 'How far the class got' });
    await shot(page, 'E10-analytics');
    await open(page, `/reports?project=${cls.projectId}&case=${cls.baseCaseId}`, { ready: 'Build a report' });
    await shot(page, 'E11-reports');
    const download = page.waitForEvent('download', NAV);
    await page.getByRole('button', { name: 'Export PDF' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  });

  await test.step("6. The student's side: Ana's case, her write-up, the hand-in tick, and a phone", async () => {
    const { context: anaDesk, page: desk } = await person(browser);
    await open(desk, '/auth/login', { ready: 'Log in' });
    await desk.getByLabel('Email').fill(ana.email);
    // A wrong password: the error shows on the line, under the field.
    await desk.getByLabel('Password', { exact: true }).fill(`${ana.password}-not`);
    await desk.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(desk.getByText('Invalid email or password. Try again.')).toBeVisible(NAV);
    await expect(desk.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await shot(desk, 'F1.2b-log-in-and-errors');
    await desk.getByLabel('Password', { exact: true }).fill(ana.password);
    await desk.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(desk.getByRole('heading', { name: 'Hi, Ana.' })).toBeVisible(NAV);

    // The class project shared with her; she makes a case of her own from the base case.
    await expect(desk.getByRole('heading', { name: 'ENVE 410 bracket study' })).toBeVisible();
    await shot(desk, 'E13-student-home');
    const mine = posted(desk, new RegExp(`^/api/cases/${cls.baseCaseId}/duplicate$`));
    await desk.getByRole('button', { name: 'Make your own case' }).click();
    const mineRes = await mine;
    expect(mineRes.status()).toBe(201);
    await expect(desk.getByRole('tree')).toBeVisible(NAV);

    // One change, a lighter blank: 0.78 kg of steel. 1.682, 2.2 % lower.
    await desk.getByRole('treeitem', { name: /^10\. Cut blank, / }).click();
    const steel = desk.getByRole('complementary', { name: /10\. Cut blank/ }).getByRole('textbox', { name: 'Steel' });
    const lighter = posted(desk, /^\/api\/flows\/\d+$/, 'PUT');
    await steel.fill('0.78');
    await steel.press('Enter');
    expect((await lighter).status()).toBe(200);
    const ran = posted(desk, /^\/api\/cases\/\d+\/assessments$/);
    await desk.getByRole('button', { name: 'Run Assessment', exact: true }).click();
    expect((await ran).status()).toBe(201);
    await expect(desk.locator('.ws-answer-num')).toHaveText('1.682', NAV);

    // Her write-up, in her own words, then the hand-in tick (it locks nothing).
    await desk.getByRole('tab', { name: 'Write-up' }).click();
    await desk.getByRole('textbox', { name: 'Interpretation' }).fill('A lighter blank cuts the footprint by about 2 percent, since steel is most of it.');
    const savedText = posted(desk, /^\/api\/cases\/\d+$/, 'PUT');
    await desk.getByRole('button', { name: 'Save the write-up' }).click();
    expect((await savedText).status()).toBe(200);
    const ticked = posted(desk, /^\/api\/cases\/\d+$/, 'PUT');
    // The box shows ticked once the server has saved it.
    const handIn = desk.getByRole('checkbox', { name: /^This is my hand-in/ });
    await handIn.click();
    expect((await ticked).status()).toBe(200);
    await expect(handIn).toBeChecked();
    await expect(desk.getByText(/✓ Ticked ·/)).toBeVisible();
    await shot(desk, 'E06-case-write-up-student');

    // On a phone, everything is read only.
    const phoneState = await anaDesk.storageState();
    const phone = await browser.newContext({ ...CONTEXT_DEFAULTS, viewport: { width: 390, height: 844 }, hasTouch: true, storageState: phoneState });
    await installNetGuard(phone);
    const ph = await phone.newPage();
    await open(ph, '/home', { ready: 'Hi, Ana.' });
    await expect(ph.getByText('Read only on a phone.').first()).toBeVisible();
    await shot(ph, 'E15-phone-home');
    await open(ph, new URL(desk.url()).pathname, { ready: /^Outline · / });
    await shot(ph, 'E16-phone-case-outline');
    await ph.getByRole('tab', { name: /^Results/ }).click();
    await expect(ph.getByRole('tab', { name: /^Results/ })).toHaveAttribute('aria-selected', 'true', NAV);
    await expect(ph.getByText('What builds this number')).toBeVisible(NAV);
    await expect(ph.getByText('1.682', { exact: true }).first()).toBeVisible();
    await shot(ph, 'E17-phone-results');
    await phone.close();
    await anaDesk.close();
  });

  await test.step('Close: Elena sees the hand-in on Cases (a tick only; grades stay in the course system)', async () => {
    await open(page, `/project/${cls.projectId}/cases`, { ready: /No reminders go out/ });
    await page.getByRole('radio', { name: 'Table' }).click();
    await expect(page.getByRole('row', { name: /Ana's case/ })).toContainText('✓ Ticked', NAV);
  });
  await context.close();
});

/** A one-page PDF with no text on it: what a scanned page looks like to a reader. */
function blankPdf(): Buffer {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
  ];
  let out = '%PDF-1.4\n';
  const at: number[] = [];
  objs.forEach((o, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
