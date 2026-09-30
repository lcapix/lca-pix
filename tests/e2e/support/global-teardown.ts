/**
 * Drops the run's database. serve.mjs drops it too when Playwright stops the
 * webServer; doing it here as well means a server that is killed outright
 * still leaves nothing behind. E2E_KEEP_DB=1 keeps it for inspection.
 *
 * fresh.mjs runs as a child process: Playwright's TypeScript loader cannot
 * import an .mjs file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ARTIFACTS_DIR, E2E_DIR, REPO_ROOT, SERVER_STATE } from './paths';

type Rules = Record<string, { impact: string; count: number }>;

/**
 * pnpm e2e:a11y:update: fold this run's per-screen axe results into
 * tests/e2e/a11y/baseline.json (screens not run this time keep their entry),
 * and print the rules with the most violations.
 */
function mergeA11yBaseline(): void {
  const dir = path.join(ARTIFACTS_DIR, 'a11y');
  if (!existsSync(dir)) return;
  const file = path.join(E2E_DIR, 'a11y', 'baseline.json');
  const previous = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { screens: Record<string, Rules> }) : { screens: {} };
  // Several passes of the same screen: keep the highest count per rule.
  const fresh: Record<string, Rules> = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { slug: string; rules: Rules };
    const into = (fresh[r.slug] ??= {});
    for (const [rule, v] of Object.entries(r.rules)) {
      if (!into[rule] || into[rule].count < v.count) into[rule] = v;
    }
  }
  const screens: Record<string, Rules> = { ...previous.screens };
  for (const [slug, rules] of Object.entries(fresh)) {
    screens[slug] = Object.fromEntries(Object.entries(rules).sort(([a], [b]) => a.localeCompare(b)));
  }
  const sorted = Object.fromEntries(Object.entries(screens).sort(([a], [b]) => a.localeCompare(b)));
  const totals: Record<string, { impact: string; count: number; screens: number }> = {};
  for (const rules of Object.values(sorted)) {
    for (const [rule, v] of Object.entries(rules)) {
      totals[rule] ??= { impact: v.impact, count: 0, screens: 0 };
      totals[rule].count += v.count;
      totals[rule].screens += 1;
    }
  }
  const byRule = Object.fromEntries(Object.entries(totals).sort(([, a], [, b]) => b.count - a.count));
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        _comment: 'axe-core violations per screen and rule (element counts). Written by pnpm e2e:a11y:update; tests fail only when a count rises. See tests/e2e/a11y/routes.spec.ts.',
        totals: byRule,
        screens: sorted,
      },
      null,
      2,
    )}\n`,
  );
  process.stderr.write(`[e2e a11y] baseline.json: ${Object.keys(sorted).length} screens. Top rules:\n`);
  for (const [rule, v] of Object.entries(byRule).slice(0, 10)) {
    process.stderr.write(`  ${String(v.count).padStart(5)}  ${rule} (${v.impact}) on ${v.screens} screen(s)\n`);
  }
}

export default async function globalTeardown() {
  if (process.env.A11Y_UPDATE_BASELINE === '1') mergeA11yBaseline();
  // E2E_REUSE=1: the server (and its database) belong to whoever started it.
  if (process.env.E2E_KEEP_DB === '1' || process.env.E2E_REUSE === '1' || !existsSync(SERVER_STATE)) return;
  const envFile = path.join(REPO_ROOT, '.env.local');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const { database } = JSON.parse(readFileSync(SERVER_STATE, 'utf8')) as { database: string };
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'db', 'fresh.mjs'), '--drop', database], {
    env: process.env,
    encoding: 'utf8',
  });
  if (r.status !== 0) process.stderr.write(`[e2e teardown] could not drop ${database}: ${r.stderr}\n`);
}
