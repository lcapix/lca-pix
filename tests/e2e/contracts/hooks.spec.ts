/**
 * Contract tests: the hooks that scripts, the guides and the unit tests rely
 * on, on the education screens. They fail the moment one goes.
 *
 *   - The tree: one role=tree holding one role=treeitem per step, each with
 *     id "step-<component id>" and the name "<name>, <tier>".
 *   - The accessible names a guide tells people to press.
 *
 * The classic product tour (lib/lcapix-tour-steps.ts) and its data-tour
 * anchors belong to the classic pages, shown only with
 * NEXT_PUBLIC_LCAPIX_SHELL=classic; the education shell's guide is Guided
 * mode (the Docs button turns it on).
 */
import type { Locator, Page } from '@playwright/test';
import { openCase } from '../support/editor';
import { expect, readSeed, storagePath, test } from '../support/fixtures';
import { open } from '../support/ui';

test.use({ storageState: storagePath('owner') });

const seed = () => readSeed();
const NAV = { timeout: 90_000 };

/** A control with this accessible name, as a button, tab, link or menu item. */
function control(page: Page, name: string | RegExp): Locator {
  return page
    .getByRole('button', { name })
    .or(page.getByRole('tab', { name }))
    .or(page.getByRole('link', { name }))
    .or(page.getByRole('menuitem', { name }));
}

test.describe('the tree', () => {
  test('one role=tree; a treeitem per step, id "step-<component id>", named "<name>, <tier>"', async ({ page }) => {
    const { projectId, baseCaseId, cutBlankId } = seed().example;
    await openCase(page, projectId, baseCaseId);
    await expect(page.getByRole('tree')).toHaveCount(1);
    // The sample study: 17 steps on five tiers.
    await expect(page.getByRole('treeitem')).toHaveCount(17);
    const cut = page.locator(`#step-${cutBlankId}`);
    await expect(cut).toHaveAttribute('role', 'treeitem');
    await expect(cut).toHaveAttribute('aria-label', '10. Cut blank, Operation');
    await expect(page.getByRole('treeitem', { name: 'Painted steel bracket, Product' })).toHaveAttribute('aria-level', '1');
  });
});

test.describe('accessible names', () => {
  test('a case you can change: the four tabs and Run Assessment', async ({ page }) => {
    const { projectId, compCaseId } = seed().example;
    await openCase(page, projectId, compCaseId);
    for (const tab of [/^Tree/, /^Inventory/, /^Results/, /^Write-up/]) await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Assessment', exact: true })).toBeVisible();
    await expect(control(page, 'Hide panel')).toBeVisible();
  });

  test('the sample’s read-only base case: Make my own copy, not Run Assessment', async ({ page }) => {
    const { projectId, baseCaseId } = seed().example;
    await openCase(page, projectId, baseCaseId);
    await expect(page.getByRole('button', { name: 'Make my own copy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Assessment', exact: true })).toHaveCount(0);
  });

  test('Results: Magic Insights and Try a what-if', async ({ page }) => {
    const { projectId, compCaseId } = seed().example;
    await open(page, `/project/${projectId}/case/${compCaseId}?tab=results`, { ready: 'What builds this number' });
    await expect(control(page, /^Magic Insights/).first()).toBeVisible(NAV);
    await expect(page.getByRole('button', { name: 'Try a what-if' })).toBeVisible();
  });

  test('the sidebar: Home, Findings, Reports, New project; a project’s Cases with + New case', async ({ page }) => {
    const { projectId } = seed().example;
    await open(page, `/project/${projectId}/cases`, { ready: 'Your cases' });
    const nav = page.getByRole('navigation').first();
    for (const name of ['Home', 'Findings', 'Reports']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New project' })).toBeVisible();
    await expect(page.getByRole('link', { name: '+ New case' }).first()).toBeVisible();
  });
});

test.describe('the landing', () => {
  test.use({ storageState: storagePath('anon') });

  test('Get started and Log in, and a skip link to the content', async ({ page }) => {
    await open(page, '/', { ready: 'Know the footprint of anything you make.' });
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Get started/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#lp-main');
  });
});
