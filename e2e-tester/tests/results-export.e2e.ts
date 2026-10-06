/**
 * F10 export: the results page's PDF, PPTX and CSV downloads.
 * docs/flows/USER_FLOWS.md §F10 (same checks as tests/e2e/journeys/results.spec.ts "F10 export").
 */
import { readFileSync } from 'node:fs';
import { workedExample } from '../support/api.ts';
import { downloadedFile } from '../support/downloads.ts';
import { expect, test } from '../support/fixtures.ts';

const formats = [
  ['Export PDF', '.pdf', (b: Buffer) => expect(b.subarray(0, 5).toString('latin1')).toBe('%PDF-')],
  // A .pptx is a zip: it starts with PK\x03\x04.
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
] as const;

for (const [label, ext, check] of formats) {
  test(`${label} downloads a ${ext} file`, async ({ screen, browser, api, newUser, signIn }) => {
    const user = await newUser(`export-${ext.slice(1)}`);
    const { projectId, caseId } = await workedExample(api, user);
    await api.as(user.token).post(`/api/cases/${caseId}/assessments`, { run_name: 'Assessment' });
    await signIn(user, `/project/${projectId}/case/${caseId}/results`);
    await expect(screen.getByText('TOTAL IMPACT · GLOBAL WARMING')).toBeVisible({ timeout: 60_000 });

    const file = await browser.waitForDownload(() => screen.getByRole('button', label).tap(), { timeout: 90_000 });
    expect(file.suggestedFilename).toMatch(new RegExp(`^LCAPIX_.+\\${ext}$`));
    check(readFileSync(downloadedFile(file.path)));
  });
}
