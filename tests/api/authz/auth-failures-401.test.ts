/**
 * X-API-2: a validly signed token whose account is deactivated, unknown, or
 * revoked (password hash changed) must get 401 on every route, never 500.
 *
 * The real requireAuth runs here; only the account row is mocked. Routes
 * marked `pending401` belong to files another agent is editing; their tests
 * use `it.fails` until the one-line change in the report lands.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '@/lib/db-helpers';
import { createToken } from '@/lib/auth';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';
import { OTHER_AUTHED_ROUTES, PROJECT_ROUTES, contextFor, requestFor } from './route-table';

const conn = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));

vi.mock('@/lib/db-helpers');
vi.mock('@/lib/db', () => ({
  default: { getConnection: async () => conn },
  getPool: vi.fn(),
  closePool: vi.fn(),
}));

const HASH = '$2b$10$aaaaaaaaaaaaaaaaaaaaaOaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_HASH = '$2b$10$bbbbbbbbbbbbbbbbbbbbbObbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = createToken({ id: 5, email: 'jo@corp.com', account_type: 'admin' }, HASH);

const ACCOUNTS = {
  deactivated: { id: 5, is_active: 0, password_hash: HASH, account_type: 'admin' },
  unknown: null,
  revoked: { id: 5, is_active: 1, password_hash: OTHER_HASH, account_type: 'admin' },
} as const;
type Scenario = keyof typeof ACCOUNTS;

beforeEach(() => {
  vi.resetAllMocks();
  setRateLimitStore(new MemoryRateLimitStore());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  conn.query.mockResolvedValue([[]]);
});

const ALL = [...PROJECT_ROUTES, ...OTHER_AUTHED_ROUTES];

for (const scenario of Object.keys(ACCOUNTS) as Scenario[]) {
  describe(`${scenario} account → 401`, () => {
    for (const rc of ALL) {
      const pending =
        rc.pending401 === 'all' || (rc.pending401 === 'account' && scenario !== 'revoked');
      const test = pending ? it.fails : it;
      test(pending ? `${rc.name} [pending: other agent's file]` : rc.name, async () => {
        vi.mocked(db.queryOne).mockResolvedValue(ACCOUNTS[scenario] as any);
        const handler = await rc.load();
        const res = await handler(requestFor(rc, TOKEN) as any, contextFor(rc.params) as any);
        expect(res.status).toBe(401);
      });
    }
  });
}
