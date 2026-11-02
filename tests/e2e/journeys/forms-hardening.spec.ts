/**
 * Enter never saves (B2), on the forms a student meets first: New project,
 * New case and About you. Only the button submits, and a second press while
 * the first is saving does not make a second one. New case copies the
 * student's own case by default, not the read-only sample (C3). Signed in,
 * Sign up and Log in send you Home (C5). Each walked as a person does, and
 * checked against what was (or was not) saved.
 */
import type { Page, Request } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

/** Writes the page sends to an API path while `run` goes. */
async function writesDuring(page: Page, pathPart: string, run: () => Promise<void>): Promise<number> {
  const seen: Request[] = [];
  const on = (r: Request) => {
    if (r.url().includes(pathPart) && r.method() !== 'GET') seen.push(r);
  };
  page.on('request', on);
  await run();
  // Long enough for a submit to have been sent, had there been one.
  await page.waitForTimeout(1200);
  page.off('request', on);
  return seen.length;
}

test('B2 New project: Enter in the name or the functional unit makes nothing; Continue makes it once', async ({ api, newUser, signIn }) => {
  const user = await newUser('form-project');
  const as = api.as(user.token);
  const { page } = await signIn(user);
  await open(page, '/project/new', { ready: 'Start your own project' });
  const name = `Enter study ${Date.now()}`;
  const mine = async () => ((await as.get('/api/projects')).projects as any[]).filter((p) => p.project_name === name);

  await page.getByLabel(/Project name/).fill(name);
  expect(await writesDuring(page, '/api/projects', () => page.getByLabel(/Project name/).press('Enter'))).toBe(0);
  await page.getByLabel('Functional unit', { exact: true }).fill('1 bike frame');
  expect(await writesDuring(page, '/api/projects', () => page.getByLabel('Functional unit', { exact: true }).press('Enter'))).toBe(0);
  await expect(page).toHaveURL(/\/project\/new$/);
  expect(await mine()).toHaveLength(0);

  // Continue, pressed twice in a row: one project, with its functional unit.
  await page.getByRole('button', { name: 'Continue →' }).dblclick();
  await expect(page).toHaveURL(/\/project\/\d+\/import\?first=1$/, NAV);
  const projects = await mine();
  expect(projects).toHaveLength(1);
  expect((await as.get(`/api/projects/${projects[0].project_id}`)).project.functional_unit).toBe('1 bike frame');
});

test('B2 New case: Enter in "What will you change?" makes nothing; Make the case does', async ({ api, newUser, signIn }) => {
  const user = await newUser('form-case');
  const as = api.as(user.token);
  const projectId = (await as.post('/api/projects', { project_name: 'Case form study', description: 'Forms' })).project.project_id as number;
  await as.post(`/api/projects/${projectId}/cases`, { case_name: 'Base case', case_type: 'base', description: 'Here' });
  const cases = async () => ((await as.get(`/api/projects/${projectId}/cases`)).cases as any[]).length;
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/case/new`, { ready: 'What kind of case?' });

  await page.getByLabel('Case name').fill('Lighter blank');
  await page.getByLabel(/What will you change\?/).fill('Steel blank from 0.80 kg to 0.78 kg');
  expect(await writesDuring(page, '/api/', () => page.getByLabel(/What will you change\?/).press('Enter'))).toBe(0);
  expect(await writesDuring(page, '/api/', () => page.getByLabel('Case name').press('Enter'))).toBe(0);
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/new`));
  expect(await cases()).toBe(1);

  await page.getByRole('button', { name: 'Make the case →' }).click();
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/\\d+$`), NAV);
  expect(await cases()).toBe(2);
});

test('C3 New case in the sample study copies your own copy by default, not the read-only sample', async ({ api, newUser, signIn }) => {
  const user = await newUser('form-sample');
  const as = api.as(user.token);
  const sample = await as.post<{ project_id: number; case_id: number }>('/api/example-project');
  const copy = (await as.post(`/api/cases/${sample.case_id}/duplicate`, { case_name: "Jordan Journey's case" })) as any;
  const copyId = Number(copy.case_id ?? copy.case?.case_id);
  const { page } = await signIn(user);
  await open(page, `/project/${sample.project_id}/case/new`, { ready: 'What kind of case?' });
  await expect(page.getByLabel('Copy from')).toHaveValue(String(copyId), NAV);
  await expect(page.getByLabel('Copy from').locator('option:checked')).toHaveText(/^Jordan Journey's case/);
});

test('B2 About you: Enter in Institution does not submit', async ({ newUser, signIn }) => {
  const user = await newUser('form-about', { onboard: false });
  const { page } = await signIn(user);
  await open(page, '/auth/onboarding', { ready: 'Tell us a little about you.' });
  await page.getByLabel('Full name').fill('Robin Enter');
  await page.getByLabel(/Institution/).fill('Duke University');
  expect(await writesDuring(page, '/api/', () => page.getByLabel(/Institution/).press('Enter'))).toBe(0);
  await expect(page).toHaveURL(/\/auth\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Tell us a little about you.' })).toBeVisible();
});

test('C5 signed in, Sign up and Log in send you Home', async ({ newUser, signIn }) => {
  const user = await newUser('form-signed-in');
  const { page } = await signIn(user);
  await open(page, '/home');
  await page.goto('/auth/signup');
  await expect(page).toHaveURL(/\/home$/, NAV);
  await page.goto('/auth/login');
  await expect(page).toHaveURL(/\/home$/, NAV);
  // Back from Home does not land on a blank sign-up form (the redirect replaced it).
  await expect(page.getByRole('heading', { name: 'Create your account' })).toHaveCount(0);
});
