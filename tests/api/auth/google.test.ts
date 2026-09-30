import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import { GET } from '@/app/api/auth/google/route';
import * as db from '@/lib/db-helpers';
import { OAUTH_ONLY_PASSWORD_HASH, passwordFingerprint, verifyToken } from '@/lib/auth';

vi.mock('@/lib/db-helpers');

const APP = 'http://localhost:3102';
const STATE_COOKIE = 'google_oauth';

function start() {
  return GET(new NextRequest(`${APP}/api/auth/google`));
}

function callback(params: Record<string, string>, cookie?: string) {
  const url = new URL(`${APP}/api/auth/google`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return GET(new NextRequest(url, { headers: cookie ? { cookie } : {} }));
}

/** Parse Set-Cookie headers into { name: { value, attrs } }. */
function cookies(res: Response) {
  const out: Record<string, { value: string; attrs: string }> = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair, ...rest] = line.split(';');
    const i = pair.indexOf('=');
    out[pair.slice(0, i).trim()] = { value: decodeURIComponent(pair.slice(i + 1)), attrs: rest.join(';').toLowerCase() };
  }
  return out;
}

function errorOf(res: Response): string | null {
  const loc = res.headers.get('location');
  if (!loc) return null;
  return new URL(loc).searchParams.get('error');
}

/** Run the start leg and return the state + verifier cookie it set. */
async function beginFlow() {
  const res = await start();
  const loc = new URL(res.headers.get('location')!);
  const c = cookies(res)[STATE_COOKIE];
  return { state: loc.searchParams.get('state')!, challenge: loc.searchParams.get('code_challenge')!, cookie: `${STATE_COOKIE}=${encodeURIComponent(c.value)}` };
}

function googleFetch({ verified = true, email = 'jo@corp.com', tokenOk = true } = {}) {
  return vi.fn(async (url: string, init?: any) => {
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return tokenOk
        ? new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })
        : new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    }
    if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) {
      return new Response(JSON.stringify({ email, verified_email: verified, name: 'Jo Smith' }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

describe('GET /api/auth/google', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'cid';
    process.env.GOOGLE_CLIENT_SECRET = 'csecret';
    process.env.NEXT_PUBLIC_APP_URL = APP;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('start', () => {
    it('redirects to Google with state and an S256 PKCE challenge, and no offline access', async () => {
      const res = await start();
      expect(res.status).toBe(307);
      const loc = new URL(res.headers.get('location')!);
      expect(loc.origin + loc.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(loc.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{32,}$/);
      expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
      expect(loc.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(loc.searchParams.has('access_type')).toBe(false);
      expect(loc.searchParams.has('prompt')).toBe(false);
    });

    it('sets a 10-minute httpOnly SameSite=Lax state cookie holding the state and verifier', async () => {
      const res = await start();
      const loc = new URL(res.headers.get('location')!);
      const c = cookies(res)[STATE_COOKIE];
      expect(c).toBeDefined();
      expect(c.attrs).toContain('httponly');
      expect(c.attrs).toContain('samesite=lax');
      expect(c.attrs).toContain('max-age=600');
      expect(c.attrs).not.toContain('secure');
      const [state, verifier] = c.value.split('.');
      expect(state).toBe(loc.searchParams.get('state'));
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      expect(challenge).toBe(loc.searchParams.get('code_challenge'));
    });

    it('marks the state cookie Secure in production', async () => {
      const env = process.env as Record<string, string>;
      const prev = env.NODE_ENV;
      env.NODE_ENV = 'production';
      try {
        const res = await start();
        expect(cookies(res)[STATE_COOKIE].attrs).toContain('secure');
      } finally {
        env.NODE_ENV = prev;
      }
    });

    it('bounces to login when Google is not configured', async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      expect(errorOf(await start())).toBe('google_not_configured');
    });
  });

  describe('callback', () => {
    it('rejects a callback with no state cookie (login CSRF) and never exchanges the code', async () => {
      const f = googleFetch();
      vi.stubGlobal('fetch', f);
      const res = await callback({ code: 'attacker-code', state: 'whatever' });
      expect(errorOf(res)).toBe('oauth_state_mismatch');
      expect(f).not.toHaveBeenCalled();
    });

    it('rejects a mismatched state and clears the state cookie', async () => {
      const f = googleFetch();
      vi.stubGlobal('fetch', f);
      const { cookie } = await beginFlow();
      const res = await callback({ code: 'c', state: 'not-the-state' }, cookie);
      expect(errorOf(res)).toBe('oauth_state_mismatch');
      expect(f).not.toHaveBeenCalled();
      expect(cookies(res)[STATE_COOKIE].attrs).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
    });

    it('maps a Google error to a fixed code instead of echoing it', async () => {
      const { state, cookie } = await beginFlow();
      const res = await callback({ error: '<b>Call 555-0100 now</b>', state }, cookie);
      expect(errorOf(res)).toBe('oauth_failed');
      const res2 = await callback({ error: 'access_denied', state }, cookie);
      expect(errorOf(res2)).toBe('google_cancelled');
    });

    it('sends the PKCE verifier with the code exchange', async () => {
      const f = googleFetch();
      vi.stubGlobal('fetch', f);
      vi.mocked(db.queryOne).mockResolvedValue({
        id: 3, username: 'jo', email: 'jo@corp.com', password_hash: OAUTH_ONLY_PASSWORD_HASH,
        account_type: 'user', is_active: 1, company: 'X', onboarded_at: new Date(),
      } as any);
      const { state, challenge, cookie } = await beginFlow();
      await callback({ code: 'good', state }, cookie);
      const body = new URLSearchParams((f.mock.calls[0] as any[])[1].body);
      const verifier = body.get('code_verifier')!;
      expect(createHash('sha256').update(verifier).digest('base64url')).toBe(challenge);
    });

    it('refuses an unverified Google email', async () => {
      vi.stubGlobal('fetch', googleFetch({ verified: false }));
      const { state, cookie } = await beginFlow();
      const res = await callback({ code: 'c', state }, cookie);
      expect(errorOf(res)).toBe('google_email_unverified');
      expect(db.queryOne).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('does not link Google to an existing password account (pre-hijack)', async () => {
      vi.stubGlobal('fetch', googleFetch());
      const hash = await bcrypt.hash('attacker-pw1', 4);
      vi.mocked(db.queryOne).mockResolvedValue({
        id: 9, username: 'ceo', email: 'jo@corp.com', password_hash: hash,
        account_type: 'user', is_active: 1,
      } as any);
      const { state, cookie } = await beginFlow();
      const res = await callback({ code: 'c', state }, cookie);
      expect(errorOf(res)).toBe('use_password_login');
      expect(cookies(res).auth_token?.value ?? '').toBe('');
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('refuses an inactive Google account', async () => {
      vi.stubGlobal('fetch', googleFetch());
      vi.mocked(db.queryOne).mockResolvedValue({
        id: 9, username: 'jo', email: 'jo@corp.com', password_hash: OAUTH_ONLY_PASSWORD_HASH,
        account_type: 'user', is_active: 0,
      } as any);
      const { state, cookie } = await beginFlow();
      const res = await callback({ code: 'c', state }, cookie);
      expect(errorOf(res)).toBe('account_inactive');
      expect(cookies(res).auth_token?.value ?? '').toBe('');
    });

    it('signs in an existing Google account with a short-lived httpOnly hand-off cookie', async () => {
      vi.stubGlobal('fetch', googleFetch());
      vi.mocked(db.queryOne).mockResolvedValue({
        id: 3, username: 'jo', email: 'jo@corp.com', password_hash: OAUTH_ONLY_PASSWORD_HASH,
        account_type: 'user', is_active: 1, company: 'Acme', onboarded_at: new Date(),
      } as any);
      const { state, cookie } = await beginFlow();
      const res = await callback({ code: 'c', state }, cookie);
      const loc = new URL(res.headers.get('location')!);
      expect(loc.pathname).toBe('/auth/callback');
      expect(loc.searchParams.get('next')).toBe('/home');
      const c = cookies(res);
      expect(verifyToken(c.auth_token.value)?.id).toBe(3);
      expect(verifyToken(c.auth_token.value)?.pv).toBe(passwordFingerprint(OAUTH_ONLY_PASSWORD_HASH));
      expect(c.auth_token.attrs).toContain('httponly');
      expect(c.auth_token.attrs).toContain('max-age=120');
      expect(c.auth_token.attrs).toContain('path=/');
      expect(c.user_data).toBeUndefined();
      expect(c[STATE_COOKIE].attrs).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
    });

    it('creates a new Google account with no password and a unique username', async () => {
      vi.stubGlobal('fetch', googleFetch({ email: 'jsmith@corp.com' }));
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(null) // lookup by email
        .mockResolvedValueOnce({
          id: 21, username: 'jsmith-a1b2c3', email: 'jsmith@corp.com', account_type: 'user',
          is_active: 1, company: null, onboarded_at: null,
        } as any);
      vi.mocked(db.exists).mockImplementation(async (_sql: string, p?: any[]) => p?.[0] === 'jsmith');
      vi.mocked(db.insert).mockResolvedValue(21);
      const { state, cookie } = await beginFlow();
      const res = await callback({ code: 'c', state }, cookie);
      const [sql, params] = vi.mocked(db.insert).mock.calls[0];
      expect(sql).toMatch(/INSERT INTO account/);
      expect(params![0]).toMatch(/^jsmith-[0-9a-f]{6}$/);
      expect(params).toContain(OAUTH_ONLY_PASSWORD_HASH);
      expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe('/auth/onboarding');
    });

    it('retries the insert when the username races', async () => {
      vi.stubGlobal('fetch', googleFetch({ email: 'jsmith@corp.com' }));
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 22, username: 'jsmith-x', email: 'jsmith@corp.com', account_type: 'user', is_active: 1 } as any);
      vi.mocked(db.exists).mockResolvedValue(false);
      vi.mocked(db.insert)
        .mockRejectedValueOnce(Object.assign(new Error("Duplicate entry 'jsmith' for key 'account.username'"), { code: 'ER_DUP_ENTRY' }))
        .mockResolvedValueOnce(22);
      const { state, cookie } = await beginFlow();
      const res = await callback({ code: 'c', state }, cookie);
      expect(db.insert).toHaveBeenCalledTimes(2);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/callback');
    });

    it('reports a failed token exchange as oauth_failed', async () => {
      vi.stubGlobal('fetch', googleFetch({ tokenOk: false }));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { state, cookie } = await beginFlow();
      expect(errorOf(await callback({ code: 'c', state }, cookie))).toBe('oauth_failed');
    });
  });
});
