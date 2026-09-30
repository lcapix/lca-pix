/**
 * POST /api/auth/google/session — the second half of the Google sign-in
 * hand-off. /api/auth/google leaves the JWT in an httpOnly, 2-minute
 * `auth_token` cookie; /auth/callback calls this once to receive it as JSON
 * (the app's API client sends it as a Bearer header), and the response clears
 * the cookie so it cannot be replayed from the cookie jar later (for example by
 * the next person on a shared lab machine).
 *
 * SameSite=Lax keeps the cookie off cross-site POSTs, and same-origin policy
 * keeps another site from reading the response; a cross-site Fetch Metadata
 * header is refused outright as a second guard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { queryOne } from '@/lib/db-helpers';
import { AUTH_TOKEN_COOKIE, clearAuthCookies } from '../../cookies';

function reply(body: unknown, status: number) {
  const res = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  clearAuthCookies(res);
  return res;
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return reply({ error: 'Forbidden' }, 403);
    }
    const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
    const payload = token ? verifyToken(token) : null;
    if (!token || !payload?.id) {
      return reply({ error: 'No sign-in to complete. Try signing in again.' }, 401);
    }
    const user = await queryOne<any>(
      'SELECT id, username, email, is_active FROM account WHERE id = ?',
      [payload.id]
    );
    if (!user || !user.is_active) {
      return reply({ error: 'No sign-in to complete. Try signing in again.' }, 401);
    }
    return reply(
      { success: true, token, user: { id: user.id, username: user.username, email: user.email } },
      200
    );
  } catch (error) {
    console.error('Google session hand-off error:', error);
    return reply({ error: 'Failed to complete sign-in' }, 500);
  }
}
