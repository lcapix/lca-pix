/**
 * Journey 1 hardened (v1-hardening-30, items 1, 4, 4b, 5, 6): a student reads
 * the sample, makes a copy, and Home leads back to that copy; the sample ships
 * with no warnings and its numbers; a project opens on its Cases board, its
 * settings save only on Save; case tabs and browser back. Each step is clicked
 * the way a person does, and the outcome (the URL, the data saved, the number)
 * is checked, not only that a control is there.
 *
 *   C1  a project opens on Cases; settings and Delete project live there
 *   C3  Home opens "my copy"; another copy is its own choice; All projects lists;
 *       the New case form copies from your own case, not the read-only sample
 *   C5  case tabs are history entries; the project's own address is replaced
 *   C6  the sample: no "unit can't convert", no "Possible double count";
 *       1.72 kg CO2 eq, 0.001 kg SO2 eq, $1.75
 */
import type { Page, Response } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

const answered = (page: Page, re: RegExp, method = 'POST'): Promise<Response> =>
  page.waitForResponse((r) => re.test(new URL(r.url()).pathname) && r.request().method() === method, NAV);

test.describe('journey 1, hardened: the sample, my copy, the Cases board', () => {
  test('C6 C3 C5 the sample has no warnings, Home leads to my copy, tabs go back one at a time', async ({ api, newUser, signIn }) => {
    test.setTimeout(300_000);
    const student = await newUser('start-student');
    const as = api.as(student.token);
    const sample = await as.post<{ project_id: number; case_id: number; run_id: number; what_if_case_id: number }>('/api/example-project');

    // C6: the run the sample ships with: its numbers, and no unit or double-count warning.
    const run = (await as.get<{ assessments: any[] }>(`/api/cases/${sample.case_id}/assessments?latest=1`)).assessments[0];
    const impacts: Record<string, { value: number }> = run.impacts ?? {};
    const value = (re: RegExp) => Number(Object.entries(impacts).find(([k]) => re.test(k))?.[1]?.value);
    expect(value(/global warming/i).toFixed(3)).toBe('1.720');
    expect(value(/acidification/i).toFixed(3)).toBe('0.001');
    const warnings: string[] = run.warnings ?? [];
    expect(warnings.filter((w) => /double count|convert|EXCLUDED/i.test(w))).toEqual([]);
    const comps = (await as.get<{ components: any[] }>(`/api/cases/${sample.case_id}/components`)).components;
    const cost = comps.reduce(
      (t, c) => t + ['labor_cost', 'energy_cost', 'material_cost', 'transportation_cost', 'equipment_cost', 'overhead_cost'].reduce((s, k) => s + Number(c[k] ?? 0), 0),
      0,
    );
    expect(cost.toFixed(2)).toBe('1.75');

    const { page } = await signIn(student);
    // Home is the sample study; its inventory and its answer say nothing can't convert.
    await open(page, '/home', { ready: 'Read-only · made for you when you signed up' });
    await expect(page.getByText('1.72', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/can.t convert/i)).toHaveCount(0);
    await expect(page.getByText(/double count/i)).toHaveCount(0);

    // Make my own copy: a copy named after her, open in the case.
    const copied = answered(page, /^\/api\/cases\/\d+\/duplicate$/);
    await page.locator('header').getByRole('button', { name: 'Make my own copy' }).click();
    expect((await copied).status()).toBe(201);
    await expect(page).toHaveURL(/\/project\/\d+\/case\/\d+$/, NAV);
    const copyId = Number(/\/case\/(\d+)$/.exec(new URL(page.url()).pathname)![1]);
    await expect(page.getByRole('tree')).toBeVisible(NAV);

    // C6 on her copy: the Inventory has nothing left out, and her run has no double count.
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    await expect(page).toHaveURL(/tab=inventory/, NAV);
    // The Inventory's own filter for left-out lines counts none, and no line says it.
    await expect(page.getByRole('button', { name: /^Left out, unit can.t convert 0$/ })).toBeVisible(NAV);
    await expect(page.getByText(/flows? (unit|units) can.t convert|Pick kg or g/i)).toHaveCount(0);
    const ran = answered(page, /^\/api\/cases\/\d+\/assessments$/);
    await page.getByRole('button', { name: 'Run the case', exact: true }).click();
    await page.getByRole('dialog', { name: 'Run the case' }).getByRole('button', { name: 'Run', exact: true }).click();
    expect((await ran).status()).toBe(201);
    await expect(page).toHaveURL(/tab=results/, NAV);
    await expect(page.locator('.ws-answer-num')).toHaveText('1.720', NAV);
    await expect(page.getByText(/double count/i)).toHaveCount(0);

    // C5: each tab is a history entry. Write-up, then back to Results, back to Inventory, back to the Tree, all inside the case.
    await page.getByRole('tab', { name: 'Write-up' }).click();
    await expect(page).toHaveURL(/tab=writeup/, NAV);
    await page.goBack();
    await expect(page).toHaveURL(/tab=results/, NAV);
    await expect(page.getByRole('tablist', { name: 'Case' }).getByRole('tab', { name: /^Results/ })).toHaveAttribute('aria-selected', 'true');
    await page.goBack();
    await expect(page).toHaveURL(/tab=inventory/, NAV);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/case/${copyId}$`), NAV);
    await expect(page.getByRole('tree')).toBeVisible();

    // C3: Home now leads to her copy, not to a second copy.
    await open(page, '/home', { ready: 'Read-only · made for you when you signed up' });
    await expect(page.getByText(/^Your copy is/)).toBeVisible(NAV);
    await expect(page.locator('header').getByRole('button', { name: 'Make my own copy' })).toHaveCount(0);
    await page.locator('header').getByRole('link', { name: 'Open my copy' }).click();
    await expect(page).toHaveURL(new RegExp(`/case/${copyId}$`), NAV);
    // A second copy is its own, named choice.
    await open(page, '/home', { ready: 'Read-only · made for you when you signed up' });
    // The first name is hers already (409), so the copy is "<name> 2".
    const second = page.waitForResponse((r) => /\/api\/cases\/\d+\/duplicate$/.test(new URL(r.url()).pathname) && r.status() === 201, NAV);
    await page.locator('header').getByRole('button', { name: 'Make another copy' }).click();
    expect((await (await second).json()).case_id).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/case\/\d+$/, NAV);
    const secondId = Number(/\/case\/(\d+)$/.exec(new URL(page.url()).pathname)![1]);
    expect(secondId).not.toBe(copyId);

    // C3: All projects lists the projects, and the sample's Open goes to the study.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^All projects/ }).click();
    await expect(page).toHaveURL(/\/home\?view=all$/, NAV);
    await expect(page.getByRole('heading', { name: /^Your projects/ })).toBeVisible(NAV);
    await page.locator('.home-sample').getByRole('link', { name: 'Open' }).click();
    await expect(page).toHaveURL(new RegExp(`/project/${sample.project_id}$`), NAV);
    await expect(page.getByText('Read-only · made for you when you signed up')).toBeVisible(NAV);

    // C3: the New case form copies from her own case, never the read-only sample.
    await open(page, `/project/${sample.project_id}/cases`, { ready: 'Your cases' });
    await page.getByRole('link', { name: '+ New case' }).first().click();
    await expect(page).toHaveURL(/\/case\/new\?from=\d+/, NAV);
    const from = page.getByLabel('Copy from');
    await expect(from).toBeVisible(NAV);
    expect(Number(await from.inputValue())).toBe(secondId);
    expect([sample.case_id, sample.what_if_case_id]).not.toContain(Number(await from.inputValue()));
  });

  test('C1 a project opens on Cases; settings save only on Save; back never returns to the project address', async ({ api, newUser, signIn }) => {
    test.setTimeout(240_000);
    const owner = await newUser('start-owner');
    const as = api.as(owner.token);
    const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Frame study', description: 'One frame.' })).project.project_id;
    await as.post(`/api/projects/${projectId}/cases`, { case_name: 'Cut frame', case_type: 'base', description: 'The base way.' });

    const { page } = await signIn(owner);
    await open(page, '/home', { ready: /Welcome/ });
    // From a Home card: the project's address answers with its Cases board, and replaces itself.
    await page.getByRole('link', { name: /Frame study/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/cases$`), NAV);
    await expect(page.getByRole('heading', { level: 1, name: /^Cases/ })).toBeVisible(NAV);
    await expect(page.getByText('Cut frame').first()).toBeVisible();
    // No old Overview: no KPI wall, no "Total ABC cost", no Overview in the sidebar.
    await expect(page.getByRole('list', { name: 'Project summary' })).toHaveCount(0);
    await expect(page.getByText(/Total ABC cost|Impact Overview|Path: Path:/)).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Overview', exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/home$/, NAV);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/cases$`), NAV);

    // Project settings: Enter in a box saves nothing; Save does, and says so.
    await page.getByRole('button', { name: 'Project settings' }).click();
    const form = page.getByRole('form', { name: 'Project settings' });
    await expect(form).toBeVisible(NAV);
    await form.getByLabel('Functional unit').fill('1 welded frame');
    await form.getByLabel('Name', { exact: true }).fill('Frame study, renamed');
    await form.getByLabel('Name', { exact: true }).press('Enter');
    await page.waitForTimeout(1500);
    const before = (await as.get<{ project: any }>(`/api/projects/${projectId}`)).project;
    expect(before.project_name).toBe('Frame study');
    expect(before.functional_unit ?? '').toBe('');
    await form.getByLabel('Default method').selectOption('TRACI 2.1');
    await form.getByLabel('Default region').selectOption('US');
    const saved = answered(page, new RegExp(`^/api/projects/${projectId}$`), 'PUT');
    await form.getByRole('button', { name: 'Save settings' }).click();
    expect((await saved).status()).toBe(200);
    await expect(form.getByText('Settings saved.')).toBeVisible();
    const after = (await as.get<{ project: any }>(`/api/projects/${projectId}`)).project;
    expect([after.project_name, after.functional_unit, after.lcia_method, after.region_code]).toEqual(['Frame study, renamed', '1 welded frame', 'TRACI 2.1', 'US']);
    // The board shows the new name and scope at once.
    await expect(page.getByText('Frame study, renamed').first()).toBeVisible(NAV);
    await expect(page.getByText(/TRACI 2\.1 · US/).first()).toBeVisible(NAV);

    // Delete project, from the same panel, with a confirm: it is gone, and Home is where she lands.
    await page.getByRole('button', { name: 'Delete project' }).click();
    const confirm = page.getByRole('alertdialog', { name: /^Delete "Frame study, renamed"\?/ });
    await expect(confirm).toBeVisible();
    const deleted = answered(page, new RegExp(`^/api/projects/${projectId}$`), 'DELETE');
    await confirm.getByRole('button', { name: 'Delete project' }).click();
    expect((await deleted).status()).toBe(200);
    await expect(page).toHaveURL(/\/home$/, NAV);
    const left = (await as.get<{ projects: any[] }>('/api/projects')).projects.map((p) => p.project_id);
    expect(left).not.toContain(projectId);
  });
});
