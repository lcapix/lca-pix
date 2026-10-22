/**
 * Screens that only exist after an interaction: a step's panel, the Cost view
 * with the labour lookup, a step's menu and its delete confirm, Magic
 * Insights, Compare's case menu and New case's base-case option. The visual and accessibility
 * baselines cover these on top of routes.json.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { Seed } from './seed';
import { open, settle } from './ui';

export type ScreenState = {
  slug: string;
  brief: string;
  path: (seed: Seed) => string;
  prepare: (page: Page) => Promise<void>;
  /**
   * Capture this element instead of the full page: for an overlay whose page
   * behind it carries masked dates (masks are painted above everything).
   */
  target?: (page: Page) => Locator;
  /**
   * Why the state cannot exist on a phone, when it cannot: at 390 px a case
   * is the read-only outline (E15 to E17), so there is no step panel, menu or
   * editing to open. The visual suite skips it at phone width with this reason.
   */
  desktopOnly?: string;
};

const CASE_ON_PHONE = 'A case on a phone is the read-only outline (E16, E17): nothing to edit or open.';

/** The seed's copy of the base case (a case the owner can change, run R2). */
const copyPath = (s: Seed) => `/project/${s.example.projectId}/case/${s.example.compCaseId}`;
const SLOW = { timeout: 90_000 };
const treeStep = (page: Page, name: string) => page.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

/**
 * Magic Insights' AI mode calls /api/insights. Answer it the way the server
 * does with no model key configured: the computed fallback.
 */
export async function mockInsights(page: Page): Promise<void> {
  await page.route('**/api/insights', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: true }) }),
  );
}

export const STATES: ScreenState[] = [
  {
    slug: 'case-step-panel',
    desktopOnly: CASE_ON_PHONE,
    brief: '10 A step selected: its panel with flows (E03)',
    path: copyPath,
    prepare: async (page) => {
      await treeStep(page, '10. Cut blank').click();
      await expect(page.getByRole('complementary', { name: /10\. Cut blank/ })).toBeVisible(SLOW);
      await settle(page);
    },
  },
  {
    slug: 'case-cost-labor',
    desktopOnly: CASE_ON_PHONE,
    brief: '10 Cost view: the labour rate lookup (E14)',
    path: copyPath,
    prepare: async (page) => {
      await page.getByRole('radio', { name: 'Cost', exact: true }).click();
      await treeStep(page, '20. Weld tab').click();
      await page.getByRole('button', { name: /^Labor/ }).click();
      await expect(page.getByText('Look up a labor rate')).toBeVisible(SLOW);
      await settle(page);
      // At 768 high the sheet runs below the fold, and the browser scrolls the
      // page to the focused field sooner or later: put the page back at the top
      // (the panel's own scroll and the canvas stay as they are).
      await page.evaluate(() => {
        for (const el of [document.scrollingElement, ...Array.from(document.querySelectorAll('*'))]) {
          if (el && el.scrollTop > 0 && !el.closest('[role="complementary"]') && !el.classList.contains('ws-viewport')) el.scrollTop = 0;
        }
      });
      await settle(page);
    },
  },
  {
    slug: 'case-step-menu',
    desktopOnly: CASE_ON_PHONE,
    brief: '10 A step’s menu (E03c)',
    path: copyPath,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Hide panel' }).click();
      await treeStep(page, '20. Weld tab').click({ button: 'right' });
      await expect(page.getByRole('menu', { name: '20. Weld tab menu' })).toBeVisible();
    },
  },
  {
    slug: 'case-delete-confirm',
    desktopOnly: CASE_ON_PHONE,
    brief: '10 Delete a step: the confirm',
    path: copyPath,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Hide panel' }).click();
      await treeStep(page, '20. Weld tab').click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Delete step' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Delete this step?' })).toBeVisible();
    },
    target: (page) => page.getByRole('alertdialog', { name: 'Delete this step?' }),
  },
  {
    slug: 'results-magic-insights',
    desktopOnly: CASE_ON_PHONE,
    brief: '14 Magic Insights (computed)',
    path: (s) => `${copyPath(s)}?tab=results`,
    prepare: async (page) => {
      await page.getByRole('button', { name: /^Magic Insights/ }).first().click();
      await expect(page.getByText('Computed deterministically from your assessment results. Not AI-generated.')).toBeVisible(SLOW);
      await settle(page);
    },
    // The insights overlay has no role=dialog (INS-6): the card is the
    // innermost box holding both its Close button and the provenance line.
    target: (page) =>
      page
        .locator('div')
        .filter({ has: page.getByRole('button', { name: 'Close', exact: true }) })
        .filter({ has: page.getByText('Computed deterministically from your assessment results.') })
        .last(),
  },
  {
    slug: 'compare-add-case',
    brief: '16 Compare: the + Add a case menu',
    path: (s) => `/project/${s.example.projectId}/comparison?cases=${s.example.baseCaseId},${s.example.compCaseId}`,
    prepare: async (page) => {
      await page.getByRole('button', { name: '+ Add a case' }).click();
      await expect(page.getByRole('menu', { name: 'Cases to compare' })).toBeVisible();
    },
  },
  {
    slug: 'case-new-base-option',
    brief: '22 New case: a new base case, started empty (E18)',
    path: (s) => `/project/${s.fiveTier.projectId}/case/new`,
    prepare: async (page) => {
      await page.getByRole('radio', { name: /A new base case/ }).check();
      await expect(page.getByRole('radio', { name: /^Empty/ })).toBeChecked();
      await settle(page);
    },
  },
];

/** Open a state's page (with the insights mock in place) and put it in that state. */
export async function openState(page: Page, state: ScreenState, seed: Seed): Promise<void> {
  await mockInsights(page);
  await open(page, state.path(seed));
  await state.prepare(page);
}
