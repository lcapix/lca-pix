/**
 * Case-editor helpers for the journeys. Selectors are roles and accessible
 * names wherever the UI provides them; where it does not (unlabelled inputs),
 * the fallback is named here once, with the reason.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { Api, ApiUser } from './api';
import { buildBracket } from './bracket';
import { open } from './ui';

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The bracket study in `user`'s account (TRACI 2.1 / US, run; support/bracket.ts),
 * and a copy of its base case to change and run, so the base keeps its run.
 * `caseId` is the copy; `baseCaseId` the base case.
 */
export async function workedExample(
  api: Api,
  user: ApiUser,
  copyName = 'My bracket',
): Promise<{ projectId: number; caseId: number; baseCaseId: number; baseRunId: number }> {
  const as = api.as(user.token);
  const b = await buildBracket(as);
  const copy = await as.post<{ case_id: number }>(`/api/cases/${b.baseCaseId}/duplicate`, { case_name: copyName });
  return { projectId: b.projectId, caseId: copy.case_id, baseCaseId: b.baseCaseId, baseRunId: b.baseRunId };
}

/** A case in the workspace (E03): its tree is the one Tab stop named after the case. */
export async function openCase(page: Page, projectId: number, caseId: number): Promise<void> {
  await open(page, `/project/${projectId}/case/${caseId}`);
  await expect(page.getByRole('tree')).toBeVisible();
}

/** The left pane: the component list with its "Components" filter box. */
export function outline(page: Page): Locator {
  return page.getByRole('complementary').filter({ has: page.getByRole('textbox', { name: 'Components' }) });
}

/** The right pane for the selected component (it has the Save button). */
export function inspector(page: Page): Locator {
  return page.getByRole('complementary').filter({ has: page.getByRole('button', { name: 'Save', exact: true }) });
}

/** Outline rows are buttons named "<tier letter> <name>" ("Add Component" is not one). */
export function outlineRow(page: Page, name: string): Locator {
  return outline(page).getByRole('button', { name: new RegExp(`^\\S ${escapeRe(name)}$`) });
}

export async function selectComponent(page: Page, name: string): Promise<void> {
  await outlineRow(page, name).click();
  await expect(inspector(page).getByText(name, { exact: true }).first()).toBeVisible();
}

/**
 * Opens an inspector section if `content` is not showing yet. The section
 * headers are plain buttons with no aria-expanded, so openness can only be
 * read from what is visible.
 */
export async function openSection(page: Page, title: string, content: Locator): Promise<void> {
  if (await content.isVisible()) return;
  await inspector(page).getByRole('button', { name: title, exact: true }).click();
  await expect(content).toBeVisible();
}

export async function saveInspector(page: Page): Promise<void> {
  const saved = page.waitForResponse((r) => /\/api\/components\/\d+/.test(r.url()) && r.request().method() === 'PUT');
  await inspector(page).getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).status()).toBe(200);
}
