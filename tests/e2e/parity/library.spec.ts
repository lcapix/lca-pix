/**
 * Factor and substance libraries, plus adding a substance from the flow form
 * (G55), which was never a control on the catalog page.
 */
import { workedExample, openCase } from '../support/editor';
import { storagePath, test } from '../support/fixtures';
import { row } from '../support/parity';
import { open } from '../support/ui';

test.describe('libraries', () => {
  test.use({ storageState: storagePath('owner') });

  test('G33 G34 G35 G36 G37 G39 G40 G42 G43 the factor library', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, '/library/factors', { ready: 'Factor library' });
    await row(page.getByRole('navigation', { name: 'Main' }), 'G33', 'Page chrome');
    await row(page.getByRole('button', { name: 'Back to home' }), 'G34', 'Back to home');
    await row(page.getByText(/impact factors across/), 'G35', 'Header: N factors across M methods');
    await row(page.getByText(/damage one unit of a substance/), 'G36', 'Explainer');
    await row(page.getByRole('button', { name: /TRACI 2\.1|CML 2001/ }).first(), 'G37', 'Filter by method chips');
    await row(page.getByPlaceholder('Search by substance, method, region, or source…'), 'G39', 'Search substance/method/region/source/category');
    await row(page.getByRole('columnheader', { name: 'Source' }), 'G40', 'Table with Source column (factor sources)');
    await row(page.getByText(/Showing first 200 of/), 'G42', '200-row cap notice');

    await page.route(/\/api\/driver-factors/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"no"}' }));
    await page.reload();
    await row(page.getByText(/Couldn't load the factor library/), 'G43', 'Error state');
  });

  test('G46 G47 G48 G49 G50 G51 G52 G53 G54 the substance library', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, '/library/substances', { ready: 'Substance' });
    await row(page.getByRole('navigation', { name: 'Main' }), 'G46', 'Page chrome');
    await row(page.getByRole('button', { name: 'Back to home' }), 'G47', 'Back to home');
    await row(page.getByText(/substances across/), 'G48', 'Header counts');
    await row(page.getByText(/CAS numbers/), 'G49', 'Explainer');
    await row(page.getByText(/Showing first 200 of/), 'G54', '200-row cap');
    await page.getByRole('button', { name: /Waste streams/ }).click();
    await row(page.getByRole('button', { name: 'Clear filter' }), 'G52', 'Clear filter');
    await row(page.getByRole('button', { name: /Waste streams/ }), 'G50', 'Category cards filter');
    await row(page.getByPlaceholder('Search by name, CAS number, or category…'), 'G51', 'Search name/CAS/category');
    await row(page.getByRole('columnheader', { name: 'CAS' }), 'G53', 'Table substance/CAS/category/unit');
  });
});

test('G55 add a substance from the flow form', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-substance');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await page.getByRole('treeitem', { name: /^20\. Weld tab, / }).click();
  await page.getByRole('button', { name: '+ Add a flow to this step' }).click();
  await row(page.getByRole('button', { name: 'Not in the list? Add a substance' }), 'G55', 'Add custom substance');
});
