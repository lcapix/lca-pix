/**
 * Google OAuth hardening (H3, AUTH-1..3, M4, fix/int-auth takeover), with
 * Google's token and userinfo endpoints mocked:
 * state (login CSRF), state and hand-off cookie flags, unverified email,
 * inactive account, takeover of a password account (marker set, earlier
 * tokens revoked), the one-time hand-off exchange.
 */
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { api } from '../support/api';
import { setCookies } from '../support/http';
import { sqlOne } from '../support/db';
import { errorOf, exchangeHandoff, googleCallback, startGoogle, STATE_COOKIE } from '../support/google';
import { mockOutbound, outbound } from '../support/outbound';
import { changePasswordHash, createUser, deactivate, uniqueEmail } from '../support/users';

const noSession = (res: { headers: Headers }) => expect(setCookies(res.headers).auth_token).toBeUndefined();
const attrs = (a: string) => a.split('; ').filter((x) => !x.startsWith('expires=')).sort();

describe('Google OAuth: state', () => {
  it('the state cookie is httpOnly, SameSite=Lax, scoped to the callback path, 10 minutes', async () => {
    const { cookie } = await startGoogle();
    // Next adds Expires next to Max-Age; everything else is exactly these.
    expect(attrs(cookie.attrs)).toEqual(['httponly', 'max-age=600', 'path=/api/auth/google', 'samesite=lax']);
  });

  it('in production the state and hand-off cookies are Secure', async () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const { cookie } = await startGoogle();
      expect(cookie.attrs).toContain('secure');
      const { cookies } = await googleCallback({ email: uniqueEmail('gprod') });
      expect(cookies.auth_token.attrs).toContain('secure');
    } finally {
      env.NODE_ENV = saved;
    }
  });

  it('a callback with no state cookie, no state, or another state: error redirect, no session, no code exchange', async () => {
    const { state, cookie } = await startGoogle();
    const other = await startGoogle();
    const attempts = [
      api.get(`/api/auth/google?code=attacker-code&state=${state}`), // no cookie (login CSRF)
      api.get('/api/auth/google?code=attacker-code', { cookies: { [STATE_COOKIE]: cookie.value } }), // no state
      api.get(`/api/auth/google?code=attacker-code&state=${other.state}`, { cookies: { [STATE_COOKIE]: cookie.value } }), // another flow's state
      api.get(`/api/auth/google?code=attacker-code&state=${state}`, { cookies: { [STATE_COOKIE]: `${state}` } }), // cookie without verifier
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/login');
      expect(errorOf(res)).toBe('oauth_state_mismatch');
      noSession(res);
      // The state cookie is cleared on every outcome.
      expect(setCookies(res.headers)[STATE_COOKIE].attrs).toContain('max-age=0');
    }
    expect(outbound.calls).toEqual([]);
  });

  it('Google failures come back as fixed codes, never Google\'s text', async () => {
    mockOutbound(/oauth2\.googleapis\.com\/token/, () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'secret detail' }), { status: 400 }));
    const failed = await googleCallback({ email: uniqueEmail('gfail') });
    expect(errorOf(failed.res)).toBe('oauth_failed');
    expect(failed.res.headers.get('location')).not.toContain('secret');
    noSession(failed.res);

    mockOutbound(/oauth2\.googleapis\.com\/token/, () => new Response(JSON.stringify({ access_token: 'x' }), { status: 200 }));
    mockOutbound(/googleapis\.com\/oauth2\/v2\/userinfo/, () => new Response('nope', { status: 500 }));
    const userinfo = await googleCallback({ email: uniqueEmail('gui') });
    expect(errorOf(userinfo.res)).toBe('userinfo_failed');
    noSession(userinfo.res);
  });
});

describe('Google OAuth: linking rules', () => {
  it('an unverified Google email is refused and no account is created', async () => {
    const email = uniqueEmail('gunverified');
    const r = await googleCallback({ email, verified_email: false });
    expect(errorOf(r.res)).toBe('google_email_unverified');
    noSession(r.res);
    expect(await sqlOne('SELECT id FROM account WHERE email = ?', [email])).toBeUndefined();
    // A missing flag is not "verified" either.
    const start = await startGoogle();
    mockOutbound(/userinfo/, () => new Response(JSON.stringify({ email, name: 'x' }), { status: 200 }));
    const missing = await api.get(`/api/auth/google?code=c&state=${start.state}`, { cookies: { [STATE_COOKIE]: start.cookie.value } });
    expect(errorOf(missing)).toBe('google_email_unverified');
  });

  it('an inactive account is refused and left unchanged', async () => {
    const u = await createUser('ginactive');
    await deactivate(u);
    const before = await sqlOne('SELECT password_hash, is_active FROM account WHERE id = ?', [u.id]);
    const r = await googleCallback({ email: u.email });
    expect(errorOf(r.res)).toBe('account_inactive');
    noSession(r.res);
    expect(await sqlOne('SELECT password_hash, is_active FROM account WHERE id = ?', [u.id])).toEqual(before);
  });

  it('takeover: a verified Google email ends a pre-registered password and every earlier session', async () => {
    // The "attacker" registered the victim's address with a password first.
    const squatter = await createUser('gsquat');
    const squatterToken = squatter.token;
    expect((await api.get('/api/projects', { token: squatterToken })).status).toBe(200);

    const r = await googleCallback({ email: squatter.email, name: 'Real Owner' });
    expect(errorOf(r.res)).toBeNull();
    expect((await sqlOne('SELECT password_hash FROM account WHERE id = ?', [squatter.id])).password_hash).toBe('!oauth-only');

    // The squatter's token and password are both dead.
    expect((await api.get('/api/projects', { token: squatterToken })).status).toBe(401);
    const pw = await api.post('/api/auth/login', { json: { email: squatter.email, password: squatter.password } });
    expect(pw.status).toBe(401);
    // The Google session works.
    const s = await exchangeHandoff(r.cookies.auth_token.value);
    expect(s.status).toBe(200);
    expect((await api.get('/api/projects', { token: s.json.token })).status).toBe(200);
  });
});

describe('Google OAuth: the hand-off', () => {
  it('the hand-off cookie is httpOnly, SameSite=Lax, Path=/, two minutes', async () => {
    const { cookies } = await googleCallback({ email: uniqueEmail('ghand') });
    expect(attrs(cookies.auth_token.attrs)).toEqual(['httponly', 'max-age=120', 'path=/', 'samesite=lax']);
    expect(cookies.user_data).toBeUndefined();
  });

  it('refuses a cross-site request (403), a missing or forged cookie (401), and clears the cookie every time', async () => {
    const { cookies } = await googleCallback({ email: uniqueEmail('gcross') });
    const cross = await exchangeHandoff(cookies.auth_token.value, { 'sec-fetch-site': 'cross-site' });
    expect(cross.status).toBe(403);
    for (const res of [
      cross,
      await api.post('/api/auth/google/session'),
      await exchangeHandoff(jwt.sign({ id: 1, email: 'x@y.z' }, 'not-the-secret')),
      await exchangeHandoff('not-a-jwt'),
    ]) {
      expect(setCookies(res.headers).auth_token.attrs).toContain('max-age=0');
      expect(res.headers.get('cache-control')).toBe('no-store');
      if (res !== cross) expect(res.status).toBe(401);
      expect(res.json.token).toBeUndefined();
    }
  });

  it('a hand-off for an account deactivated or revoked since is refused', async () => {
    const email = uniqueEmail('glate');
    const { cookies } = await googleCallback({ email });
    const id = Number((await sqlOne('SELECT id FROM account WHERE email = ?', [email])).id);
    await changePasswordHash({ id, label: 'glate', email, password: '', username: '', token: '' });
    expect((await exchangeHandoff(cookies.auth_token.value)).status).toBe(401);

    const email2 = uniqueEmail('glate2');
    const second = await googleCallback({ email: email2 });
    const id2 = Number((await sqlOne('SELECT id FROM account WHERE email = ?', [email2])).id);
    await deactivate({ id: id2, label: 'glate2', email: email2, password: '', username: '', token: '' });
    expect((await exchangeHandoff(second.cookies.auth_token.value)).status).toBe(401);
  });

  it('no access_type=offline, no prompt=consent (no refresh token is ever used)', async () => {
    const { location } = await startGoogle();
    expect(location.searchParams.has('access_type')).toBe(false);
    expect(location.searchParams.has('prompt')).toBe(false);
  });
});
