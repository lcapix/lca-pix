/**
 * Every policy in RATE_LIMITS is enforced by some route (or the helper a
 * route calls), as the comment on RATE_LIMITS says. A policy nobody applies
 * is a limit the docs promise and the app does not have; this is how the
 * assessments and PubChem budgets once sat unused.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RATE_LIMITS } from '@/lib/rate-limit';

const ROOT = path.resolve(__dirname, '../..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('RATE_LIMITS wiring', () => {
  const code = [...sources(path.join(ROOT, 'app', 'api')), ...sources(path.join(ROOT, 'lib'))]
    .filter((f) => !f.endsWith(path.join('lib', 'rate-limit.ts')))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  it.each(Object.keys(RATE_LIMITS))('%s is enforced somewhere', (key) => {
    expect(code).toMatch(new RegExp(`enforceRateLimit\\(\\s*RATE_LIMITS\\.${key}\\b`));
  });

  it('the comment on RATE_LIMITS does not call any policy unwired', () => {
    const src = readFileSync(path.join(ROOT, 'lib', 'rate-limit.ts'), 'utf8');
    expect(src).not.toMatch(/for the routes that will adopt them/);
  });
});
