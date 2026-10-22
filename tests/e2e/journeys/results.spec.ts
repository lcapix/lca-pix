/**
 * F9 run → Results, F10 export. docs/flows/USER_FLOWS.md §F9–F10, on the
 * education screens: Results is a tab of the case (E05); exports are on
 * Reports (E11).
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

// The results tab (and below, the export route) can wait on a `next dev`
// compile, which under parallel load takes longer than the 20 s default.
const NAV = { timeout: 90_000 };

test.describe('F9 run an assessment', () => {
  test('run from the case → Results: thousands grouped, a tiny value never shown as 0', async ({ api, newUser, signIn }) => {
    const user = await newUser('results');
    const { projectId, caseId } = await workedExample(api, user);
    // A big number and a tiny one, on the user's own copy: 800 kg of steel
    // (≈1,520 kg CO2 eq) and 1e-6 kWh of electricity on the weld step (3.5e-7 kg).
    const steel = (await flowsOf(api, user, caseId, '10. Cut blank')).find((f) => f.substance_name === 'Steel')!;
    await api.as(user.token).put(`/api/flows/${steel.flow_id}`, { quantity: 800 });
    const weld = (await flowsOf(api, user, caseId, '20. Weld tab')).find((f) => f.substance_name === 'Electricity')!;
    await api.as(user.token).put(`/api/flows/${weld.flow_id}`, { quantity: 0.000001 });

    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    const posted = page.waitForResponse((r) => /\/api\/cases\/\d+\/assessments/.test(r.url()) && r.request().method() === 'POST', NAV);
    await page.getByRole('button', { name: 'Run Assessment', exact: true }).click();
    expect((await posted).status()).toBe(201);
    await expect(page).toHaveURL(/tab=results/, NAV);

    // RES-1: 800 × 1.9 + (0.05 + 0.000001 + 0.4 + 0.0013) × 0.35 = 1,520.158, grouped, three decimals (a copy).
    await expect(page.getByText('What builds this number')).toBeVisible(NAV);
    await expect(page.locator('.ws-answer-num')).toHaveText('1,520.158');

    // RUN-2: a 3.5e-7 contribution reads as "< 0.001", never as 0.
    const weldRow = page.locator('li').filter({ hasText: /^20\. Weld tab/ }).first();
    await expect(weldRow).toContainText('< 0.001');
  });
});

test.describe('F10 export', () => {
  test.use({ storageState: storagePath('owner') });

  for (const [format, ext, check] of [
    ['PDF', '.pdf', (b: Buffer) => expect(b.subarray(0, 5).toString('latin1')).toBe('%PDF-')],
    ['PowerPoint', '.pptx', (b: Buffer) => expect(b.subarray(0, 4).toString('hex')).toBe('504b0304')],
    [
      'CSV',
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
    test(`Reports: Export ${format} downloads a ${ext} file of the run`, async ({ page, seed }) => {
      await open(page, `/reports?project=${seed.example.projectId}&case=${seed.example.baseCaseId}`, { ready: 'Build a report' });
      await expect(page.locator('.rp-paper-top')).toContainText(`Run #${seed.example.baseRunId}`, NAV);
      await page.getByRole('radio', { name: format, exact: true }).click();
      // Building the file (and compiling the export route) can pass 20 s under load.
      const download = page.waitForEvent('download', NAV);
      const response = page.waitForResponse((r) => r.url().includes('/export?format='), NAV);
      await page.getByRole('button', { name: `Export ${format}` }).click();
      expect((await response).status()).toBe(200);
      const file = await download;
      expect(file.suggestedFilename()).toMatch(new RegExp(`^LCAPIX_.+\\${ext}$`));
      check(readFileSync((await file.path())!));
      await expect(page.getByText(new RegExp(`^Exported · ${format} of`))).toBeVisible();
    });
  }
});
