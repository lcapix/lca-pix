import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/auth/me/route';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth');

describe('GET /api/auth/me', () => {
  it('does not echo internal error text (L1)', async () => {
    vi.mocked(auth.getCurrentUser).mockRejectedValue(new Error('connect ETIMEDOUT db.internal:3306'));
    const res = await GET(new Request('http://t/api/auth/me') as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/ETIMEDOUT|internal/);
  });
});
