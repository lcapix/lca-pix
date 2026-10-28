/**
 * Kept and moved rows of Home. Opening the sample (G29) is exercised by the
 * worked-example journey.
 */
import { storagePath, test } from '../support/fixtures';
import { row } from '../support/parity';
import { open } from '../support/ui';

test.describe('home with projects', () => {
  test.use({ storageState: storagePath('owner') });

  test('G01 G03 G05 G14 G17 G25 G26 home lists your projects, then a load and a failure', async ({ page, seed }) => {
    test.setTimeout(180_000);

    let release: () => void = () => {};
    const hold = new Promise<void>((r) => {
      release = r;
    });
    await page.route(/\/api\/projects(\?|$)/, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await hold;
      await route.fallback();
    });
    const opening = page.goto('/home');
    await row(page.getByText('Loading your projects…'), 'G26', 'Loading state');
    release();
    await opening;
    await page.unroute(/\/api\/projects(\?|$)/);
    await open(page, '/home', { ready: /Welcome back/ });

    await row(page.getByRole('heading', { name: /Welcome back, Olivia/ }), 'G01', 'Dashboard at /home');
    await row(page.getByText(/of yours|shared with you|the sample/), 'G03', 'Greeting + project count line');
    await row(page.getByRole('link', { name: 'New project' }).first(), 'G05', 'New project');
    await row(page.getByRole('link', { name: new RegExp(seed.fiveTier.projectName) }).first(), 'G14', 'Open project');
    await row(page.getByText('1 case · just you'), 'G17', 'Card: case count');

    await page.route(/\/api\/projects(\?|$)/, (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"no"}' });
      return route.continue();
    });
    await page.reload();
    await row(page.getByRole('button', { name: 'Try again' }), 'G25', 'Load error + Retry');
  });
});

test.describe('home with nothing yet', () => {
  test.use({ storageState: storagePath('empty') });

  test('G28 an empty home offers a first project', async ({ page }) => {
    await open(page, '/home', { ready: 'Welcome to LCAPIX' });
    await row(page.getByRole('button', { name: 'New project' }).first(), 'G28', 'Empty: create first project');
  });
});
