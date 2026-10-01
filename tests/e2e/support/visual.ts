/**
 * Screenshot helpers for the visual baseline.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { settle } from './ui';

/**
 * Text that changes from run to run or day to day: relative times, dates,
 * clock times and run numbers. Matched against each element's own text
 * (Playwright returns the innermost match), so only the value is masked.
 */
export const VOLATILE_TEXT =
  /(\b\d+\s?(s|m|h|d|w|mo|y|sec|secs|min|mins|minute|minutes|hour|hours|day|days|week|weeks)\s+ago\b|\bjust now\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?\b|\bRun #\d+\b|\b20\d{2}-\d{2}-\d{2}\b)/i;

/** Regions masked in every screenshot. */
export function volatileMasks(page: Page): Locator[] {
  return [
    page.getByText(VOLATILE_TEXT),
    // Compare's run pickers: "Run #1 · TRACI 2.1 · US · Sep 30, 4:26 PM".
    page.getByRole('combobox', { name: /^Run used for/ }),
  ];
}

/** Pages taller than this are captured from the top down to this height. */
export const MAX_HEIGHT = 10_000;

/**
 * The sign-in hero (components/lcapix/auth/auth-shell.tsx MontageHero) rotates
 * its scenario every 5 s and ignores prefers-reduced-motion; it pauses while
 * the pointer is over it. Hover it right after hydration so every capture
 * shows the first scenario.
 */
export async function pauseAuthHero(page: Page): Promise<void> {
  const hero = page.getByText(/same math you.ll see in the app/i);
  if (await hero.isVisible()) await hero.hover();
}

/**
 * Relative times ("Updated 4m ago") are worked out in the browser from
 * Date.now(). Pinning Date to when the seed was built makes them the same on
 * every run (they are masked too, but a mask is as wide as its text).
 * Timers keep running.
 */
export async function pinClock(page: Page, seededAt: string): Promise<void> {
  await page.clock.setFixedTime(new Date(seededAt));
}

/**
 * The tree canvas fits itself once, on mount, to whatever size its pane had
 * then; the strips above it load a moment later and shrink the pane, so the
 * first fit lands wherever the timing put it. Fit again once everything is
 * in place. (dispatchEvent: at 390 px the controls are covered.)
 */
export async function refitCanvas(page: Page): Promise<void> {
  const fit = page.getByRole('button', { name: 'Fit to view' });
  if ((await fit.count()) === 1) {
    await fit.dispatchEvent('click');
    await settle(page);
  }
}

/**
 * Server timestamps (a run made at 2:02 PM, or at 10:47 PM) are masked, but a
 * mask is as wide as its text and digits are not all the same width, so the
 * layout still moved with the time of day. Rewrite every date and clock time
 * in the page to one fixed value before the capture; the masks then cover
 * boxes of the same size on every run.
 */
async function normalizeVolatileText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rules: Array<[RegExp, string]> = [
      [/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)([a-z]*\.?) \d{1,2}\b/g, 'Jan$2 1'],
      [/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '1/1/2026'],
      [/\b20\d{2}-\d{2}-\d{2}\b/g, '2026-01-01'],
      [/\b\d{1,2}:\d{2}:\d{2}(\s?[AP]M)?\b/g, '12:00:00$1'],
      [/\b\d{1,2}:\d{2}(\s?[AP]M)?\b/g, '12:00$1'],
    ];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const before = n.nodeValue ?? '';
      let after = before;
      for (const [re, to] of rules) after = after.replace(re, to);
      if (after !== before) n.nodeValue = after;
    }
  });
}

export async function snap(page: Page, name: string, target?: Locator): Promise<void> {
  await settle(page);
  await refitCanvas(page);
  await normalizeVolatileText(page);
  if (target) {
    await expect(target).toHaveScreenshot(`${name}.png`, { mask: volatileMasks(page), timeout: 30_000 });
    return;
  }
  const { height, width } = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
  }));
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: volatileMasks(page),
    ...(height > MAX_HEIGHT ? { clip: { x: 0, y: 0, width, height: MAX_HEIGHT } } : {}),
    timeout: 30_000,
  });
}
