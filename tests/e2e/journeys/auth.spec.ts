/**
 * F1 sign up → About you → the sample study built → Home opens on it; F2 log
 * in (wrong password, right password) and log out. docs/flows/USER_FLOWS.md
 * §F1–F2, on the education screens (F1.2, F1.2b, F1.3, E02).
 */
import { newPassword, uniqueEmail } from '../support/api';
import { expect, storagePath, test } from '../support/fixtures';
import { open } from '../support/ui';

// Building the sample and compiling Home can pass the 20 s default under parallel load.
const NAV = { timeout: 90_000 };

test.describe('F1 sign up', () => {
  test.use({ storageState: storagePath('anon') });

  test('sign up → About you → the sample study is built and Home opens on it', async ({ page }) => {
    await open(page, '/auth/signup', { ready: 'Create your account' });
    await page.getByLabel('Your name').fill('Sam Signup');
    await page.getByLabel('Email').fill(uniqueEmail('signup'));
    await page.getByLabel('Password', { exact: true }).fill(newPassword());
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/auth\/onboarding$/, NAV);
    await expect(page.getByRole('heading', { name: 'Tell us a little about you.' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveValue('Sam Signup'); // kept from sign-up

    const built = page.waitForResponse((r) => r.url().includes('/api/example-project') && r.request().method() === 'POST', NAV);
    await page.getByRole('button', { name: 'Open the sample study' }).click();
    expect((await built).status()).toBe(200);

    await expect(page).toHaveURL(/\/home$/, NAV);
    await expect(page.getByText('Sample study', { exact: true })).toBeVisible(NAV);
    await expect(page.getByText('Read-only · made for you when you signed up')).toBeVisible();
    // The page's one primary, in its header (What next offers it again).
    await expect(page.locator('header').getByRole('button', { name: 'Make my own copy' })).toBeVisible();
  });

  test('About you needs a name, and keeps you on the form without one', async ({ newUser, signIn }) => {
    const user = await newUser('onboard', { onboard: false });
    const { page } = await signIn(user);
    await open(page, '/auth/onboarding', { ready: 'Tell us a little about you.' });
    await page.getByLabel('Full name').fill('');
    await page.getByRole('button', { name: 'Open the sample study' }).click();
    await expect(page.getByText('Enter your name. It is how people in your projects see you.')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/onboarding$/);
  });
});

test.describe('F2 log in and out', () => {
  test.use({ storageState: storagePath('anon') });

  test('a wrong password is said under the field, and nothing is signed in', async ({ page, newUser }) => {
    const user = await newUser('wrongpw');
    await open(page, '/auth/login', { ready: 'Log in' });
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(`${user.password}-wrong`);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    // One message for a wrong password and an unknown email: the form never says who has an account.
    await expect(page.getByText('Invalid email or password. Try again.')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });

  test('the right password lands on Home', async ({ page, newUser }) => {
    const user = await newUser('login');
    await open(page, '/auth/login', { ready: 'Log in' });
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page).toHaveURL(/\/home$/, NAV);
    // No project yet: the three ways in (E01b).
    await expect(page.getByRole('heading', { name: 'Welcome to LCAPIX' })).toBeVisible(NAV);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeTruthy();
  });

  test('log out clears the session and protected pages send you to log in', async ({ newUser, signIn }) => {
    const user = await newUser('logout');
    const { page } = await signIn(user);
    await open(page, '/home', { ready: 'Welcome to LCAPIX' });

    await page.getByRole('button', { name: /^Account menu/ }).click();
    const logout = page.waitForResponse((r) => r.url().includes('/api/auth/logout'));
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await logout;

    await expect(page).toHaveURL(/\/auth\/login/, NAV);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/auth\/login/, NAV);
  });
});
