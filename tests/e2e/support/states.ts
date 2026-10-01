/**
 * Screens that only exist after an interaction: the case editor's views,
 * inspector and component dialog, and the results page with Magic Insights
 * open. The visual and accessibility baselines cover these on top of
 * routes.json.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { inspector, selectComponent } from './editor';
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
};

const editorPath = (s: Seed) => `/project/${s.example.projectId}/case/${s.example.baseCaseId}`;

/**
 * Magic Insights' AI mode calls /api/insights. Answer it the way the server
 * does with no model key configured: the computed fallback.
 */
export async function mockInsights(page: Page): Promise<void> {
  await page.route('**/api/insights', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: true }) }),
  );
}

async function view(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('button', { name }).click();
  await settle(page);
}

export const STATES: ScreenState[] = [
  {
    slug: 'case-editor-tree',
    brief: '10 Case editor: Tree view',
    path: editorPath,
    prepare: (page) => view(page, /^Tree$/),
  },
  {
    slug: 'case-editor-list',
    brief: '10 Case editor: List view',
    path: editorPath,
    prepare: (page) => view(page, /^List$/),
  },
  {
    slug: 'case-editor-graph',
    brief: '10 Case editor: Graph view (labelled "Plot" today)',
    path: editorPath,
    prepare: (page) => view(page, /^(Graph|Plot)$/),
  },
  {
    slug: 'case-editor-inspector',
    brief: '11 Inspector open on a step with flows and costs',
    path: editorPath,
    prepare: async (page) => {
      await selectComponent(page, '10. Cut blank');
      await expect(inspector(page).getByRole('button', { name: 'Edit quantity of Steel' })).toBeVisible();
      await settle(page);
    },
  },
  {
    slug: 'component-dialog',
    brief: '12 Add component dialog',
    path: editorPath,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Add Component', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'New component' })).toBeVisible();
      await settle(page);
    },
  },
  {
    slug: 'results-magic-insights',
    brief: '14 Magic Insights (computed)',
    path: (s) => `${editorPath(s)}/results`,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Magic Insights', exact: true }).click();
      await expect(page.getByText('Computed deterministically from your assessment results. Not AI-generated.')).toBeVisible();
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
];

/** Open a state's page (with the insights mock in place) and put it in that state. */
export async function openState(page: Page, state: ScreenState, seed: Seed): Promise<void> {
  await mockInsights(page);
  await open(page, state.path(seed));
  await state.prepare(page);
}
