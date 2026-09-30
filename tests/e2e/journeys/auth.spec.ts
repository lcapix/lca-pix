/**
 * F1 sign up → onboarding → home, F2 log in (wrong password, right password)
 * and log out. docs/flows/USER_FLOWS.md §F1–F2.
 */
import { newPassword, uniqueEmail } from '../support/api';
import { expect, storagePath, test } from '../support/fixtures';
import { expectToast, open, toasts } from '../support/ui';

test.describe('F1 sign up', () => {
  test.use({ storageState: storagePath('anon') });

  test('sign up → onboarding → home with the empty dashboard', async ({ page }) => {
    await open(page, '/auth/signup', { ready: 'Create your account.' });
    const create = page.getByRole('button', { name: 'Create account' });
    await expect(create).toBeDisabled();

    await page.getByLabel('Name').fill('Sam Signup');
    await page.getByLabel('Email').fill(uniqueEmail('signup'));
    await page.getByLabel('Password', { exact: true }).fill(newPassword());
    await create.click();

    await expect(page).toHaveURL(/\/auth\/onboarding$/);
    await expect(page.getByRole('button', { name: 'Continue to dashboard' })).toBeVisible();
    // The onboarding labels are not tied to their inputs (no htmlFor / id),
    // so the fields have no accessible name: fall back to placeholders.
    // Recorded in the a11y baseline (rule "label").
    const fullName = page.getByPlaceholder('Jane Doe');
    await expect(fullName).toHaveValue('Sam Signup'); // prefilled from sign-up
    await page.getByPlaceholder('Acme Sustainability').fill('E2E Test Co');
    await page.getByRole('button', { name: 'Continue to dashboard' }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Welcome back, Sam.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start your first assessment.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open the worked example' })).toBeVisible();
  });

  test('onboarding requires full name and company', async ({ newUser, signIn }) => {
    const user = await newUser('onboard', { onboard: false });
    const signed = await signIn(user);
    await open(signed.page, '/auth/onboarding', { ready: 'Continue to dashboard' });
    await signed.page.getByPlaceholder('Jane Doe').fill('');
    await signed.page.getByRole('button', { name: 'Continue to dashboard' }).click();
    await expect(signed.page.getByText('Required.').first()).toBeVisible();
    await expect(signed.page).toHaveURL(/\/auth\/onboarding$/);
  });
});

test.describe('F2 log in and out', () => {
  test.use({ storageState: storagePath('anon') });

  test('a wrong password shows the "Login failed" toast and stays on the form', async ({ page, newUser }) => {
    const user = await newUser('wrongpw');
    await open(page, '/auth/login', { ready: 'Welcome back.' });
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(`${user.password}-wrong`);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expectToast(page, 'Login failed');
    await expect(toasts(page).getByText('Invalid email or password')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });

  test('the right password lands on home', async ({ page, newUser }) => {
    const user = await newUser('login');
    await open(page, '/auth/login', { ready: 'Welcome back.' });
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: /^Welcome back, / })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeTruthy();
  });

  test('log out clears the session and protected pages send you to log in', async ({ newUser, signIn }) => {
    const user = await newUser('logout');
    const { page } = await signIn(user);
    await open(page, '/home', { ready: 'Welcome back' });

    await page.getByRole('button', { name: 'Account menu' }).click();
    const logout = page.waitForResponse((r) => r.url().includes('/api/auth/logout'));
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await logout;

    await expect(page).toHaveURL(/\/auth\/login/);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
