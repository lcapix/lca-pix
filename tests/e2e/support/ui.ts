/**
 * Page helpers shared by every suite.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Spinners and skeletons the app shows while data loads. */
const LOADING = ['.animate-spin', '.skeleton', '[aria-busy="true"]'].join(', ');

/** In-flight /api requests per page (settle() waits for them). */
const inflight = new WeakMap<Page, Set<string>>();

export function trackApi(page: Page): void {
  if (inflight.has(page)) return;
  const set = new Set<string>();
  inflight.set(page, set);
  const key = (r: { url(): string; method(): string }) => `${r.method()} ${r.url()}`;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) set.add(key(r));
  });
  const done = (r: { url(): string; method(): string }) => set.delete(key(r));
  page.on('requestfinished', done);
  page.on('requestfailed', done);
}

/**
 * Wait until the page is quiet: loaded, no /api call in flight for 400 ms,
 * no spinner or skeleton visible, and every web font loaded.
 */
export async function settle(page: Page, opts: { timeout?: number } = {}): Promise<void> {
  const timeout = opts.timeout ?? 30_000;
  const deadline = Date.now() + timeout;
  await page.waitForLoadState('load', { timeout });
  trackApi(page);
  const set = inflight.get(page)!;
  let quietSince = 0;
  while (Date.now() < deadline) {
    const busy =
      set.size > 0 ||
      (await page
        .locator(LOADING)
        .filter({ visible: true })
        .count()
        .catch(() => 0)) > 0;
    if (busy) quietSince = 0;
    else if (!quietSince) quietSince = Date.now();
    else if (Date.now() - quietSince >= 400) break;
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => undefined);
  await waitForHydration(page, Math.max(1_000, deadline - Date.now()));
}

/**
 * Server-rendered HTML shows every label before React has attached a single
 * handler; a click in that window does nothing. React marks each hydrated DOM
 * node with a `__reactProps$…` key, so wait until the page's controls have one.
 */
export async function waitForHydration(page: Page, timeout = 30_000): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const controls = Array.from(document.querySelectorAll('button, input, a[href]')).slice(0, 20);
        return controls.length === 0 || controls.every((el) => Object.keys(el).some((k) => k.startsWith('__reactProps')));
      },
      undefined,
      { timeout, polling: 100 },
    )
    .catch(() => undefined);
}

/** goto + settle, with the API tracker attached before the first request. */
export async function open(page: Page, path: string, opts: { ready?: string | RegExp; timeout?: number } = {}) {
  trackApi(page);
  await page.goto(path);
  if (opts.ready) await expect(page.getByText(opts.ready).first()).toBeVisible({ timeout: opts.timeout ?? 60_000 });
  await settle(page, { timeout: opts.timeout });
}

/** The sonner toast region (bottom-right). */
export function toasts(page: Page): Locator {
  return page.locator('[data-sonner-toaster]');
}

export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(toasts(page).getByText(text).first()).toBeVisible();
}
