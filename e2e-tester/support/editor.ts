/**
 * Case-editor helpers. Selectors are roles and accessible names wherever the
 * UI provides them; where it does not (inputs whose labels are not tied to
 * them), the placeholder stands in and the reason is noted where it is used.
 * Same selectors as tests/e2e/support/editor.ts, written for e2e's exact
 * name matching (a string matches the whole name; RegExp where it must not).
 */
import type { Locator, Screen } from 'e2e';
import { escapeRe, expect } from './fixtures.ts';

export async function openCase(app: { open(path: string): Promise<void> }, screen: Screen, projectId: number, caseId: number) {
  await app.open(`/project/${projectId}/case/${caseId}`);
  await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });
}

/** The left pane: the component list with its "Components" filter box. */
export function outline(screen: Screen): Locator {
  return screen.getByRole('complementary').filter({ has: screen.getByRole('textbox', 'Components') });
}

/** The right pane for the selected component (it has the Save button). */
export function inspector(screen: Screen): Locator {
  return screen.getByRole('complementary').filter({ has: screen.getByRole('button', 'Save') });
}

/** Outline rows are buttons named "<tier letter> <name>" ("Add Component" is not one). */
export function outlineRow(screen: Screen, name: string): Locator {
  return outline(screen).getByRole('button', new RegExp(`^\\S ${escapeRe(name)}$`));
}

export async function selectComponent(screen: Screen, name: string): Promise<void> {
  await outlineRow(screen, name).tap();
  await expect(inspector(screen).getByText(name).first()).toBeVisible();
}

/**
 * Opens an inspector section if `content` is not showing yet. The section
 * headers are plain buttons with no aria-expanded, so openness can only be
 * read from what is visible.
 */
export async function openSection(screen: Screen, title: string, content: Locator): Promise<void> {
  if (await content.isVisible()) return;
  await inspector(screen).getByRole('button', title).tap();
  await expect(content).toBeVisible();
}

/** The sonner toast region ("Notifications alt+T"). */
export function toasts(screen: Screen): Locator {
  return screen.getByRole('region', /^Notifications/);
}
