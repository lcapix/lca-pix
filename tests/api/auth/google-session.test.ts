import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/google/session/route';
import * as db from '@/lib/db-helpers';
import { createToken } from '@/lib/auth';

vi.mock('@/lib/db-helpers');

function req(cookie?: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3102/api/auth/google/session', {
    method: 'POST',
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  });
}

function cleared(res: Response): string[] {
  return res.headers
    .getSetCookie()
    .filter((l) => /max-age=0|expires=thu, 01 jan 1970/i.test(l))
    .map((l) => l.split('=')[0]);
}

describe('POST /api/auth/google/session (Google sign-in hand-off)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the token and user once, and clears the hand-off cookies', async () => {
    const token = createToken({ id: 3, email: 'jo@corp.com' });
    vi.mocked(db.queryOne).mockResolvedValue({ id: 3, username: 'jo', email: 'jo@corp.com', is_active: 1 } as any);
    const res = await POST(req(`auth_token=${token}; user_data=%7B%7D`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe(token);
    expect(body.user).toEqual({ id: 3, username: 'jo', email: 'jo@corp.com' });
    expect(cleared(res)).toEqual(expect.arrayContaining(['auth_token', 'user_data']));
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('401 without the cookie, still clearing', async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(cleared(res)).toEqual(expect.arrayContaining(['auth_token', 'user_data']));
  });

  it('401 for a forged or expired token', async () => {
    const res = await POST(req('auth_token=not.a.jwt'));
    expect(res.status).toBe(401);
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('401 when the account is gone or inactive', async () => {
    const token = createToken({ id: 4, email: 'x@corp.com' });
    vi.mocked(db.queryOne).mockResolvedValue({ id: 4, username: 'x', email: 'x@corp.com', is_active: 0 } as any);
    expect((await POST(req(`auth_token=${token}`))).status).toBe(401);
  });

  it('refuses cross-site callers', async () => {
    const token = createToken({ id: 3, email: 'jo@corp.com' });
    const res = await POST(req(`auth_token=${token}`, { 'sec-fetch-site': 'cross-site' }));
    expect(res.status).toBe(403);
  });
});
