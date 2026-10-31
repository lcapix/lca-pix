/**
 * E21, the case's own documents read beside the tree (the classic reference
 * pane, rebuilt in the case workspace): open Documents, add a file that is
 * already in the repo's fixtures, open it, search inside it, delete it. A
 * person who can only read the case sees the documents and the samples but
 * no add or delete.
 */
import path from 'node:path';
import { openCase, workedExample } from '../support/editor';
import { expect, storagePath, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { E2E_DIR } from '../support/paths';
import { open } from '../support/ui';

const ROUTING = path.join(E2E_DIR, 'fixtures', 'import', 'small-routing.csv');

test('E21 add a document to a case, read it, search it, delete it', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-docs');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);

  // Closed until asked for.
  const toggle = page.getByRole('button', { name: 'Documents', exact: true });
  await row(toggle, 'E21', 'Documents button in the case workspace');
  await expect.soft(page.getByRole('complementary', { name: 'Documents' }), note('E21', 'closed by default')).toHaveCount(0);
  await toggle.click();
  const docs = page.getByRole('complementary', { name: 'Documents' });
  await row(docs, 'E21', 'Documents panel beside the tree');
  await row(docs.getByRole('button', { name: 'Open the sample sample-routing.csv' }), 'E21', 'Bundled samples listed');
  await row(docs.getByText('No document is kept for this case yet.', { exact: false }), 'E21', 'Empty list said in words');

  // Add a routing.
  await docs.getByLabel('Document type').selectOption('routing');
  await docs.getByLabel('File to add').setInputFiles(ROUTING);
  await docs.getByRole('button', { name: 'Add document' }).click();
  await row(docs.getByText('Added small-routing.csv'), 'E21', 'Upload with a document type');
  const openIt = docs.getByRole('button', { name: 'Open small-routing.csv, Routing' });
  await row(openIt, 'E21', 'Listed with its name and type');

  // Read it and search inside it.
  await openIt.click();
  const text = docs.getByRole('region', { name: 'Text of small-routing.csv' });
  await row(text.getByText('TIG weld cell', { exact: false }), 'E21', 'Open and read a document');
  await docs.getByRole('searchbox', { name: 'Search this document' }).fill('weld');
  await row(docs.getByText('1 line matches'), 'E21', 'Search inside the text');
  await expect.soft(text.locator('.ws-docs-line'), note('E21', 'only the matching line')).toHaveCount(1);
  await expect.soft(text.locator('mark').first(), note('E21', 'the match is marked')).toHaveText(/weld/i);
  await docs.getByRole('searchbox', { name: 'Search this document' }).fill('oven');
  await row(docs.getByText('No line matches'), 'E21', 'Search inside the text');
  await docs.getByRole('button', { name: 'All documents' }).click();

  // Delete it, after a confirm.
  await docs.getByRole('button', { name: 'Delete small-routing.csv' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete this document?' });
  await row(confirm, 'E21', 'Delete asks first');
  await confirm.getByRole('button', { name: 'Delete document' }).click();
  await expect(confirm).toHaveCount(0);
  await expect.soft(openIt, note('E21', 'deleted from the list')).toHaveCount(0);
  await row(docs.getByText('No document is kept for this case yet.', { exact: false }), 'E21', 'Delete a document');

  // The server agrees.
  const left = await api.as(user.token).get<{ documents: unknown[] }>(`/api/cases/${caseId}/documents`);
  expect.soft(left.documents, note('E21', 'the document is gone on the server')).toHaveLength(0);

  // Close puts focus back on the button.
  await docs.getByRole('button', { name: 'Close documents' }).click();
  await expect(docs).toHaveCount(0);
  await expect.soft(toggle, note('E21', 'focus returns to Documents')).toBeFocused();
});

test.describe('read only', () => {
  test.use({ storageState: storagePath('viewer') });

  test('E21 a viewer reads the documents but cannot add or delete one', async ({ page, seed }) => {
    await open(page, `/project/${seed.example.projectId}/case/${seed.example.baseCaseId}`);
    await expect(page.getByRole('tree')).toBeVisible();
    await page.getByRole('button', { name: 'Documents', exact: true }).click();
    const docs = page.getByRole('complementary', { name: 'Documents' });
    await row(docs.getByRole('button', { name: 'Open the sample sample-bom.csv' }), 'E21', 'Bundled samples listed');
    await expect.soft(docs.getByRole('heading', { name: 'Add a document' }), note('E21', 'no add when read-only')).toHaveCount(0);
    await expect.soft(docs.getByLabel('File to add'), note('E21', 'no file box when read-only')).toHaveCount(0);
    await expect.soft(docs.getByRole('button', { name: /^Delete / }), note('E21', 'no delete when read-only')).toHaveCount(0);
  });
});
