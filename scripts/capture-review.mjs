#!/usr/bin/env node
/**
 * Screenshots of every screen for a design review, from a LOCAL dev server.
 *
 *   LCAPIX_REVIEW_EMAIL=you@example.test LCAPIX_REVIEW_PASSWORD=... \
 *     node scripts/capture-review.mjs [--base=http://localhost:3002] [--out=review-screens]
 *
 * - Localhost only: the base URL must be http://localhost, 127.0.0.1 or [::1]
 *   (any port); anything else is refused. The browser may load only that
 *   origin (Google Fonts excepted); every other request is aborted.
 * - No credentials in this file: the account comes from LCAPIX_REVIEW_EMAIL
 *   and LCAPIX_REVIEW_PASSWORD (for example from .env.test.local, which is
 *   gitignored). Use a local test account, never a real one.
 * - The screens are tests/e2e/routes.json, the same list the visual and
 *   accessibility baselines use. Ids come from LCAPIX_REVIEW_IDS (JSON, e.g.
 *   {"exampleProject":1,"baseCase":1,...}) or are looked up through the API:
 *   the signed-in account's project with the most cases, its base case, the
 *   first operation in it, and another project for the {fiveTier…} ids.
 *   Routes for other seeded users (viewer, empty, newcomer) are skipped: they
 *   need their own accounts (the e2e suite covers them).
 * - Writes <out>/<slug>.png at 1440×900 (viewport, not full page) plus the
 *   case editor's List and Graph views and the Add component dialog.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const envFile = path.join(ROOT, '.env.test.local');
if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides variables already set

const BASE = arg('base', process.env.LCAPIX_REVIEW_URL || 'http://localhost:3002').replace(/\/$/, '');
const OUT = path.resolve(ROOT, arg('out', 'review-screens'));
const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

let origin;
try {
  const u = new URL(BASE);
  if (u.protocol !== 'http:' || !LOCAL.has(u.hostname)) throw new Error('not local');
  origin = u.origin;
} catch {
  console.error(`Refusing ${BASE}: capture-review only runs against http://localhost (or 127.0.0.1 / [::1]).`);
  process.exit(2);
}

const email = process.env.LCAPIX_REVIEW_EMAIL;
const password = process.env.LCAPIX_REVIEW_PASSWORD;
if (!email || !password) {
  console.error('Set LCAPIX_REVIEW_EMAIL and LCAPIX_REVIEW_PASSWORD (a local test account; .env.test.local works).');
  process.exit(2);
}

const { routes: ROUTES } = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'e2e', 'routes.json'), 'utf8'));

async function api(token, p) {
  const res = await fetch(`${origin}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${p} → ${res.status}`);
  return res.json();
}

/** Ids for the {placeholders} in routes.json. */
async function discoverIds(token) {
  if (process.env.LCAPIX_REVIEW_IDS) return JSON.parse(process.env.LCAPIX_REVIEW_IDS);
  const projects = (await api(token, '/api/projects')).projects ?? [];
  const withCases = [];
  for (const p of projects) {
    const cases = (await api(token, `/api/projects/${p.project_id}/cases`)).cases ?? [];
    withCases.push({ id: p.project_id, cases });
  }
  withCases.sort((a, b) => b.cases.length - a.cases.length);
  const ids = {};
  const main = withCases[0];
  if (main?.cases.length) {
    ids.exampleProject = main.id;
    const base = main.cases.find((c) => c.case_type === 'base') ?? main.cases[0];
    ids.baseCase = base.case_id;
    const comp = main.cases.find((c) => c.case_id !== base.case_id);
    if (comp) ids.compCase = comp.case_id;
    const comps = (await api(token, `/api/cases/${base.case_id}/components`)).components ?? [];
    const step = comps.find((c) => c.parent_component_id != null);
    if (step) ids.cutBlank = step.component_id;
  }
  const other = withCases.find((p) => p !== main && p.cases.length) ?? main;
  if (other?.cases.length) {
    ids.fiveTierProject = other.id;
    ids.fiveTierCase = other.cases[0].case_id;
  }
  return ids;
}

function fill(template, ids) {
  let missing = null;
  const out = template.replace(/\{(\w+)\}/g, (_, key) => {
    if (ids[key] == null) missing = key;
    return String(ids[key]);
  });
  return missing ? null : out;
}

const login = await fetch(`${origin}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = await login.json().catch(() => ({}));
if (!login.ok || !session.token) {
  console.error(`Login failed (${login.status}): ${session.error ?? 'no token'}`);
  process.exit(1);
}
const ids = await discoverIds(session.token);

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.LCAPIX_REVIEW_CHANNEL ? { channel: process.env.LCAPIX_REVIEW_CHANNEL } : {}) });

async function newContext(signedIn) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    storageState: signedIn
      ? {
          cookies: [],
          origins: [
            {
              origin,
              localStorage: [
                { name: 'auth_token', value: session.token },
                { name: 'user', value: JSON.stringify(session.user) },
                {
                  name: 'lcapix-auth',
                  value: JSON.stringify({
                    state: { user: { id: String(session.user.id), name: session.user.username, email: session.user.email, createdAt: new Date().toISOString() }, isAuthenticated: true },
                    version: 0,
                  }),
                },
              ],
            },
          ],
        }
      : { cookies: [], origins: [] },
  });
  await context.route(
    (url) => url.origin !== origin && !['data:', 'blob:'].includes(url.protocol),
    (route) => {
      const host = new URL(route.request().url()).hostname;
      return host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com' ? route.continue() : route.abort('blockedbyclient');
    },
  );
  return context;
}

const contexts = { owner: await newContext(true), anon: await newContext(false) };

async function shoot(slug, target, as, action) {
  const page = await contexts[as].newPage();
  try {
    await page.goto(`${origin}${target}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    if (action) {
      await action(page);
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: path.join(OUT, `${slug}.png`) });
    console.log('captured', slug);
  } catch (e) {
    console.log('FAILED', slug, e.message.split('\n')[0]);
  } finally {
    await page.close();
  }
}

for (const r of ROUTES) {
  const as = r.as ?? 'owner';
  if (!contexts[as]) {
    console.log(`skipped ${r.slug}: needs the seeded "${as}" account`);
    continue;
  }
  const target = fill(r.path, ids);
  if (!target) {
    console.log(`skipped ${r.slug}: no id for ${r.path}`);
    continue;
  }
  await shoot(r.slug, target, as);
}

const editor = fill('/project/{exampleProject}/case/{baseCase}', ids);
if (editor) {
  const click = (name) => (page) => page.getByRole('button', { name }).first().click();
  await shoot('case-editor-list', editor, 'owner', click(/^List$/));
  await shoot('case-editor-graph', editor, 'owner', click(/^(Graph|Plot)$/));
  await shoot('component-dialog', editor, 'owner', click(/^Add Component$/));
}

await browser.close();
console.log('done →', path.relative(ROOT, OUT));
