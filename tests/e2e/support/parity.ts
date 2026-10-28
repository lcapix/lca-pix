/**
 * One kept or moved ledger row. The assertion message is "<ID> <capability>",
 * so one run names every row that is no longer on screen.
 */
import { expect, type Locator } from '@playwright/test';

export function row(loc: Locator, id: string, capability: string) {
  return expect.soft(loc.first(), `${id} ${capability}`).toBeVisible();
}

export function note(id: string, capability: string): string {
  return `${id} ${capability}`;
}
