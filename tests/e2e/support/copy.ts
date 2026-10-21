/**
 * What a person should never read on a screen: the app's own writing rules
 * (no em dashes, D10; plain sentences, no shouting prefixes) and the signs of
 * a value that broke on its way to the page. The film journey checks every
 * screen it passes; contracts/csp.spec.ts checks every screen in routes.json.
 * Found in use on 2026-10-21 (a toast naming an old button, "! NO IMPACT
 * DATA", a raw "[source: …]" tag on a step) and kept out from here on.
 */
import { expect, type Page } from '@playwright/test';

const NEVER: Array<[RegExp, string]> = [
  [/—/, 'an em dash'],
  [/\bundefined\b/, '"undefined"'],
  [/\bNaN\b/, '"NaN"'],
  [/\[object Object\]/, '"[object Object]"'],
  [/Invalid Date/, '"Invalid Date"'],
  [/\[source:/, 'a raw "[source: …]" tag'],
  [/(^|\n)\s*NOTE:/, 'a "NOTE:" prefix'],
  [/(^|\n)\s*! /, 'a "!" prefix'],
  [/Preview extraction/, 'the old button name "Preview extraction"'],
];

/** Each rule the visible text breaks, with the line it breaks it on. */
export async function brokenCopy(page: Page): Promise<string[]> {
  const text = await page.locator('body').innerText();
  const found: string[] = [];
  for (const [re, what] of NEVER) {
    const m = re.exec(text);
    if (!m) continue;
    const at = text.lastIndexOf('\n', m.index) + 1;
    const line = text.slice(at, text.indexOf('\n', m.index + 1) === -1 ? undefined : text.indexOf('\n', m.index + 1)).trim();
    found.push(`${what}: "${line.slice(0, 140)}"`);
  }
  return found;
}

export async function expectCleanCopy(page: Page, where: string): Promise<void> {
  expect(await brokenCopy(page), `text on ${where}`).toEqual([]);
}
