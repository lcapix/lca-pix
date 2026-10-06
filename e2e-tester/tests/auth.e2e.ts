/**
 * F1 sign up → onboarding → home; F2 a wrong password shows the error toast.
 * docs/flows/USER_FLOWS.md §F1–F2 (same journeys as tests/e2e/journeys/auth.spec.ts).
 */
import { newPassword, uniqueEmail } from '../support/api.ts';
import { toasts } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';

test('sign up → onboarding → home with the empty dashboard', async ({ app, screen, browser }) => {
  await app.open('/auth/signup');
  await expect(screen.getByRole('heading', 'Create your account.')).toBeVisible();
  const create = screen.getByRole('button', 'Create account');
  await expect(create).toBeDisabled();

  await screen.getByLabel('Name').fill('Sam Signup');
  await screen.getByLabel('Email').fill(uniqueEmail('signup'));
  await screen.getByLabel('Password').fill(newPassword());
  await create.tap();

  await expect(browser).toHaveURL('/auth/onboarding', { timeout: 30_000 });
  const next = screen.getByRole('button', 'Continue to dashboard');
  await expect(next).toBeVisible();
  // The onboarding labels are not tied to their inputs (no htmlFor / id), so
  // the fields have no accessible name: placeholders stand in.
  await expect(screen.getByPlaceholder('Jane Doe')).toHaveValue('Sam Signup'); // prefilled from sign-up
  await screen.getByPlaceholder('Acme Sustainability').fill('E2E Test Co');
  await next.tap();

  await expect(browser).toHaveURL('/home', { timeout: 30_000 });
  await expect(screen.getByRole('heading', 'Welcome back, Sam.')).toBeVisible();
  await expect(screen.getByRole('heading', 'Start your first assessment.')).toBeVisible();
  await expect(screen.getByRole('button', 'Create your first project')).toBeVisible();
  await expect(screen.getByRole('button', 'Open the worked example')).toBeVisible();
});

test('log in with a wrong password shows the "Login failed" toast and stays on the form', async ({ app, screen, browser, newUser }) => {
  const user = await newUser('wrongpw');
  await app.open('/auth/login');
  await expect(screen.getByRole('heading', 'Welcome back.')).toBeVisible();
  await screen.getByLabel('Email').fill(user.email);
  await screen.getByLabel('Password').fill(`${user.password}-wrong`);
  await screen.getByRole('button', 'Log in').tap();

  await expect(toasts(screen).getByText('Login failed')).toBeVisible();
  await expect(toasts(screen).getByText('Invalid email or password')).toBeVisible();
  await expect(screen.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
  await expect(browser).toHaveURL('/auth/login');
  expect(await browser.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
});
