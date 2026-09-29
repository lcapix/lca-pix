/**
 * POST /api/auth/logout — expire the auth cookies with Set-Cookie.
 *
 * The bearer JWT itself lives in the client's localStorage and is dropped
 * there; this clears what the browser would otherwise keep: the Google
 * hand-off `auth_token` (httpOnly, so JS cannot delete it) and the legacy
 * JS-readable `auth_token` / `user_data` cookies older builds set for 7 days.
 * No authentication needed: clearing cookies is harmless.
 *
 * JWTs stay valid until they expire (no server-side revocation yet).
 */
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '../cookies';

export async function POST() {
  const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  clearAuthCookies(res);
  return res;
}
