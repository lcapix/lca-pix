/**
 * The shell, the command palette, and Magic Insights. Log out (G72, G120)
 * is exercised by the auth journey. The admin Integrations item (G114) is
 * checked with the admin screen.
 */
import { storagePath, test } from '../support/fixtures';
import { row } from '../support/parity';
import { open } from '../support/ui';

test.describe('shell', () => {
  test.use({ storageState: storagePath('owner') });

  test('G111 G112 G113 G122 P136 the sidebar', async ({ page, seed }) => {
    await open(page, `/project/${seed.fiveTier.projectId}`, { ready: seed.fiveTier.projectName });
    const nav = page.getByRole('navigation', { name: 'Main' });
    await row(nav.getByRole('link', { name: /LCAPIX/ }), 'G111', 'Logo -> /home');
    await row(nav.getByRole('link', { name: 'Home', exact: true }), 'G112', 'Projects -> /home');
    await row(nav.getByRole('link', { name: 'All projects' }), 'G112', 'Projects -> /home');
    await row(nav.getByRole('link', { name: 'Help' }), 'G113', 'Docs -> /guide');
    await row(nav.getByText('Recent', { exact: true }), 'G122', 'Recent projects shortcut');
    await row(nav.getByRole('link', { name: /Painted steel bracket/ }), 'G122', 'Recent projects shortcut');
    await page.getByRole('button', { name: /^Account menu/ }).click();
    await row(page.getByRole('menuitem', { name: 'Profile' }), 'P136', 'Docs, profile, Integrations, logout');
    await row(page.getByRole('menuitem', { name: 'Log out' }), 'P136', 'Docs, profile, Integrations, logout');
  });

  test('G130 /results opens the Results tab', async ({ page, seed }) => {
    await page.goto(`/project/${seed.example.projectId}/case/${seed.example.baseCaseId}/results`);
    await page.waitForURL(/tab=results/, { timeout: 90_000 });
    await row(page.getByRole('tab', { name: /^Results/ }), 'G130', '/project/[id]/case/[caseId]/results');
  });

  test('G76 G131 G132 G133 G134 G135 G136 the command palette', async ({ page }) => {
    await open(page, '/home', { ready: /Welcome/ });
    await page.keyboard.press('Control+k');
    await row(page.getByRole('dialog', { name: /Command Palette/ }), 'G131', 'Open with ⌘K / Ctrl+K');
    const palette = page.getByRole('dialog', { name: /Command Palette/ });
    await row(palette.getByText('Home', { exact: true }), 'G132', 'Home');
    await row(palette.getByText('Projects', { exact: true }), 'G133', 'Projects');
    await row(palette.getByText('Admin', { exact: true }), 'G134', 'Admin');
    await row(palette.getByText('Admin', { exact: true }), 'G76', 'Palette "Admin" (all users)');
    await row(palette.getByText('About', { exact: true }), 'G135', 'About');
    await row(palette.getByText('Guide', { exact: true }), 'G136', 'Guide');
  });

  test('G140 G141 G143 G145 Magic Insights from the case', async ({ page, seed }) => {
    test.setTimeout(180_000);
    const base = `/project/${seed.example.projectId}/case/${seed.example.baseCaseId}`;
    await open(page, base, { ready: 'Tree' });
    await row(page.getByRole('button', { name: 'Magic Insights' }).first(), 'G141', 'Next-steps "See what drives it"');
    await page.goto(`${base}?tab=results`);
    const onResults = page.getByRole('complementary', { name: /^Results/ }).getByRole('button', { name: 'Magic Insights' });
    await row(onResults, 'G140', 'Results header button, pulses after a run');
    await onResults.click();
    await row(page.getByText(/Computed by LCAPIX/), 'G143', 'AI narration');
    await row(page.getByRole('link', { name: 'Open editor' }), 'G145', 'Footer: provenance, Open case editor, Close');
    await row(page.getByRole('button', { name: 'Got it' }), 'G145', 'Footer: provenance, Open case editor, Close');
  });
});
