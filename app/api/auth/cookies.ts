/**
 * Cookies the auth routes set and clear. Not a route: colocated helpers.
 *
 * `auth_token` only carries the Google sign-in hand-off now: httpOnly, 2
 * minutes, read once by POST /api/auth/google/session and cleared there.
 * Before this change it was a JS-readable 7-day cookie, and `user_data` sat
 * next to it; browsers may still hold those, so logout and the hand-off clear
 * both names on path "/".
 */
import type { NextResponse } from 'next/server';

export const AUTH_TOKEN_COOKIE = 'auth_token';
export const USER_DATA_COOKIE = 'user_data';
/** Seconds the hand-off cookie lives: long enough for one redirect. */
export const AUTH_HANDOFF_MAX_AGE = 120;

const secure = () => process.env.NODE_ENV === 'production';

export function setAuthHandoffCookie(res: NextResponse, token: string): void {
  res.cookies.set(AUTH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_HANDOFF_MAX_AGE,
  });
}

/** Expire every auth cookie (current and legacy) on path "/". */
export function clearAuthCookies(res: NextResponse): void {
  for (const name of [AUTH_TOKEN_COOKIE, USER_DATA_COOKIE]) {
    res.cookies.set(name, '', {
      httpOnly: true,
      secure: secure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
