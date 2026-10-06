#!/usr/bin/env node
/**
 * The app the e2e tester drives (started by e2e.config.ts `app.command`).
 *
 *   1. Runs the Playwright suite's server, tests/e2e/support/serve.mjs, on
 *      E2E_PORT (3150): it builds a throwaway database lcapix_t_e2e_<time>_<hex>
 *      with scripts/db/fresh.mjs on the local MySQL (127.0.0.1 / localhost only),
 *      starts `next dev` on it with every third-party key blanked and outbound
 *      network blocked, and drops the database when it stops.
 *   2. Warms the app: signs up one warm-up account through the API, loads its
 *      worked example and opens every page the tests visit in Chromium, so
 *      `next dev` compiles each page and the API routes it calls before the
 *      first test. Otherwise the first test on a page pays for the compile and
 *      every compile pushes a rebuild to the pages other workers have open.
 *   3. Only then answers on E2E_READY_PORT (3151), the target's readyUrl.
 *
 * SIGTERM / SIGINT (the runner stopping the app) is passed to the server,
 * which stops next dev and drops the database before this process exits.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PORT = Number(process.env.E2E_PORT || 3150);
const READY_PORT = Number(process.env.E2E_READY_PORT || PORT + 1);
const BASE = `http://localhost:${PORT}`;
// Outside the repo: Tailwind watches the project tree (see tests/e2e/support/paths.ts).
const ARTIFACTS_DIR = process.env.E2E_ARTIFACTS_DIR || path.join(os.tmpdir(), `lcapix-e2e-tester-${PORT}`);

const log = (s) => process.stderr.write(`[e2e-tester serve] ${s}\n`);

const server = spawn(process.execPath, [path.join(REPO_ROOT, 'tests', 'e2e', 'support', 'serve.mjs')], {
  cwd: REPO_ROOT,
  env: { ...process.env, E2E_PORT: String(PORT), E2E_ARTIFACTS_DIR: ARTIFACTS_DIR },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let ready;
let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`${signal}: stopping`);
  ready?.close();
  if (server.exitCode === null) server.kill('SIGTERM');
  // serve.mjs force-kills next dev after 5 s and then drops the database.
  setTimeout(() => {
    if (server.exitCode === null) server.kill('SIGKILL');
  }, 20_000).unref();
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => stop(sig));
server.on('exit', (code, signal) => {
  ready?.close();
  process.exit(stopping ? 0 : code ?? (signal ? 1 : 0));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForApp(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    try {
      const res = await fetch(`${BASE}/auth/login`, { signal: AbortSignal.timeout(120_000) });
      if (res.status < 500) return;
    } catch {
      // not listening yet
    }
    await sleep(1000);
  }
  throw new Error(`${BASE} did not answer within ${timeoutMs / 1000} s`);
}

async function api(method, p, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function warm() {
  const started = Date.now();
  // Signup is rate limited per client IP (first x-forwarded-for hop): a made-up one.
  const b = randomBytes(3);
  const ip = `10.${b[0]}.${b[1]}.${(b[2] % 250) + 1}`;
  const email = `warmup-${Date.now().toString(36)}@e2e-tester.lcapix.test`;
  const signup = await api('POST', '/api/auth/signup', {
    body: { email, password: `e2e-${randomBytes(12).toString('base64url')}-7`, full_name: 'Wanda Warmup' },
    headers: { 'x-forwarded-for': ip },
  });
  const token = signup.token;
  await api('PUT', '/api/auth/profile', {
    token,
    body: { fullName: 'Wanda Warmup', company: 'E2E Test Co', role: 'Sustainability analyst', useCase: 'product', country: 'United States' },
  });
  const ex = await api('POST', '/api/example-project', { token });
  const run = await api('POST', `/api/cases/${ex.case_id}/assessments`, { token, body: { run_name: 'Assessment' } });
  const p = ex.project_id;
  const c = ex.case_id;
  // Routes a page does not call on load (clicks, saves, exports), compiled
  // here so no test pays for them. A GET to a POST-only route still compiles it.
  const comps = (await api('GET', `/api/cases/${c}/components`, { token })).components;
  const step = comps.find((x) => x.parent_component_id != null) ?? comps[0];
  const flows = (await api('GET', `/api/components/${step.component_id}/flows`, { token })).flows ?? [];
  const routes = [
    `/api/assessments/${run.run_id}/export?format=csv`,
    `/api/components/${step.component_id}`,
    ...(flows[0] ? [`/api/flows/${flows[0].flow_id}`] : []),
    '/api/substances',
    `/api/cases/${c}/duplicate`,
    `/api/projects/${ex.project_id}/members`,
    `/api/projects/${ex.project_id}/progress`,
    '/api/auth/login',
    '/api/ingest/preview',
    '/api/ingest/apply',
  ];
  for (const route of routes) {
    await fetch(`${BASE}${route}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(180_000) }).catch(() => undefined);
  }
  log(`seeded the warm-up account (${((Date.now() - started) / 1000).toFixed(1)} s)`);

  const user = { id: signup.user.id, username: signup.user.username, email: signup.user.email, account_type: 'user' };
  const storeUser = { id: String(signup.user.id), name: 'Wanda Warmup', email: signup.user.email, createdAt: '2026-01-01T00:00:00.000Z' };
  const signedIn = {
    cookies: [],
    origins: [
      {
        origin: BASE,
        localStorage: [
          { name: 'auth_token', value: token },
          { name: 'user', value: JSON.stringify(user) },
          { name: 'lcapix-auth', value: JSON.stringify({ state: { user: storeUser, isAuthenticated: true }, version: 0 }) },
        ],
      },
    ],
  };
  const pages = [
    ['/', false],
    ['/auth/login', false],
    ['/auth/signup', false],
    ['/auth/onboarding', true],
    ['/home', true],
    [`/project/${p}`, true],
    [`/project/${p}/case/${c}`, true],
    [`/project/${p}/case/${c}/results`, true],
    [`/project/${p}/comparison`, true],
    [`/project/${p}/import`, true],
    [`/project/${p}/class`, true],
  ];
  const browser = await chromium.launch();
  try {
    for (const [route, auth] of pages) {
      const context = await browser.newContext({ storageState: auth ? signedIn : undefined, viewport: { width: 1440, height: 900 } });
      // The warm-up browser may load this server and nothing else.
      await context.route((url) => url.origin !== BASE && url.protocol.startsWith('http'), (r) => r.abort('blockedbyclient'));
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}${route}`, { timeout: 180_000 });
        await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
      } catch (e) {
        log(`warm-up of ${route} failed: ${String(e?.message ?? e).split('\n')[0]}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  log(`warmed ${pages.length} pages (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

try {
  await waitForApp(240_000);
  log(`${BASE} is up; warming`);
  if (process.env.E2E_WARM !== '0') await warm();
  if (!stopping) {
    ready = http.createServer((_req, res) => res.end('ready\n'));
    ready.listen(READY_PORT, '127.0.0.1', () => log(`ready (readyUrl http://127.0.0.1:${READY_PORT}/)`));
  }
} catch (e) {
  log(`could not get ready: ${e?.message ?? e}`);
  stop('startup failure');
}
