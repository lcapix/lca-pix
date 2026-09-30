/**
 * The browser may load http://localhost:<port> and nothing else.
 *
 * - Google Fonts (app/lcapix.css @imports Inter and IBM Plex Mono) are served
 *   from tests/e2e/fixtures/font-cache. A response missing from the cache is
 *   fetched once from Google Fonts — the one allowed outside host — and stored,
 *   so later runs (and CI) are offline and render identical text.
 * - Every other non-localhost request is aborted and recorded; `blocked(context)`
 *   lists them for a test that wants to assert on it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Route } from '@playwright/test';
import { BASE_URL, FONT_CACHE_DIR } from './paths';

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const blockedByContext = new WeakMap<BrowserContext, string[]>();

export function blocked(context: BrowserContext): string[] {
  return blockedByContext.get(context) ?? [];
}

function cacheKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24);
}

async function serveFont(route: Route): Promise<void> {
  const url = route.request().url();
  const key = cacheKey(url);
  const meta = path.join(FONT_CACHE_DIR, `${key}.json`);
  const body = path.join(FONT_CACHE_DIR, `${key}.bin`);
  if (existsSync(meta) && existsSync(body)) {
    const { contentType } = JSON.parse(readFileSync(meta, 'utf8')) as { contentType: string };
    await route.fulfill({
      status: 200,
      contentType,
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=31536000' },
      body: readFileSync(body),
    });
    return;
  }
  if (process.env.E2E_OFFLINE === '1') {
    await route.abort('internetdisconnected');
    return;
  }
  const res = await route.fetch();
  const buf = await res.body();
  if (res.ok()) {
    mkdirSync(FONT_CACHE_DIR, { recursive: true });
    const contentType = res.headers()['content-type'] ?? 'application/octet-stream';
    // Write-then-rename: parallel workers may cache the same file at once.
    const tmp = `${body}.${process.pid}.tmp`;
    writeFileSync(tmp, buf);
    renameSync(tmp, body);
    writeFileSync(meta, JSON.stringify({ url, contentType }, null, 2));
  }
  await route.fulfill({ response: res, body: buf });
}

export async function installNetGuard(context: BrowserContext): Promise<void> {
  const origin = new URL(BASE_URL).origin;
  const list: string[] = [];
  blockedByContext.set(context, list);
  await context.route(
    (url) => url.origin !== origin && url.protocol !== 'data:' && url.protocol !== 'blob:',
    async (route) => {
      const url = new URL(route.request().url());
      if (FONT_HOSTS.includes(url.hostname)) return serveFont(route);
      list.push(url.href);
      await route.abort('blockedbyclient');
    },
  );
}
