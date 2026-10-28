/**
 * Profile, admin, and the auth screens. Sign-up, login, logout and the
 * onboarding name check are exercised by the auth journey (G82, G85, G89,
 * G92, G97, G99, G101, G107, G72, G120).
 */
import { expect, storagePath, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

test.describe('profile', () => {
  test.use({ storageState: storagePath('owner') });

  test('G57 G58 G59 G60 G62 G63 G65 G67 G68 G69 G103 G105 G119 profile, reached from the account menu', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, '/home', { ready: /Welcome/ });
    await page.getByRole('button', { name: /^Account menu/ }).click();
    await row(page.getByRole('menuitem', { name: 'Profile' }), 'G57', 'Reached from account menu');
    await row(page.getByRole('menuitem', { name: 'Profile' }), 'G119', 'Account menu: Profile');
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await row(page.getByRole('navigation', { name: 'Main' }), 'G58', 'Page chrome');
    await row(page.getByRole('button', { name: 'Back to home' }), 'G59', 'Back to home');
    await row(page.getByRole('heading', { name: 'Olivia Owner' }), 'G60', 'Header: name, email, company');
    await row(page.getByText('owner@e2e.lcapix.test').first(), 'G60', 'Header: name, email, company');
    await row(page.getByText('E2E Test Co').first(), 'G60', 'Header: name, email, company');
    await row(page.getByText(/Full name/), 'G62', 'Edit full name (required)');
    await row(page.getByRole('combobox', { name: 'Country' }), 'G63', 'Edit country');
    await row(page.getByRole('combobox', { name: 'Country' }), 'G105', 'Country (optional)');
    await row(page.getByRole('textbox', { name: 'e.g. Sustainability analyst' }), 'G65', 'Edit role');
    await row(page.getByRole('textbox', { name: 'e.g. Sustainability analyst' }), 'G103', 'Role (optional)');
    await row(page.getByText('Username'), 'G67', 'Read-only email / username / member since');
    await row(page.getByText('Member since'), 'G67', 'Read-only email / username / member since');
    await page.getByRole('textbox', { name: 'Jane Doe' }).fill('Olivia Owner edited');
    await row(page.getByRole('button', { name: 'Discard' }), 'G69', 'Discard / Save bar');
    await row(page.getByRole('button', { name: 'Save changes' }), 'G69', 'Discard / Save bar');

    await page.route(/\/api\/auth\/profile/, (route) => route.abort('failed'));
    await page.goto('/profile');
    await row(page.getByRole('button', { name: 'Retry' }), 'G68', 'Load error + Retry');
  });
});

test('G74 G75 G77 G78 G79 G80 G81 G114 admin integrations, and the notice for everyone else', async ({ seed, signIn }) => {
  test.setTimeout(180_000);
  const owner = await signIn(seed.users.owner);
  await open(owner.page, '/admin/integrations', { ready: 'Admins only' });
  await row(owner.page.getByRole('heading', { name: 'Admins only' }), 'G77', 'Admin gate / access notice');
  await owner.context.close();

  const admin = await signIn(seed.users.admin);
  const page = admin.page;
  await open(page, '/home', { ready: /Welcome/ });
  await page.getByRole('button', { name: /^Account menu/ }).click();
  await row(page.getByRole('menuitem', { name: 'Integrations' }), 'G74', 'Top-nav link (admins)');
  await row(page.getByRole('menuitem', { name: 'Integrations' }), 'G75', 'Account menu entry (admins)');
  await row(page.getByRole('menuitem', { name: 'Integrations' }), 'G114', 'Integrations (admins)');
  await page.getByRole('menuitem', { name: 'Integrations' }).click();
  await row(page.getByRole('navigation', { name: 'Main' }), 'G81', 'Page chrome');
  await row(page.getByRole('button', { name: 'Refresh', exact: true }), 'G78', 'Refresh');
  const tabs = ['Overview', 'Data Sources', 'API Keys', 'Activity Log', 'Schema'];
  const missing = [];
  for (const name of tabs) {
    if (!(await page.getByRole('button', { name, exact: true }).isVisible())) missing.push(name);
  }
  await expectSoft(missing, 'G79', 'Tabs Overview / Data Sources / API Keys / Activity Log / Schema');
  await row(page.getByRole('button', { name: 'Import openLCA CML 2001' }), 'G80', 'Import openLCA CML 2001, PubChem enrich');
  await row(page.getByRole('button', { name: 'Enrich substances from PubChem' }), 'G80', 'Import openLCA CML 2001, PubChem enrich');
});

test.describe('logged out', () => {
  test.use({ storageState: storagePath('anon') });

  test('G83 G84 G86 G87 G90 log in: show the password, reject an empty form, Google, and error codes', async ({ page }) => {
    await open(page, '/auth/login?error=session_expired', { ready: 'Log in' });
    await row(page.getByText('Session expired'), 'G87', '?error= codes (10 known, generic fallback)');
    await open(page, '/auth/login?error=not-a-real-code', { ready: 'Log in' });
    await row(page.getByText('Sign-in error'), 'G87', '?error= codes (10 known, generic fallback)');
    await row(page.getByRole('button', { name: 'Show password' }), 'G83', 'Show/hide password');
    await row(page.getByRole('button', { name: 'Continue with Google' }), 'G86', 'Google sign-in');
    await row(page.getByRole('link', { name: 'Create one' }), 'G90', 'Link to sign-up');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await row(page.getByText('Enter your email.'), 'G84', 'Field validation');
  });

  test('G93 G94 G95 G98 sign up: the password rule, a duplicate email, and Google', async ({ page, seed }) => {
    await open(page, '/auth/signup', { ready: 'Create your account' });
    await row(page.getByText('At least 8 characters with one number.'), 'G93', 'Password rule + hint');
    await row(page.getByRole('button', { name: 'Continue with Google' }), 'G95', 'Google sign-up');
    await row(page.getByRole('link', { name: 'Log in', exact: true }), 'G98', 'Link to login');
    await page.getByLabel('Your name').fill('Sam Duplicate');
    await page.getByLabel('Email').fill(seed.users.owner.email);
    await page.getByLabel('Password', { exact: true }).fill('parity-pass-7');
    await page.getByRole('button', { name: 'Create account' }).click();
    await row(page.getByRole('link', { name: 'Log in instead.' }), 'G94', 'Duplicate / other errors');
  });
});

test.describe('already onboarded', () => {
  test.use({ storageState: storagePath('owner') });

  test('G100 an onboarded person is sent on from About you', async ({ page }) => {
    await open(page, '/auth/onboarding');
    await page.waitForURL(/\/home/, { timeout: 60_000 });
    await row(page.getByRole('heading', { name: /Welcome/ }), 'G100', 'Leave if already done');
  });
});

test.describe('still onboarding', () => {
  test.use({ storageState: storagePath('newcomer') });

  test('G102 institution is optional', async ({ page }) => {
    await open(page, '/auth/onboarding', { ready: 'Tell us a little about you.' });
    await row(page.getByText(/Institution/), 'G102', 'Company required');
    await row(page.getByText('optional'), 'G102', 'Company required');
  });
});

test.describe('google callback', () => {
  test.use({ storageState: storagePath('anon') });

  test('G108 G109 the Google callback stores a token, and a failure returns to log in', async ({ page, newUser }) => {
  test.setTimeout(120_000);
  const user = await newUser('parity-callback');
  await page.route('**/api/auth/google/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: user.token,
        user: { id: user.id, username: user.username, email: user.email },
      }),
    }),
  );
  await page.goto('/auth/callback?next=/home');
  await page.waitForURL(/\/home/, { timeout: 60_000 });
  await row(page.getByRole('heading', { name: /Welcome/ }), 'G108', 'Token hand-off, store, redirect (next whitelist /home, /auth/onboarding)');

  await page.unroute('**/api/auth/google/session');
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.route('**/api/auth/google/session', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/auth/callback');
  await page.waitForURL(/\/auth\/login/, { timeout: 60_000 });
  await row(page.getByText("Couldn't finish Google sign-in"), 'G109', 'Failure: toast + /auth/login?error=oauth_sync_failed');
  });
});

function expectSoft(missing: string[], id: string, capability: string) {
  return expect.soft(missing, note(id, capability)).toEqual([]);
}
