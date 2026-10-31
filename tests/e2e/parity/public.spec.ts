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

  test('G151 docs: where the data comes from, only the sources the app calls, each with where it appears', async ({ page }) => {
    await open(page, '/docs', { ready: 'Everything you need to ship a defensible LCA.' });
    await row(page.getByRole('heading', { name: 'Where the data comes from', level: 2 }), 'G151', 'the data sources section');
    const list = page.getByRole('list', { name: 'Data sources' });
    const names = await list.getByRole('listitem').locator('strong').allInnerTexts();
    expect.soft(names, note('G151', 'the sources, in order')).toEqual(['BLS', 'EIA', 'Metals-API', 'openLCA', 'PubChem', 'Factor sources']);
    for (const [name, where] of [
      ['BLS', "A step's Cost view: Labor"],
      ['EIA', "A step's Cost view: Energy"],
      ['Metals-API', "A step's Cost view: Material"],
      ['openLCA', 'Integrations page'],
      ['PubChem', 'Integrations page'],
    ]) {
      const item = list.getByRole('listitem').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });
      await expect.soft(item, note('G151', `${name}: where it appears`)).toContainText(where);
    }
    const factors = list.getByRole('listitem').filter({ hasText: 'Factor sources' });
    for (const src of ['TRACI 2.1', 'lciafmt', 'CML 2001', 'eGRID', 'worldsteel']) {
      await expect.soft(factors, note('G151', `factor source ${src}`)).toContainText(src);
    }
    // Nothing the app does not call.
    await expect.soft(page.locator('main'), note('G151', 'no Electricity Maps')).not.toContainText('Electricity Maps');
    for (const [name, href] of [
      ['How the data fits together', '/guide/data-model'],
      ['API reference', '/guide/api-reference'],
      ['Factor library', '/library/factors'],
    ]) {
      await expect.soft(page.getByRole('link', { name, exact: true }).last(), note('G151', `${name} link`)).toHaveAttribute('href', href);
    }
  });

  test('G121 signed out, the guide reads in the public layout, so the links from Docs work', async ({ page }) => {
    await open(page, '/guide/first-assessment', { ready: 'Your first assessment' });
    await expect.soft(page, note('G121', 'no sign-in wall')).toHaveURL(/\/guide\/first-assessment$/);
    await row(page.getByRole('navigation', { name: 'Site' }), 'G121', 'the landing header on the guide');
    await expect.soft(page.getByRole('navigation', { name: 'Main' }), note('G121', 'no app sidebar signed out')).toHaveCount(0);
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
    // The tour is unmounted on project routes (G04, G115); its component is deleted, which
    // tests/lib/no-classic.test.ts proves. Here: nothing tour-like opens on a project.
    await page.evaluate(() => sessionStorage.setItem('lcapix:start-tour', '1'));
    await open(page, `/project/${seed.fiveTier.projectId}`, { ready: seed.fiveTier.projectName });
    await expect.soft(page.getByRole('dialog', { name: /tour/i }), note('G115', 'no tour opens on a project')).toHaveCount(0);
  });
});
