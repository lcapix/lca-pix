/**
 * Kept and moved rows of import. The pick form, case name, save and the done
 * card (P92, P94, P95, P96) are exercised by the import journey.
 */
import path from 'node:path';
import { test } from '../support/fixtures';
import { E2E_DIR } from '../support/paths';
import { row } from '../support/parity';
import { open } from '../support/ui';

const BOM = path.join(E2E_DIR, 'fixtures', 'import', 'small-bom.csv');
const NAV = { timeout: 90_000 };

test('I01 P89 P91 P93 P97 P98 matches, a name clash, the status card, append, the sample and a failed read', async ({
  api,
  newUser,
  signIn,
  seed,
}) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-import');
  const as = api.as(user.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Parity import', description: 'Import checks' }))
    .project.project_id;
  const base = (
    await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, {
      case_name: 'Base case',
      case_type: 'base',
      description: 'Already here',
    })
  ).case.case_id;
  await as.post(`/api/cases/${base}/components`, {
    component_name: 'Bracket',
    component_type: 'product',
    parent_component_id: null,
    quantity: 1,
    unit: 'unit',
  });

  const owner = await signIn(seed.users.owner);
  await open(owner.page, `/project/${seed.example.projectId}/import`, { ready: 'What kind of file is it?' });
  await row(owner.page.getByText(/DOCUMENTS & DATA ADDED SO FAR/), 'P91', 'Project status card');
  await owner.context.close();

  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });

  await page.getByRole('button', { name: 'Read the sample file' }).click();
  await row(page.getByRole('dialog'), 'P97', 'Sample dialog (load, download, copy)');
  await page.getByRole('dialog').click({ position: { x: 8, y: 8 } });

  await page.getByRole('radio', { name: 'Bill of materials' }).click();
  await page.getByLabel(/Drop a file here/).setInputFiles(BOM);
  await page.getByLabel('Into').selectOption({ label: 'Base case' });
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /Check what we read/ }).click();
  expectOk(await preview);
  await row(page.getByText(/% match|best \d+%/), 'I01', 'Candidate matches with % score');
  await row(page.getByText(/Place every line on a step first/), 'P93', 'Append banner with unplaced count');

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.route(/\/api\/ingest\/preview/, (route) =>
    route.fulfill({
      status: 415,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unsupported file type', matching_ids: ['WV0661'] }),
    }),
  );
  await page.getByLabel(/Drop a file here/).setInputFiles(BOM);
  await page.getByLabel('Into').selectOption({ label: 'A new case' });
  await page.getByRole('button', { name: /Check what we read/ }).click();
  await row(page.getByText('Matching IDs in this workbook: WV0661'), 'P98', 'Error card with ID hints');
  await page.getByRole('button', { name: 'Start empty instead' }).click();
  await page.waitForURL(new RegExp(`/project/${projectId}/case/${base}$`), NAV);
  await row(page.getByRole('tree'), 'P89', 'Base case name clash (409)');
});

function expectOk(res: { status(): number }) {
  if (res.status() >= 400) throw new Error(`preview answered ${res.status()}`);
}
