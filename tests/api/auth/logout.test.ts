import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/auth/logout/route';

describe('POST /api/auth/logout', () => {
  it('expires auth_token and user_data on path / with Set-Cookie', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const lines = res.headers.getSetCookie();
    for (const name of ['auth_token', 'user_data']) {
      const line = lines.find((l) => l.startsWith(`${name}=`));
      expect(line, name).toBeDefined();
      expect(line!.toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/);
      expect(line!.toLowerCase()).toContain('path=/');
    }
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });
});
