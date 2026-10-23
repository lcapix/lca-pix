import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/auth/me/route';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth');

describe('GET /api/auth/me', () => {
  // A database failure is not "not signed in": the client signs people out on
  // a 401, so it is a 500 (Phase 1), with no internal text echoed (L1).
  it('a database failure is a 500 that does not echo internal error text (L1, Phase 1)', async () => {
    vi.mocked(auth.getCurrentUser).mockRejectedValue(new Error('connect ETIMEDOUT db.internal:3306'));
    const res = await GET(new Request('http://t/api/auth/me') as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/ETIMEDOUT|internal/);
  });

  it('a bad or expired token is still a 401', async () => {
    // getCurrentUser reads a bad token as null (lib/auth catches its AuthError).
    vi.mocked(auth.getCurrentUser).mockResolvedValue(null);
    const res = await GET(new Request('http://t/api/auth/me') as any);
    expect(res.status).toBe(401);
  });
});
