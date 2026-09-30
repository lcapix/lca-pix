/**
 * Contract tests: the hooks that scripts, the E2E guide, the guided tour and
 * the unit tests rely on. docs/design-revamp/00-guardrails.md §4 says each
 * must survive the refactor and redesign; these fail the moment one goes.
 *
 * Accessible names are matched case-insensitively, with an optional leading
 * "+" (the plus icon the guide writes as "+") and trailing "→". Where today's
 * casing differs from the guardrail spelling the test notes it in an
 * annotation instead of failing.
 */
import type { Locator, Page } from '@playwright/test';
import { LCAPIX_TOUR_STEPS } from '@/lib/lcapix-tour-steps';
import { inspector, openCase, selectComponent } from '../support/editor';
import { expect, readSeed, storagePath, test } from '../support/fixtures';
import { open } from '../support/ui';

test.use({ storageState: storagePath('owner') });

const seed = () => readSeed();
const editor = () => `/project/${seed().example.projectId}/case/${seed().example.baseCaseId}`;
const results = () => `${editor()}/results`;
const workspace = () => `/project/${seed().example.projectId}`;

function nameRe(name: string): RegExp {
  const core = name.replace(/^\+\s*/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\+?\\s*${core}\\s*→?$`, 'i');
}

/** A control with this accessible name, as a button, tab, link or menu item. */
function control(page: Page, name: string): Locator {
  const re = nameRe(name);
  return page
    .getByRole('button', { name: re })
    .or(page.getByRole('tab', { name: re }))
    .or(page.getByRole('link', { name: re }))
    .or(page.getByRole('menuitem', { name: re }));
}

async function expectName(page: Page, name: string): Promise<void> {
  const found = control(page, name).first();
  await expect(found, `a control named "${name}"`).toBeVisible();
  const actual = ((await found.getAttribute('aria-label')) ?? (await found.innerText())).replace(/\s+/g, ' ').trim();
  if (actual.replace(/^\+\s*/, '').replace(/\s*→$/, '') !== name.replace(/^\+\s*/, '')) {
    test.info().annotations.push({ type: 'name differs in case or symbols', description: `guardrail "${name}", today "${actual}"` });
  }
}

test.describe('test ids', () => {
  test('tree canvas: data-testid tree-canvas-viewport and tree-canvas-stage', async ({ page }) => {
    await openCase(page, seed().example.projectId, seed().example.baseCaseId);
    await expect(page.getByTestId('tree-canvas-viewport')).toBeVisible();
    await expect(page.getByTestId('tree-canvas-stage')).toHaveCount(1);
    // Nodes carry data-node-id (guardrails §5).
    await expect(page.getByTestId('tree-canvas-stage').locator('[data-node-id]')).toHaveCount(4);
  });
});

test.describe('accessible names (guardrails §4)', () => {
  test('case editor: Tree, List, Add Component, Run Assessment, View Results', async ({ page }) => {
    await open(page, editor());
    for (const name of ['Tree', 'List', 'Add Component', 'Run Assessment', 'View Results']) await expectName(page, name);
  });

  // The third view tab is labelled "Plot" today; P04 renames it back to
  // "Graph" (guardrails §4). Expected to fail until then.
  test('case editor: Graph', async ({ page }) => {
    test.fail(true, 'The view tab is labelled "Plot" (guardrails §4: rename to "Graph" in P04)');
    await open(page, editor());
    await expect(control(page, 'Graph')).toBeVisible({ timeout: 5_000 });
  });

  test('case editor inspector: Suggest (on a step with costs)', async ({ page }) => {
    await openCase(page, seed().example.projectId, seed().example.baseCaseId);
    await selectComponent(page, '10. Cut blank');
    await expect(inspector(page).getByRole('button', { name: nameRe('Suggest') })).toBeVisible();
  });

  test('home: + New Project', async ({ page }) => {
    await open(page, '/home', { ready: 'Welcome back' });
    await expectName(page, '+ New Project');
  });

  test('project workspace: + Add Case, Compare Cases', async ({ page }) => {
    await open(page, workspace());
    await expectName(page, '+ Add Case');
    await expectName(page, 'Compare Cases');
  });

  test('results: Magic Insights', async ({ page }) => {
    await open(page, results(), { ready: 'TOTAL IMPACT' });
    await expectName(page, 'Magic Insights');
  });

  test('Add Component dialog: the tier radios Product, Machine/Line, Subprocess, Operation, Elemental', async ({ page }) => {
    await openCase(page, seed().example.projectId, seed().example.baseCaseId);
    await page.getByRole('button', { name: 'Add Component', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New component' });
    for (const tier of ['Product', 'Machine/Line', 'Subprocess', 'Operation', 'Elemental']) {
      await expect(dialog.getByRole('radio', { name: tier, exact: true })).toBeVisible();
    }
  });

  // Guardrails §4 name the radiogroup "Process tier"; TypeSegmentedControl
  // defaults its label to "Component type" (component-form/type-segmented-control.tsx:55).
  test('Add Component dialog: radiogroup named "Process tier"', async ({ page }) => {
    test.fail(true, 'The radiogroup is named "Component type" today');
    await openCase(page, seed().example.projectId, seed().example.baseCaseId);
    await page.getByRole('button', { name: 'Add Component', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'New component' }).getByRole('radiogroup', { name: 'Process tier' })).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe('guided tour anchors (lib/lcapix-tour-steps.ts)', () => {
  const anchors = LCAPIX_TOUR_STEPS.map((s) => /data-tour="([^"]+)"/.exec(s.selector)?.[1]).filter((a): a is string => !!a);

  /** Where each anchor lives, by its prefix. */
  const routeFor = (anchor: string): string =>
    anchor.startsWith('home-') ? '/home' : anchor.startsWith('project-') ? workspace() : anchor.startsWith('results-') ? results() : editor();

  // In the app today (03-design-audit §8.4: 7 exist). The tour's other steps
  // point at anchors P11 adds; they are listed as fixme below.
  const EXISTING = ['home-greeting', 'home-kpi-projects', 'home-new-project', 'project-header', 'project-add-case', 'project-open-editor', 'case-goal-scope'];

  test('every tour selector is a [data-tour] anchor classified here', () => {
    expect(anchors).toHaveLength(LCAPIX_TOUR_STEPS.length);
    expect(anchors.filter((a) => !EXISTING.includes(a))).toEqual([
      'case-add-component',
      'case-flow-input',
      'case-suggest-costs',
      'case-run-assessment',
      'results-total-impact',
      'results-magic-insights',
    ]);
  });

  for (const anchor of anchors) {
    const missing = !EXISTING.includes(anchor);
    const t = missing ? test.fixme : test;
    // fixme: not in the markup yet (TOUR-1). The tour step floats mid-screen.
    // Add data-tour="<anchor>" in P11, then drop it from this list.
    t(`[data-tour="${anchor}"] is on its page`, async ({ page }) => {
      await open(page, routeFor(anchor));
      await expect(page.locator(`[data-tour="${anchor}"]`).first()).toBeVisible();
    });
  }
});

test.describe('landing walkthrough anchors (hero-mockup.tsx)', () => {
  test.use({ storageState: storagePath('anon') });

  test('cat-0..2, method-pill, contributor-0 and total are on /', async ({ page }) => {
    await open(page, '/');
    for (const anchor of ['cat-0', 'cat-1', 'cat-2', 'method-pill', 'contributor-0', 'total']) {
      await expect(page.locator(`[data-tour="${anchor}"]`), anchor).toHaveCount(1);
    }
  });
});
