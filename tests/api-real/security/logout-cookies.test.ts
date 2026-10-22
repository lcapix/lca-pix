/**
 * POST /api/auth/logout expires every auth cookie (M4): the Google hand-off
 * `auth_token` and the legacy JS-readable `auth_token` / `user_data` that
 * older builds set for 7 days. Same flags as when they were set, so the
 * browser matches and drops them; Secure in production.
 */
import { describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { setCookies } from '../support/http';

const attrs = (a: string) => a.split('; ').filter((x) => !x.startsWith('expires=')).sort();

describe('logout cookies', () => {
  it('expires auth_token and user_data: empty value, Max-Age=0, Path=/, httpOnly, SameSite=Lax, no-store', async () => {
    const res = await api.post('/api/auth/logout', { cookies: { auth_token: 'x.y.z', user_data: '{"id":1}' } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ success: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
    const c = setCookies(res.headers);
    for (const name of ['auth_token', 'user_data']) {
      expect(c[name].value).toBe('');
      expect(attrs(c[name].attrs)).toEqual(['httponly', 'max-age=0', 'path=/', 'samesite=lax']);
      // Expires is in the past as well as Max-Age=0.
      const expires = /expires=([^;]+)/i.exec(c[name].raw)?.[1];
      if (expires) expect(new Date(expires).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('in production the expiring cookies are Secure', async () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const c = setCookies((await api.post('/api/auth/logout')).headers);
      expect(c.auth_token.attrs).toContain('secure');
      expect(c.user_data.attrs).toContain('secure');
    } finally {
      env.NODE_ENV = saved;
    }
  });

  it('needs no token and ignores a bad one', async () => {
    expect((await api.post('/api/auth/logout', { token: 'garbage' })).status).toBe(200);
  });
});
