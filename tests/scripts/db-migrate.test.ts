/**
 * scripts/db/migrate.mjs — the migration runner (audit 2026-09-29 §5).
 * Pure helpers are tested directly; the host policy is tested by running the
 * CLI against a non-local host name, which it must refuse before it runs any
 * mysql command (nothing is contacted).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listMigrations,
  isLocalHost,
  planMigrations,
  baselineCandidates,
  sha256,
  parseArgs,
} from '../../scripts/db/migrate.mjs';

const SCRIPT = path.resolve(__dirname, '../../scripts/db/migrate.mjs');

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'lcapix-migrate-test-'));
  for (const f of [
    'migrate-010-b.sql',
    'migrate-009-a.sql',
    'migrate-025-z.sql',
    'migrate-028-wood.sql',
    'migrate-add-driver-columns.sql', // unnumbered: not managed
    'README.md',
  ]) {
    writeFileSync(path.join(dir, f), `-- ${f}\nSELECT 1;\n`);
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('listMigrations', () => {
  it('returns numbered migrate-0NN-*.sql files in numeric order and ignores the rest', () => {
    const files = listMigrations(dir);
    expect(files.map((f: { filename: string }) => f.filename)).toEqual([
      'migrate-009-a.sql',
      'migrate-010-b.sql',
      'migrate-025-z.sql',
      'migrate-028-wood.sql',
    ]);
    expect(files[0].number).toBe(9);
    expect(files[0].checksum).toBe(sha256('-- migrate-009-a.sql\nSELECT 1;\n'));
  });

  it('refuses two files with the same number', () => {
    const d = mkdtempSync(path.join(tmpdir(), 'lcapix-migrate-dup-'));
    writeFileSync(path.join(d, 'migrate-026-a.sql'), 'SELECT 1;');
    writeFileSync(path.join(d, 'migrate-026-b.sql'), 'SELECT 2;');
    expect(() => listMigrations(d)).toThrow(/026/);
    rmSync(d, { recursive: true, force: true });
  });
});

describe('isLocalHost', () => {
  it.each(['127.0.0.1', 'localhost', 'LOCALHOST', '::1', '[::1]', ' 127.0.0.1 '])('%s is local', (h) => {
    expect(isLocalHost(h)).toBe(true);
  });
  it.each(['prod-db.example.invalid', '10.0.0.5', '127.0.0.2', 'localhost.evil.com', ''])(
    '%s is not local',
    (h) => {
      expect(isLocalHost(h)).toBe(false);
    },
  );
});

describe('planMigrations', () => {
  it('skips applied files, lists pending in order, and flags applied files whose checksum changed', () => {
    const files = listMigrations(dir);
    const ledger = new Map([
      ['migrate-009-a.sql', files[0].checksum],
      ['migrate-010-b.sql', 'stale-checksum'],
    ]);
    const plan = planMigrations(files, ledger);
    expect(plan.pending.map((f: { filename: string }) => f.filename)).toEqual(['migrate-025-z.sql', 'migrate-028-wood.sql']);
    expect(plan.changed.map((f: { filename: string }) => f.filename)).toEqual(['migrate-010-b.sql']);
    expect(plan.applied).toHaveLength(2);
  });
});

describe('baselineCandidates', () => {
  it('marks only 009 through 025 by default, and only those not yet recorded', () => {
    const files = listMigrations(dir);
    const got = baselineCandidates(files, new Map([['migrate-010-b.sql', 'x']]));
    expect(got.map((f: { filename: string }) => f.filename)).toEqual(['migrate-009-a.sql', 'migrate-025-z.sql']);
  });
});

describe('parseArgs', () => {
  it('reads the flags', () => {
    expect(parseArgs(['--baseline', '--dry-run'])).toMatchObject({ baseline: true, dryRun: true, allowRemote: false });
    expect(parseArgs(['--allow-remote', '--dir=/x'])).toMatchObject({ allowRemote: true, dir: '/x' });
  });
  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--force'])).toThrow(/--force/);
  });
});

describe('CLI host policy', () => {
  // Next.js types NODE_ENV as required on ProcessEnv; a child env is a plain map.
  const env = {
    PATH: process.env.PATH ?? '',
    DATABASE_HOST: 'prod-db.example.invalid',
    DATABASE_NAME: 'lca_v3',
    DATABASE_USER: 'nobody',
  } as unknown as NodeJS.ProcessEnv;

  it('refuses a non-local host without --allow-remote, before running anything', () => {
    const r = spawnSync(process.execPath, [SCRIPT, `--dir=${dir}`], { env, encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/refusing/i);
    expect(r.stderr).toContain('--allow-remote');
  });

  it('refuses --allow-remote when there is no terminal to confirm on', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--allow-remote', `--dir=${dir}`], {
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/interactive/i);
  });

  it('refuses when DATABASE_NAME is missing', () => {
    const r = spawnSync(process.execPath, [SCRIPT, `--dir=${dir}`], {
      env: { PATH: env.PATH, DATABASE_HOST: '127.0.0.1' } as unknown as NodeJS.ProcessEnv,
      encoding: 'utf8',
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('DATABASE_NAME');
  });
});
