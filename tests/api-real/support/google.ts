/**
 * The Google sign-in round trip through the real route, with Google's token
 * and userinfo endpoints answered by outbound.ts:
 *   GET /api/auth/google            -> state cookie + redirect to Google
 *   GET /api/auth/google?code&state -> hand-off cookie + redirect to /auth/callback
 *   POST /api/auth/google/session   -> { token, user } once
 */
import { api } from './api';
import { setCookies } from './http';
import { setGoogleUser } from './outbound';

export const STATE_COOKIE = 'google_oauth';

export async function startGoogle() {
  const res = await api.get('/api/auth/google');
  const location = new URL(res.headers.get('location')!);
  const cookie = setCookies(res.headers)[STATE_COOKIE];
  return { res, location, state: location.searchParams.get('state')!, cookie };
}

/** Error code the callback redirected with, or null on success. */
export function errorOf(res: { headers: Headers }): string | null {
  const loc = res.headers.get('location');
  return loc ? new URL(loc).searchParams.get('error') : null;
}

/** Run start + callback for a Google identity; returns the callback response. */
export async function googleCallback(user: { email: string; verified_email?: boolean; name?: string | null }) {
  setGoogleUser({ email: user.email, verified_email: user.verified_email ?? true, name: user.name ?? 'Gia Google' });
  const start = await startGoogle();
  const res = await api.get(`/api/auth/google?code=test-code&state=${encodeURIComponent(start.state)}`, {
    cookies: { [STATE_COOKIE]: start.cookie.value },
  });
  return { start, res, cookies: setCookies(res.headers) };
}

/** Exchange a hand-off cookie at POST /api/auth/google/session. */
export function exchangeHandoff(token: string, headers: Record<string, string> = {}) {
  return api.post('/api/auth/google/session', { cookies: { auth_token: token }, headers });
}
