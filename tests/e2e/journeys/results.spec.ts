/**
 * F9 run → results, F10 export. docs/flows/USER_FLOWS.md §F9–F10.
 */
import { readFileSync } from 'node:fs';
import type { Api, ApiUser } from '../support/api';
import { openCase, workedExample } from '../support/editor';
import { expect, storagePath, test } from '../support/fixtures';
import { open } from '../support/ui';

type Flow = { flow_id: number; substance_name?: string; quantity: number | string };

async function flowsOf(api: Api, user: ApiUser, caseId: number, step: string): Promise<Flow[]> {
  const comps = (await api.as(user.token).get<{ components: Array<{ component_id: number; component_name: string }> }>(
    `/api/cases/${caseId}/components`,
  )).components;
  const id = comps.find((c) => c.component_name === step)!.component_id;
  return (await api.as(user.token).get<{ flows: Flow[] }>(`/api/components/${id}/flows`)).flows;
}

test.describe('F9 run an assessment', () => {
  test('run from the editor → results: total, thousands in the stage panel, tiny values never "0"', async ({ api, newUser, signIn }) => {
    const user = await newUser('results');
    const { projectId, caseId } = await workedExample(api, user);
    // A big number and a tiny one: 800 kg of steel (≈1,520 kg CO2 eq in
    // Materials) and 1e-6 kWh of electricity on the weld step (3.5e-7 kg).
    const steel = (await flowsOf(api, user, caseId, '10. Cut blank')).find((f) => f.substance_name === 'Steel')!;
    await api.as(user.token).put(`/api/flows/${steel.flow_id}`, { quantity: 800 });
    const weld = (await flowsOf(api, user, caseId, '20. Weld tab'))[0];
    await api.as(user.token).put(`/api/flows/${weld.flow_id}`, { quantity: 0.000001 });

    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    const posted = page.waitForResponse((r) => /\/api\/cases\/\d+\/assessments/.test(r.url()) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Run Assessment', exact: true }).click();
    const run = await posted;
    expect(run.status()).toBe(201);
    // The results page (and below, the export route) can wait on a `next dev`
    // compile, which under parallel load takes longer than the 20 s default.
    await expect(page).toHaveURL(/\/results$/, { timeout: 90_000 });

    // The hero total: 800 × 1.9 + (0.05 + 0.000001 + 0.4) × 0.35 = 1,520.1575.
    await expect(page.getByText('TOTAL IMPACT · GLOBAL WARMING')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: /^Global Warming 1,520 kg CO2 eq$/ })).toBeVisible();

    // RES-1: the stage panel printed 1,000 as "1". It must group thousands.
    await expect(page.getByRole('heading', { name: 'By life-cycle stage' })).toBeVisible();
    await expect(page.getByText('Materials', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^1,520 \(100\.0%\)$/)).toBeVisible();

    // RUN-2: a 3.5e-7 contribution is stored and shown, never rounded to 0.
    // The flow table is a grid of divs; a row is the step button's parent.
    const weldRow = page.getByRole('button', { name: '20. Weld tab', exact: true }).last().locator('xpath=..');
    await expect(weldRow).toContainText('3.5e-7');
    await expect(weldRow).not.toContainText(/\s0\s*$/);
    // Acidification is small but not zero.
    await expect(page.getByRole('button', { name: /^Acidification (?!0 )\S+ kg SO2 eq$/ })).toBeVisible();
  });
});

test.describe('F10 export', () => {
  test.use({ storageState: storagePath('owner') });

  for (const [label, ext, check] of [
    ['Export PDF', '.pdf', (b: Buffer) => expect(b.subarray(0, 5).toString('latin1')).toBe('%PDF-')],
    ['Export PPT', '.pptx', (b: Buffer) => expect(b.subarray(0, 4).toString('hex')).toBe('504b0304')],
    [
      'Export rows (CSV)',
      '.csv',
      (b: Buffer) => {
        const text = b.toString('utf8');
        expect(text).toMatch(/^# LCAPIX assessment run \d+/);
        expect(text).toContain('# Method: TRACI 2.1');
        expect(text).toMatch(/\nstep,life_cycle_stage,substance,direction,amount_entered,unit_entered/);
        expect(text).toContain('10. Cut blank');
      },
    ],
  ] as const) {
    test(`${label} downloads a ${ext} file`, async ({ page, seed }) => {
      await open(page, `/project/${seed.example.projectId}/case/${seed.example.baseCaseId}/results`, {
        ready: 'TOTAL IMPACT',
      });
      // Building the file (and compiling the export route, if next dev evicted it) can pass 20 s under load.
      const download = page.waitForEvent('download', { timeout: 90_000 });
      const response = page.waitForResponse((r) => r.url().includes('/export?format='), { timeout: 90_000 });
      await page.getByRole('button', { name: label, exact: true }).click();
      expect((await response).status()).toBe(200);
      const file = await download;
      expect(file.suggestedFilename()).toMatch(new RegExp(`^LCAPIX_.+\\${ext}$`));
      check(readFileSync((await file.path())!));
    });
  }
});
