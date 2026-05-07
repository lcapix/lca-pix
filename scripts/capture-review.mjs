import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3002';
const OUT = path.resolve('review-screens');

const BUILT = [
  { slug: '01-login',             path: '/auth/login',                  label: 'Sign in' },
  { slug: '02-home-projects',     path: '/home',                        label: 'Projects' },
  { slug: '03-new-project',       path: '/project/new',                 label: 'New project' },
  { slug: '04-project-detail',    path: '/project/10',                  label: 'Project detail' },
  { slug: '05-new-base-case',     path: '/project/10/case/base/new',    label: 'New base case' },
  { slug: '06-new-comp-case',     path: '/project/10/case/comparative/new', label: 'New comparative case' },
  { slug: '07-case-tree',         path: '/project/10/case/22',          label: 'Case editor — Tree view', action: 'view-tree' },
  { slug: '08-case-list',         path: '/project/10/case/22',          label: 'Case editor — List view', action: 'view-list' },
  { slug: '09-case-graph',        path: '/project/10/case/22',          label: 'Case editor — Graph view', action: 'view-graph' },
  { slug: '10-add-component',     path: '/project/10/case/22',          label: 'Add component modal',     action: 'add-component' },
  { slug: '11-results',           path: '/project/10/case/22/results',  label: 'Assessment results' },
];

const CONSTRUCTION = [
  { slug: '12-comparisons-list',  path: '/project/10/comparisons',      label: 'Comparisons (list)' },
  { slug: '13-analytics',         path: '/project/10/analytics',        label: 'Analytics' },
  { slug: '14-integrations',      path: '/admin/integrations',          label: 'Integrations (admin)' },
  { slug: '15-guide',             path: '/guide',                       label: 'Docs / Guide' },
  { slug: '16-about',             path: '/about',                       label: 'About' },
];

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Seed auth via API so we don't have to drive the login form.
const login = await page.request.post(`${BASE}/api/auth/login`, {
  data: { email: 'john@lcaproject.com', password: 'Lcapix@2026' },
});
const loginJson = await login.json();
if (!loginJson.token) throw new Error('Login failed: ' + JSON.stringify(loginJson));

// Inject into localStorage for the origin.
await page.goto(`${BASE}/auth/login`);
await page.evaluate(({ token, user }) => {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('user', JSON.stringify(user));
  // Zustand persist blob — AuthGuard reads `isAuthenticated` from here.
  localStorage.setItem(
    'lcapix-auth',
    JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }),
  );
}, { token: loginJson.token, user: loginJson.user });

async function capture(screen) {
  const file = path.join(OUT, `${screen.slug}.png`);
  // For the login screen we want the page WITHOUT auth, so log out first.
  if (screen.slug === '01-login') {
    await page.evaluate(() => { localStorage.removeItem('auth_token'); localStorage.removeItem('user'); });
  }
  await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1200);

  if (screen.action === 'view-list') {
    await page.getByRole('button', { name: 'List', exact: true }).click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if (screen.action === 'view-graph') {
    await page.getByRole('button', { name: 'Graph', exact: true }).click().catch(() => {});
    await page.waitForTimeout(900);
  }
  if (screen.action === 'view-tree') {
    await page.getByRole('button', { name: 'Tree', exact: true }).click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if (screen.action === 'add-component') {
    await page.getByRole('button', { name: 'Add Component' }).click().catch(() => {});
    await page.waitForTimeout(900);
  }

  await page.screenshot({ path: file, fullPage: false });
  console.log('captured', screen.slug);

  // Re-seed auth after login page capture so subsequent shots are authenticated.
  if (screen.slug === '01-login') {
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: loginJson.token, user: loginJson.user });
  }
}

for (const s of [...BUILT, ...CONSTRUCTION]) {
  try { await capture(s); }
  catch (e) { console.log('FAILED', s.slug, e.message); }
}

await browser.close();
console.log('done');
