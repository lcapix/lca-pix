/**
 * Owner decision (2026-09-30): a caller who is not a member of the project
 * gets 404 for any project, case, component, flow, run, comparison or
 * document id, with the SAME body the route sends when the id does not exist,
 * so ids reveal nothing. A member whose role is too low gets 403.
 *
 * Routes marked `pending404` belong to files another agent is editing; the
 * report lists the one-line change each needs. Their tests use `it.fails`:
 * flip them to `it` once that change lands.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';
import { PROJECT_ROUTES, contextFor, requestFor, type RouteCase } from './route-table';

const conn = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/db', () => ({
  default: { getConnection: async () => conn },
  getPool: vi.fn(),
  closePool: vi.fn(),
}));

const CALLER = 4;
// What every lookup finds when the resource exists: it lives in project 7,
// owned by someone else (user 99).
const ROW = {
  project_id: 7, case_id: 3, owner_id: 99, component_id: 5, flow_id: 6, run_id: 8,
  case_name: 'Base', component_name: 'Weld', component_type: 'operation',
  parent_component_id: null, hierarchy_level: 4, created_by: 99, comparison_id: 1, case_ids: '[3,4]',
};

type World = 'missing' | 'nonMember' | 'viewer';

function world(kind: World) {
  vi.mocked(auth.requireAuth).mockResolvedValue(CALLER);
  if (kind === 'viewer') {
    vi.mocked(auth.checkProjectAccess).mockImplementation(async (_u, _p, level) => !level || level === 'viewer');
  } else {
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);
  }
  vi.mocked(db.queryOne).mockResolvedValue((kind === 'missing' ? null : ROW) as any);
  vi.mocked(db.query).mockResolvedValue([] as any);
  vi.mocked(db.exists).mockResolvedValue(false);
  vi.mocked(db.execute).mockResolvedValue(0);
  vi.mocked(db.insert).mockResolvedValue(0);
  vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb({ query: vi.fn(async () => [[], []]) }));
  // Legacy comparison routes run inline SQL on a pool connection.
  conn.query.mockImplementation(async (sql: string) => {
    if (kind === 'missing') return [[]];
    if (/FROM comparison_runs/.test(sql)) return [[{ ...ROW }]];
    if (kind === 'viewer' && !/permission_name = 'admin'/.test(sql)) return [[{ project_id: 7 }]];
    return [[]];
  });
}

async function call(rc: RouteCase, kind: World) {
  world(kind);
  const handler = await rc.load();
  const res = await handler(requestFor(rc, 'x') as any, contextFor(rc.params) as any);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body };
}

beforeEach(() => {
  vi.resetAllMocks();
  setRateLimitStore(new MemoryRateLimitStore());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('a non-member gets 404, identical to a missing id', () => {
  for (const rc of PROJECT_ROUTES) {
    const test = rc.pending404 ? it.fails : it;
    const label = rc.pending404 ? `${rc.name} [pending: other agent's file]` : rc.name;
    test(label, async () => {
      const missing = await call(rc, 'missing');
      const hidden = await call(rc, 'nonMember');
      expect(hidden.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(hidden.body).toEqual(missing.body);
      expect(hidden.body).toEqual({ error: rc.notFound });
    });
  }
});

describe('a member whose role is too low gets 403', () => {
  for (const rc of PROJECT_ROUTES.filter((r) => r.level)) {
    it(`${rc.name} as a viewer (needs ${rc.level})`, async () => {
      const { status, body } = await call(rc, 'viewer');
      expect(status).toBe(403);
      expect(typeof body?.error).toBe('string');
    });
  }
});
