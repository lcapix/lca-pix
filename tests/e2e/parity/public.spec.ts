/**
 * Task 9 (group G): the public pages wear the landing's header and footer,
 * signed in or out; the guide sits inside the app's shell (G121); and the
 * dropped bell and tour are gone (G117, G04, G115). Every row's test title
 * starts with its ID.
 */
import { expect, test } from '../support/fixtures';
import { storagePath } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

const PUBLIC: Array<[string, string | RegExp]> = [
  ['/about', 'What is LCAPIX?'],
  ['/docs', 'Everything you need to ship a defensible LCA.'],
  ['/changelog', "What's new in LCAPIX."],
  ['/pricing', 'Free to model. Pay when you need live data.'],
  ['/product', 'Six capabilities. One browser tab.'],
  ['/legal/privacy', 'Privacy policy'],
  ['/legal/terms', 'Terms of service'],
  ['/legal/security', 'Security'],
];

test.describe('signed out', () => {
  test.use({ storageState: storagePath('anon') });

  test('G117 public pages: the landing header and footer, no sign-in wall, no bell', async ({ page }) => {
    test.setTimeout(240_000);
    for (const [path, heading] of PUBLIC) {
      await open(page, path, { ready: heading });
      await expect.soft(page, note('G117', `${path} stays open signed out`)).toHaveURL(new RegExp(`${path}$`));
      await row(page.getByRole('navigation', { name: 'Site' }), 'G117', `${path}: the landing header`);
      await row(page.getByRole('navigation', { name: 'Legal' }), 'G117', `${path}: the landing footer`);
      await expect.soft(page.getByRole('button', { name: /Notifications/ }), note('G117', `${path}: no bell`)).toHaveCount(0);
      await expect.soft(page.getByRole('navigation', { name: 'Main' }), note('G117', `${path}: no app sidebar`)).toHaveCount(0);
    }
  });

  test('G121 the guide asks a signed-out reader to log in', async ({ page }) => {
    await page.goto('/guide');
    await page.waitForURL(/\/auth\/login/, { timeout: 60_000 });
    await row(page.getByRole('button', { name: 'Log in', exact: true }), 'G121', 'The guide needs an account, as before');
  });
});

test.describe('signed in', () => {
  test.use({ storageState: storagePath('owner') });

  test('G121 G04 G115 signed in, the guide sits in the shell: one nav, every guide page, no tour', async ({ page, seed }) => {
    test.setTimeout(180_000);
    await open(page, '/guide', { ready: 'Getting started' });
    await row(page.getByRole('navigation', { name: 'Main' }), 'G121', 'One nav on every signed-in page');
    await expect.soft(page.getByRole('navigation', { name: 'Site' }), note('G121', 'no second, public header')).toHaveCount(0);
    await expect.soft(page.getByRole('button', { name: /Notifications/ }), note('G117', 'no bell on the guide')).toHaveCount(0);
    for (const [name, heading] of [
      ['Data model', 'Data model'],
      ['First assessment', 'Your first assessment'],
      ['Glossary', 'Glossary'],
      ['FAQ', 'FAQ'],
      ['API reference', 'API reference'],
    ]) {
      await page.getByRole('link', { name, exact: true }).click();
      await row(page.getByRole('heading', { name: heading, level: 1 }), 'G121', `Guide: ${name} opens in the shell`);
      await expect.soft(page.getByRole('navigation', { name: 'Main' }), note('G121', `${name}: still one nav`)).toHaveCount(1);
    }
    // The guide names no control that is gone: no drag, no R or E key, no is_driver flag.
    await open(page, '/guide/first-assessment', { ready: 'Your first assessment' });
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const gone of ['drag', 'is_driver', 'press r', 'clone / remove', 'historical runs']) {
      expect.soft(text.includes(gone), note('G121', `guide text does not say "${gone}"`)).toBe(false);
    }
    // The tour is unmounted on project routes (G04, G115).
    await page.evaluate(() => sessionStorage.setItem('lcapix:start-tour', '1'));
    await open(page, `/project/${seed.fiveTier.projectId}`, { ready: seed.fiveTier.projectName });
    await expect.soft(page.getByRole('dialog', { name: /tour/i }), note('G115', 'no tour opens on a project')).toHaveCount(0);
  });
});
