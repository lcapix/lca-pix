/**
 * The V1 demo video: one walk through every feature, recorded by Playwright
 * (project "demo", video on, slowed down). Not part of the gate; run with
 *
 *   E2E_PORT=3176 npx playwright test --project=demo
 *
 * Data: a fresh local database, the sample study, and real files from the
 * repo (tests/e2e/fixtures/import/small-bom.csv). Each scene puts a caption
 * on screen; a scene that fails is named at the end and the walk goes on, so
 * one broken step never costs the whole recording.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { newPassword } from '../support/api';

const BOM = path.resolve(__dirname, '..', 'fixtures', 'import', 'small-bom.csv');
const failed: string[] = [];

async function caption(page: Page, text: string, ms = 2600) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:880px;' +
        'padding:12px 20px;border-radius:12px;background:rgba(23,32,27,0.92);color:#fff;font:600 18px/1.4 Arial,sans-serif;' +
        'box-shadow:0 10px 30px rgba(0,0,0,0.25);pointer-events:none;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(ms);
}

async function scene(page: Page, name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    failed.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`);
    await caption(page, `(${name}: skipped)`, 800).catch(() => {});
  }
}

const tree = (page: Page, name: string) =>
  page.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

test('the V1 demo: every feature, start to finish', async ({ page, api, newUser }) => {
  test.setTimeout(30 * 60_000);
  const email = `demo-${Date.now()}@e2e.lcapix.test`;
  const password = newPassword();
  let projectId = 0;
  let caseId = 0;

  await scene(page, 'Landing', async () => {
    await page.goto('/');
    await caption(page, 'LCAPIX: life cycle assessment for teaching and research.');
    await page.mouse.wheel(0, 900);
    await caption(page, 'One page for what it does, the standards it follows, and where its data comes from.');
  });

  await scene(page, 'Sign up and About you', async () => {
    await page.goto('/auth/signup');
    await caption(page, 'Sign up with email or Google.');
    await page.getByLabel('Your name').fill('Dana Demo');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(/\/auth\/onboarding/, { timeout: 60_000 });
    await caption(page, 'About you: what you will use it for, and Guided mode for this device.');
    await page.getByRole('radio', { name: 'Teaching a class' }).check();
    await page.getByRole('button', { name: 'Open the sample study' }).click();
    await page.waitForURL(/\/project\/\d+/, { timeout: 90_000 });
  });

  await scene(page, 'The sample study', async () => {
    await caption(page, 'A finished sample study to read first: a painted steel bracket in five tiers, run with TRACI 2.1.');
    await page.mouse.wheel(0, 600);
    await caption(page, 'Its Overview: the comparison line, the steps, the impact, the top contributors and the cost.');
    await page.mouse.wheel(0, -600);
    await page.getByRole('button', { name: 'Make my own copy' }).click();
    await page.waitForURL(/\/project\/\d+/, { timeout: 90_000 });
    await caption(page, 'Make my own copy: the sample is read-only, the copy is yours to change.');
    projectId = Number(page.url().match(/\/project\/(\d+)/)?.[1] ?? 0);
  });

  await scene(page, 'Home and the command palette', async () => {
    await page.goto('/home');
    await caption(page, 'Home: counts, your projects, filters, search, grid or list, and pins.');
    await page.getByRole('combobox', { name: 'Find a project or case' }).fill('bracket');
    await caption(page, 'Search matches project names and descriptions.', 1800);
    await page.getByRole('combobox', { name: 'Find a project or case' }).fill('');
    await page.keyboard.press('ControlOrMeta+k');
    await caption(page, 'Command K: places, recent projects, and your account.');
    await page.keyboard.press('Escape');
  });

  await scene(page, 'The case editor', async () => {
    if (!projectId) throw new Error('no project')
    await page.goto(`/project/${projectId}`);
    await page.getByRole('button', { name: 'Open editor' }).click();
    await page.waitForURL(/\/case\/\d+/, { timeout: 60_000 });
    caseId = Number(page.url().match(/\/case\/(\d+)/)?.[1] ?? 0);
    await expect(page.getByRole('tree')).toBeVisible({ timeout: 60_000 });
    await caption(page, 'The case: a tree from the product down to elemental tasks, coloured by tier.');
    await tree(page, 'Cutting').click({ button: 'right' });
    await caption(page, 'Each step has a menu: rename, move, add the next tier below, delete.', 2200);
    await page.getByRole('menuitem', { name: 'Add an operation below' }).click();
    const form = page.getByRole('dialog', { name: 'Add a step' });
    await form.getByLabel('Name').fill('15. Deburr');
    await caption(page, 'Add a step: its parent and tier are already chosen.', 1800);
    await form.getByRole('button', { name: 'Add the step' }).click();
  });

  await scene(page, 'Flows: library, process library, transport', async () => {
    await tree(page, '20. Weld tab').click();
    await page.getByRole('button', { name: '+ Add a flow to this step' }).click();
    await page.getByPlaceholder('Search substances…').fill('Aluminum');
    await caption(page, 'Add a flow: every match shows its climate factor, unit and cited source.');
    await page.getByRole('button', { name: /^Aluminum\b/ }).first().click();
    await page.getByPlaceholder('0.0').fill('0.5');
    await page.getByRole('button', { name: 'Save flow' }).click();
    await page.getByRole('button', { name: '+ Add a flow to this step' }).click();
    await page.getByRole('button', { name: /Use the process library/ }).click();
    const library = page.getByRole('group', { name: 'Process library' });
    await library.getByRole('combobox').selectOption({ label: 'MIG / TIG welding (per min)' });
    await caption(page, 'Not sure what to add? The process library lists what a kind of process consumes, per driver.');
    await library.getByRole('button', { name: 'Close' }).click();
    await page.getByPlaceholder('Search substances…').fill('Transport, truck, regional');
    await page.getByRole('button', { name: /^Transport, truck, regional\b/ }).first().click();
    await page.getByPlaceholder('e.g. 1.2').fill('0.85');
    await page.getByPlaceholder('e.g. 450').fill('450');
    await caption(page, 'A transport leg: mass times distance gives tonne-kilometres.');
    await page.getByRole('button', { name: 'Save flow' }).click();
  });

  await scene(page, 'Inventory', async () => {
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    await caption(page, 'Inventory: every flow, its amount, unit, factor and source, filtered by what needs attention.');
  });

  await scene(page, 'Run', async () => {
    await page.getByRole('button', { name: 'Run Assessment' }).click();
    await caption(page, 'Run: the study\'s method and region, changeable for this run.', 2000);
    await page.getByRole('dialog', { name: 'Run assessment' }).getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByRole('tab', { name: /^Results/ })).toHaveAttribute('aria-selected', 'true', { timeout: 90_000 });
    await caption(page, 'Results: the climate answer, what builds it, how sure it is, and the change from the last run.');
  });

  await scene(page, 'Full results', async () => {
    await page.getByRole('link', { name: 'Open full page' }).click();
    await expect(page.getByRole('region', { name: 'Total' })).toBeVisible({ timeout: 60_000 });
    await caption(page, 'The full results page: every category, cost by kind and per unit of impact.');
    await page.getByRole('radiogroup', { name: 'Chart' }).getByRole('radio', { name: 'Radar' }).click();
    await caption(page, 'Every category as a radar, or on a log scale.', 2000);
    await page.getByRole('radiogroup', { name: 'Chart' }).getByRole('radio', { name: 'Log scale' }).click();
    await page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio', { name: 'Human Health - Cancer' }).click();
    await page.getByRole('region', { name: 'Flows' }).scrollIntoViewIfNeeded();
    await caption(page, 'TRACI 2.1 cancer and particulate matter from US EPA data. Materials with only a climate factor say "climate only".');
  });

  await scene(page, 'Magic Insights', async () => {
    await page.getByRole('button', { name: 'Magic Insights' }).first().click();
    await caption(page, 'Magic Insights: a plain-language summary; every number in it comes from the run.');
    await page.keyboard.press('Escape');
  });

  await scene(page, 'Compare', async () => {
    await page.goto(`/project/${projectId}/comparison`);
    await caption(page, 'Compare: pick any cases, read them against the first, ranked, with what differs and why.');
    await page.mouse.wheel(0, 700);
    await caption(page, 'Step by step and material by material.', 2000);
  });

  await scene(page, 'Import a bill of materials', async () => {
    await page.goto(`/project/${projectId}/import`);
    await page.getByRole('radio', { name: 'Bill of materials' }).click();
    await page.getByLabel(/Drop a file here/).setInputFiles(BOM);
    await caption(page, 'Import: a real bill of materials. Each line is matched to the library, with its score and factor.', 2000);
    await page.getByRole('button', { name: /Check what we read/ }).click();
    await expect(page.getByRole('columnheader', { name: 'In or out' })).toBeVisible({ timeout: 90_000 });
    await caption(page, 'Every match shows its factor and source; a line with no match is held, never guessed.');
  });

  await scene(page, 'People and assignments', async () => {
    const student = await newUser('demo-student');
    await page.goto(`/project/${projectId}/people`);
    await caption(page, 'People: add a class by email, one per row, and set what each person can do.');
    await page.goto(`/project/${projectId}/assignments`);
    await caption(page, 'Assignments: instructions, a due date and a template case each student copies.');
    void student;
  });

  await scene(page, 'Reports', async () => {
    await page.goto(`/reports?project=${projectId}`);
    await caption(page, 'Reports: export a run as a PDF, slides or a CSV, each number traced to its source.');
  });

  await scene(page, 'Guide', async () => {
    await page.goto('/guide');
    await caption(page, 'The guide, inside the app: your first assessment, the data model, a glossary and the FAQ.');
    await page.goto('/product');
    await caption(page, 'Public pages tell only what the app does.', 2000);
  });

  // eslint-disable-next-line no-console
  console.log(failed.length ? `Demo scenes skipped:\n- ${failed.join('\n- ')}` : 'Demo: every scene ran.');
});
