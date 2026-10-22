/**
 * Token revocation, Google takeover and the 404 policy against the LOCAL
 * database (the mocked tests cannot show that the SQL runs on the real
 * schema).
 *
 * Run with:  set -a; source .env.local; set +a; LOCAL_DB=1 npx vitest run tests/e2e-local
 * Creates throwaway accounts and a project, and deletes them afterwards.
 * Google is never contacted: fetch is stubbed for the token and userinfo calls.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const enabled = process.env.LOCAL_DB === '1';
const d = describe.skipIf(!enabled);

const MARK = `rev${Date.now().toString(36)}`;
const APP = 'http://localhost:3999';
let conn: mysql.Connection;
const accountIds: number[] = [];
let projectId = 0;

let auth: typeof import('@/lib/auth');
let projects: typeof import('@/app/api/projects/route');
let project: typeof import('@/app/api/projects/[projectId]/route');
let google: typeof import('@/app/api/auth/google/route');

async function makeAccount(tag: string, hash: string): Promise<{ id: number; email: string; hash: string }> {
  const email = `${MARK}-${tag}@example.com`;
  const [r]: any = await conn.query(
    `INSERT INTO account (username, email, password_hash, account_type, is_active) VALUES (?, ?, ?, 'user', 1)`,
    [`${MARK}-${tag}`, email, hash],
  );
  accountIds.push(r.insertId);
  return { id: r.insertId, email, hash };
}

const bearer = (token: string, url = '/api/projects', init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

const ctx = (id: number) => ({ params: Promise.resolve({ projectId: String(id) }) });

d('auth revocation, Google takeover, 404 policy (local DB)', () => {
  let a: { id: number; email: string; hash: string };
  let b: { id: number; email: string; hash: string };
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    conn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME,
      port: +(process.env.DATABASE_PORT || 3306),
    });
    auth = await import('@/lib/auth');
    projects = await import('@/app/api/projects/route');
    project = await import('@/app/api/projects/[projectId]/route');
    google = await import('@/app/api/auth/google/route');

    a = await makeAccount('a', await bcrypt.hash('alpha-pass-1', 4));
    b = await makeAccount('b', await bcrypt.hash('bravo-pass-1', 4));
    tokenA = auth.createToken({ id: a.id, email: a.email, account_type: 'user' }, a.hash);
    tokenB = auth.createToken({ id: b.id, email: b.email, account_type: 'user' }, b.hash);

    const res = await projects.POST(bearer(tokenA, '/api/projects', { method: 'POST', body: { project_name: `${MARK} project` } }));
    expect(res.status).toBe(201);
    projectId = (await res.json()).project.project_id;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (!conn) return;
    if (projectId) await conn.query(`DELETE FROM project WHERE project_id = ?`, [projectId]);
    if (accountIds.length) await conn.query(`DELETE FROM account WHERE id IN (?)`, [accountIds]);
    await conn.end();
    const { closePool } = await import('@/lib/db');
    await closePool();
  });

  it('a non-member gets 404 "Project not found", the same as a project id that does not exist', async () => {
    const hidden = await project.GET(bearer(tokenB, `/api/projects/${projectId}`), ctx(projectId));
    const missing = await project.GET(bearer(tokenB, '/api/projects/2147480000'), ctx(2147480000));
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await hidden.json()).toEqual(await missing.json());
  });

  it('a viewer member can read but gets 403 on an admin-level change', async () => {
    await conn.query(
      `INSERT INTO project_members (project_id, user_id, permission_id)
       SELECT ?, ?, permission_id FROM permissions WHERE permission_name = 'viewer'`,
      [projectId, b.id],
    );
    expect((await project.GET(bearer(tokenB, `/api/projects/${projectId}`), ctx(projectId))).status).toBe(200);
    const put = await project.PUT(
      bearer(tokenB, `/api/projects/${projectId}`, { method: 'PUT', body: { project_name: 'renamed' } }),
      ctx(projectId),
    );
    expect(put.status).toBe(403);
  });

  it("changing the account's password_hash revokes its earlier token (401), a fresh one works", async () => {
    expect((await projects.GET(bearer(tokenA))).status).toBe(200);
    const newHash = await bcrypt.hash('alpha-pass-2', 4);
    await conn.query(`UPDATE account SET password_hash = ? WHERE id = ?`, [newHash, a.id]);
    expect((await projects.GET(bearer(tokenA))).status).toBe(401);
    const fresh = auth.createToken({ id: a.id, email: a.email }, newHash);
    expect((await projects.GET(bearer(fresh))).status).toBe(200);
  });

  it('a deactivated account gets 401, not 500', async () => {
    const c = await makeAccount('c', await bcrypt.hash('charlie-pass-1', 4));
    const t = auth.createToken({ id: c.id, email: c.email }, c.hash);
    await conn.query(`UPDATE account SET is_active = 0 WHERE id = ?`, [c.id]);
    expect((await projects.GET(bearer(t))).status).toBe(401);
  });

  it('Google sign-in with a verified email takes over an old-flow account and revokes its sessions', async () => {
    const g = await makeAccount('g', await bcrypt.hash('random-old-google-hash', 4));
    const before = auth.createToken({ id: g.id, email: g.email }, g.hash);
    expect((await projects.GET(bearer(before))).status).toBe(200);

    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_APP_URL = APP;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'stub' }), { status: 200 });
      }
      if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) {
        return new Response(JSON.stringify({ email: g.email, verified_email: true, name: 'G' }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const start = await google.GET(new NextRequest(`${APP}/api/auth/google`));
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const stateCookie = start.headers.getSetCookie().find((c) => c.startsWith('google_oauth='))!.split(';')[0];
    const cb = await google.GET(
      new NextRequest(`${APP}/api/auth/google?code=stub&state=${encodeURIComponent(state)}`, { headers: { cookie: stateCookie } }),
    );
    expect(new URL(cb.headers.get('location')!).pathname).toBe('/auth/callback');

    const [[row]]: any = await conn.query(`SELECT password_hash FROM account WHERE id = ?`, [g.id]);
    expect(row.password_hash).toBe(auth.OAUTH_ONLY_PASSWORD_HASH);
    expect((await projects.GET(bearer(before))).status).toBe(401);

    const handoff = decodeURIComponent(
      cb.headers.getSetCookie().find((c) => c.startsWith('auth_token='))!.split(';')[0].slice('auth_token='.length),
    );
    expect((await projects.GET(bearer(handoff))).status).toBe(200);
  });
});
