/**
 * F3. Google sign-in (state, verified email, linking rules), with Google's
 * token and userinfo endpoints mocked. The adversarial cases (forged state,
 * cookie flags, takeover revocation) are in security/google-oauth.test.ts.
 */
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { errorOf, exchangeHandoff, googleCallback, startGoogle, STATE_COOKIE } from '../support/google';
import { outbound } from '../support/outbound';
import { createUser, deactivate, uniqueEmail } from '../support/users';

describe('F3 Google sign-in', () => {
  it('F3.1 start: redirect to Google with state and PKCE, state cookie set', async () => {
    const { res, location, cookie } = await startGoogle();
    expect(res.status).toBe(307);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3002/api/auth/google',
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
    });
    expect(location.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    const [state, verifier] = cookie.value.split('.');
    expect(state).toBe(location.searchParams.get('state'));
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('F3.3-F3.5 a new Google user: account created, hand-off cookie, onboarding next, session once', async () => {
    const email = uniqueEmail('f3new');
    const { res, cookies } = await googleCallback({ email, name: 'Gus Google' });
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/auth/callback');
    expect(loc.searchParams.get('next')).toBe('/auth/onboarding');
    expect(cookies[STATE_COOKIE].attrs).toContain('max-age=0');
    expect(cookies.auth_token.attrs).toContain('httponly');
    expect(cookies.auth_token.attrs).toContain('max-age=120');

    // The code exchange carried the PKCE verifier and our client credentials.
    const tokenCall = outbound.calls.find((c) => c.url.startsWith('https://oauth2.googleapis.com/token'))!;
    const form = new URLSearchParams(tokenCall.body);
    expect(form.get('code')).toBe('test-code');
    expect(form.get('code_verifier')).toMatch(/^[\w-]{43,}$/);
    expect(form.get('redirect_uri')).toBe('http://localhost:3002/api/auth/google');

    const row = await sqlOne('SELECT id, full_name, password_hash, is_active, company FROM account WHERE email = ?', [email]);
    expect(row).toMatchObject({ full_name: 'Gus Google', password_hash: '!oauth-only', is_active: 1, company: null });

    const session = await exchangeHandoff(cookies.auth_token.value);
    expect(session.status).toBe(200);
    expect(session.json.user).toMatchObject({ id: row.id, email });
    expect((jwt.decode(session.json.token) as any).pv).toMatch(/^[0-9a-f]{16}$/);
    // The response clears the hand-off cookie; the browser's next call has none.
    expect(session.headers.getSetCookie().join(';')).toMatch(/auth_token=;.*Max-Age=0/i);
    expect((await api.post('/api/auth/google/session')).status).toBe(401);

    const profile = await api.get('/api/auth/profile', { token: session.json.token });
    expect(profile.json.profile).toMatchObject({ email, fullName: 'Gus Google', needsOnboarding: true });

    // No password can sign in to a Google-only account.
    const pw = await api.post('/api/auth/login', { json: { email, password: '!oauth-only' } });
    expect(pw.status).toBe(401);
  });

  it('an onboarded Google-only account signs in again and goes to /home', async () => {
    const email = uniqueEmail('f3back');
    const first = await googleCallback({ email });
    const token = (await exchangeHandoff(first.cookies.auth_token.value)).json.token;
    await api.put('/api/auth/profile', { token, json: { fullName: 'Back Again', company: 'LCAPIX Test' } });
    const again = await googleCallback({ email });
    expect(new URL(again.res.headers.get('location')!).searchParams.get('next')).toBe('/home');
    const s = await exchangeHandoff(again.cookies.auth_token.value);
    expect(s.status).toBe(200);
    // Signing in with Google again does not revoke the earlier session.
    expect((await api.get('/api/projects', { token })).status).toBe(200);
  });

  it('linking rules: unverified email refused; inactive refused and unchanged; password account taken over', async () => {
    const unverified = await googleCallback({ email: uniqueEmail('f3unv'), verified_email: false });
    expect(errorOf(unverified.res)).toBe('google_email_unverified');
    expect(unverified.cookies.auth_token).toBeUndefined();

    const inactive = await createUser('f3inactive');
    await deactivate(inactive);
    const before = await sqlOne('SELECT password_hash FROM account WHERE id = ?', [inactive.id]);
    const r = await googleCallback({ email: inactive.email });
    expect(errorOf(r.res)).toBe('account_inactive');
    expect(r.cookies.auth_token).toBeUndefined();
    expect(await sqlOne('SELECT password_hash FROM account WHERE id = ?', [inactive.id])).toEqual(before);

    const pwUser = await createUser('f3pw');
    const taken = await googleCallback({ email: pwUser.email });
    expect(errorOf(taken.res)).toBeNull();
    expect(new URL(taken.res.headers.get('location')!).pathname).toBe('/auth/callback');
    expect((await sqlOne('SELECT password_hash FROM account WHERE id = ?', [pwUser.id])).password_hash).toBe('!oauth-only');
  });

  it('Google-side failures come back as fixed error codes', async () => {
    // The user cancelled at Google (a valid state is still required first).
    const start = await startGoogle();
    const cancelled = await api.get(`/api/auth/google?error=access_denied&state=${start.state}`, {
      cookies: { [STATE_COOKIE]: start.cookie.value },
    });
    expect(errorOf(cancelled)).toBe('google_cancelled');
    // Unconfigured.
    const saved = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    try {
      expect(errorOf(await api.get('/api/auth/google'))).toBe('google_not_configured');
    } finally {
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = saved;
    }
  });
});
