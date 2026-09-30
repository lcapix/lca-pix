/**
 * GET /api/auth/google — Google sign-in (authorization code flow + PKCE).
 *
 * Start (no `code`/`error`): a random `state` and a PKCE verifier go into a
 * 10-minute httpOnly SameSite=Lax cookie; the browser is sent to Google with
 * the state and the S256 challenge.
 *
 * Callback: the state cookie is read and cleared on every outcome. A missing or
 * different `state` is refused before the code is exchanged (login CSRF). The
 * code exchange carries the PKCE verifier. Then:
 *   - the Google email must be verified;
 *   - an existing account is only signed in if it was created by Google sign-in
 *     (password_hash is OAUTH_ONLY_PASSWORD_HASH) and is active. A password
 *     account with the same email is NOT linked: the user is sent back to log
 *     in with the password (an attacker could have pre-registered the address);
 *   - a new account gets a unique username and no password.
 *
 * Hand-off: the JWT goes to /auth/callback in an httpOnly `auth_token` cookie
 * that lives 2 minutes. That page calls POST /api/auth/google/session, which
 * returns the token once and clears the cookie. Errors come back to
 * /auth/login as fixed codes (never Google's text).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  createToken,
  generateUniqueUsername,
  isDuplicateKeyError,
  isPasswordLogin,
  OAUTH_ONLY_PASSWORD_HASH,
} from '@/lib/auth';
import { insert, queryOne } from '@/lib/db-helpers';
import { setAuthHandoffCookie } from '../cookies';

const STATE_COOKIE = 'google_oauth';
const STATE_PATH = '/api/auth/google';
const STATE_MAX_AGE = 10 * 60;

const secure = () => process.env.NODE_ENV === 'production';

function toLogin(request: NextRequest, code: string) {
  const res = NextResponse.redirect(new URL(`/auth/login?error=${code}`, request.url));
  clearStateCookie(res);
  return res;
}

function clearStateCookie(res: NextResponse) {
  res.cookies.set(STATE_COOKIE, '', {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: STATE_PATH,
    maxAge: 0,
  });
}

function sameString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function startFlow(request: NextRequest) {
  // Missing env vars are the #1 cause of "invalid_client" Google error pages;
  // bounce back to /auth/login with a code the page can explain instead.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) {
    console.warn('[google-oauth] Missing env var(s):', { hasClientId: !!clientId, hasAppUrl: !!appUrl });
    return toLogin(request, 'google_not_configured');
  }

  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', `${appUrl}/api/auth/google`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('code_challenge', challenge);
  googleAuthUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(googleAuthUrl.toString());
  res.cookies.set(STATE_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: STATE_PATH,
    maxAge: STATE_MAX_AGE,
  });
  return res;
}

/** Find or create the account for a verified Google identity. */
async function resolveAccount(
  googleUser: { email: string; name?: string | null }
): Promise<{ user: any } | { error: string }> {
  const existing = await queryOne<any>('SELECT * FROM account WHERE email = ?', [googleUser.email]);
  if (existing) {
    if (isPasswordLogin(existing.password_hash)) return { error: 'use_password_login' };
    if (!existing.is_active) return { error: 'account_inactive' };
    return { user: existing };
  }

  // New account. full_name is seeded from Google so onboarding can pre-fill
  // it; company stays NULL so the onboarding gate still fires.
  let userId = 0;
  for (let attempt = 0; attempt < 3 && !userId; attempt++) {
    const username = await generateUniqueUsername(googleUser.email);
    try {
      userId = await insert(
        `INSERT INTO account (username, full_name, email, password_hash, account_type, is_active)
         VALUES (?, ?, ?, ?, 'user', TRUE)`,
        [username, googleUser.name?.slice(0, 120) ?? null, googleUser.email, OAUTH_ONLY_PASSWORD_HASH]
      );
    } catch (err: any) {
      if (isDuplicateKeyError(err, 'username')) continue;
      // The same email signed up in the meantime: treat it as existing.
      if (isDuplicateKeyError(err, 'email')) return resolveAccount({ email: googleUser.email });
      throw err;
    }
  }
  if (!userId) throw new Error('could not allocate a unique username');
  const user = await queryOne<any>('SELECT * FROM account WHERE id = ?', [userId]);
  return user ? { user } : { error: 'server_error' };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (!code && !error) return startFlow(request);

    // ── Callback: verify state before anything else ───────────────────────────
    const stored = request.cookies.get(STATE_COOKIE)?.value ?? '';
    const [storedState = '', verifier = ''] = stored.split('.');
    const returnedState = searchParams.get('state') ?? '';
    if (!storedState || !verifier || !returnedState || !sameString(storedState, returnedState)) {
      return toLogin(request, 'oauth_state_mismatch');
    }

    // Google reported an error (the user cancelled, or a config problem).
    if (error) {
      return toLogin(request, error === 'access_denied' ? 'google_cancelled' : 'oauth_failed');
    }

    // Code is present — confirm the secret is configured before exchanging.
    if (!process.env.GOOGLE_CLIENT_SECRET || !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      console.warn('[google-oauth] GOOGLE_CLIENT_SECRET missing on server');
      return toLogin(request, 'google_not_configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code!,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google`,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Google token exchange failed:', errorData?.error ?? tokenResponse.status);
      return toLogin(request, 'oauth_failed');
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) {
      console.error('Failed to fetch Google user info');
      return toLogin(request, 'userinfo_failed');
    }

    const googleUser = await userInfoResponse.json();
    if (typeof googleUser?.email !== 'string' || !googleUser.email) {
      return toLogin(request, 'userinfo_failed');
    }
    if (googleUser.verified_email !== true) {
      return toLogin(request, 'google_email_unverified');
    }

    const resolved = await resolveAccount(googleUser);
    if ('error' in resolved) return toLogin(request, resolved.error);
    const user = resolved.user;

    // New users (no onboarded_at, no company) go through /auth/onboarding;
    // everyone else to /home. /auth/callback does the actual redirect.
    const needsOnboarding = !user.onboarded_at || !user.company;
    const nextPath = needsOnboarding ? '/auth/onboarding' : '/home';

    const token = createToken({
      id: user.id,
      email: user.email,
      account_type: user.account_type,
    });

    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.searchParams.set('next', nextPath);
    const response = NextResponse.redirect(callbackUrl);
    clearStateCookie(response);
    setAuthHandoffCookie(response, token);
    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return toLogin(request, 'server_error');
  }
}
