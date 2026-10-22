/**
 * Paths and ports for the browser suite. serve.mjs (plain Node) keeps its own
 * copy of PORT, ARTIFACTS_DIR, STATE_DIR and DB_PREFIX: change them in both places.
 */
import os from 'node:os';
import path from 'node:path';

export const E2E_DIR = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(E2E_DIR, '..', '..');

export const PORT = Number(process.env.E2E_PORT || 3120);
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * Everything a run writes (state, test results, traces, the HTML report) lives
 * OUTSIDE the repo. Tailwind v4 watches the whole project tree, so a file
 * written anywhere in it makes `next dev` rebuild and every open page refetch
 * itself mid-test. E2E_ARTIFACTS_DIR overrides the location (CI uploads it).
 */
export const ARTIFACTS_DIR = process.env.E2E_ARTIFACTS_DIR || path.join(os.tmpdir(), `lcapix-e2e-${PORT}`);

/** Run-time state: DB name, seeded ids, storage states. */
export const STATE_DIR = path.join(ARTIFACTS_DIR, 'state');
export const SERVER_STATE = path.join(STATE_DIR, 'server.json');
export const SEED_STATE = path.join(STATE_DIR, 'seed.json');

/** Google Fonts responses, cached so runs are offline and identical. Committed. */
export const FONT_CACHE_DIR = path.join(E2E_DIR, 'fixtures', 'font-cache');

/** Every database this suite builds is named lcapix_t_e2e_<time36>_<hex>. */
export const DB_PREFIX = 'lcapix_t_e2e_';
