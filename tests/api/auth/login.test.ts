import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';
import { POST } from '@/app/api/auth/login/route';
import * as db from '@/lib/db-helpers';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';
import { OAUTH_ONLY_PASSWORD_HASH, passwordFingerprint, verifyToken } from '@/lib/auth';

vi.mock('@/lib/db-helpers');

let HASH: string;
beforeAll(async () => {
  HASH = await bcrypt.hash('Sup3r-secret', 4);
});

function req(body: unknown, ip = '203.0.113.5') {
  return new Request('http://t/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const user = (over: Record<string, unknown> = {}) => ({
  id: 11,
  username: 'jo',
  email: 'jo@corp.com',
  password_hash: HASH,
  account_type: 'user',
  is_active: 1,
  ...over,
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('logs in with the right password', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(user() as any);
    const res = await POST(req({ email: 'jo@corp.com', password: 'Sup3r-secret' }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(verifyToken(body.token)?.id).toBe(11);
  });

  it('the token carries pv, the fingerprint of the stored password hash (revocation)', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(user() as any);
    const res = await POST(req({ email: 'jo@corp.com', password: 'Sup3r-secret' }) as any);
    const body = await res.json();
    expect(verifyToken(body.token)?.pv).toBe(passwordFingerprint(HASH));
  });

  it('unknown email: uniform 401 after a real bcrypt compare', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(null);
    const spy = vi.spyOn(bcrypt, 'compare');
    const res = await POST(req({ email: 'nobody@corp.com', password: 'whatever1' }) as any);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid email or password');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('inactive account with a wrong password looks like any wrong password', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(user({ is_active: 0 }) as any);
    const res = await POST(req({ email: 'jo@corp.com', password: 'nope-nope1' }) as any);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid email or password');
  });

  it('inactive account is only revealed after the right password', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(user({ is_active: 0 }) as any);
    const res = await POST(req({ email: 'jo@corp.com', password: 'Sup3r-secret' }) as any);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/inactive/i);
    expect(body.token).toBeUndefined();
  });

  it('an account created with Google has no password to match', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(user({ password_hash: OAUTH_ONLY_PASSWORD_HASH }) as any);
    const res = await POST(req({ email: 'jo@corp.com', password: OAUTH_ONLY_PASSWORD_HASH }) as any);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid email or password');
  });

  it('rejects non-string credentials with 400', async () => {
    const res = await POST(req({ email: { $gt: '' }, password: ['x'] }) as any);
    expect(res.status).toBe(400);
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(req('{not json') as any);
    expect(res.status).toBe(400);
  });

  it('the 6th attempt in a minute from one IP for one email gets 429 + Retry-After', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(null);
    for (let i = 0; i < 5; i++) {
      const r = await POST(req({ email: 'jo@corp.com', password: `guess-${i}` }) as any);
      expect(r.status).toBe(401);
    }
    const sixth = await POST(req({ email: 'JO@corp.com', password: 'guess-6' }) as any);
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Another IP is a different bucket.
    const other = await POST(req({ email: 'jo@corp.com', password: 'guess-7' }, '198.51.100.7') as any);
    expect(other.status).toBe(401);
  });

  it('does not leak internal error text', async () => {
    vi.mocked(db.queryOne).mockRejectedValue(new Error('connect ETIMEDOUT secret-host.rds.amazonaws.com'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(req({ email: 'jo@corp.com', password: 'Sup3r-secret' }) as any);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/ETIMEDOUT|rds|secret-host/);
    expect(JSON.parse(text).details).toBeUndefined();
    spy.mockRestore();
  });
});
