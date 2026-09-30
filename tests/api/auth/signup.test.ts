import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/signup/route';
import * as db from '@/lib/db-helpers';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';
import { verifyToken } from '@/lib/auth';

vi.mock('@/lib/db-helpers');

let ipCounter = 0;
function req(body: unknown, ip?: string) {
  return new Request('http://t/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip ?? `192.0.2.${++ipCounter}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** exists(): usernames in `takenUsernames` and emails in `takenEmails` are taken. */
function dbWith({ takenUsernames = [] as string[], takenEmails = [] as string[] } = {}) {
  vi.mocked(db.exists).mockImplementation(async (sql: string, params?: any[]) => {
    if (/username = \?/.test(sql)) return takenUsernames.includes(params?.[0]);
    if (/email = \?/.test(sql)) return takenEmails.includes(params?.[0]);
    return false;
  });
  vi.mocked(db.insert).mockResolvedValue(42);
}

const GOOD = { full_name: 'Jo Smith', email: 'jo.smith@corp.com', password: 'longenough1' };

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('creates the account with a server-derived username and the typed name as full_name', async () => {
    dbWith();
    const res = await POST(req({ ...GOOD, username: 'Jo Smith' }) as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.username).toBe('jo.smith');
    expect(verifyToken(body.token)?.id).toBe(42);
    const [sql, params] = vi.mocked(db.insert).mock.calls[0];
    expect(sql).toMatch(/full_name/);
    expect(params).toEqual(['jo.smith', 'Jo Smith', 'jo.smith@corp.com', expect.stringMatching(/^\$2/)]);
  });

  it('suffixes the username when the email local part is taken (AUTH-4)', async () => {
    dbWith({ takenUsernames: ['jo.smith'] });
    const res = await POST(req(GOOD) as any);
    expect(res.status).toBe(201);
    expect((await res.json()).user.username).toMatch(/^jo\.smith-[0-9a-f]{6}$/);
  });

  it('retries with a new username when the insert races on the username key', async () => {
    dbWith();
    vi.mocked(db.insert)
      .mockRejectedValueOnce(Object.assign(new Error("Duplicate entry 'jo.smith' for key 'account.username'"), { code: 'ER_DUP_ENTRY' }))
      .mockResolvedValueOnce(43);
    const res = await POST(req(GOOD) as any);
    expect(res.status).toBe(201);
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it('rejects a malformed email', async () => {
    dbWith();
    for (const email of ['not-an-email', 'a@b', 'a b@c.com', 'x@y.z']) {
      const res = await POST(req({ ...GOOD, email }) as any);
      expect(res.status).toBe(400);
    }
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects non-string fields', async () => {
    dbWith();
    expect((await POST(req({ ...GOOD, email: ['a@b.co'] }) as any)).status).toBe(400);
    expect((await POST(req({ ...GOOD, password: 12345678 }) as any)).status).toBe(400);
    expect((await POST(req({ ...GOOD, full_name: { a: 1 } }) as any)).status).toBe(400);
    expect((await POST(req('{bad json') as any)).status).toBe(400);
  });

  it('enforces password length (8 chars, at most 72 bytes for bcrypt)', async () => {
    dbWith();
    expect((await POST(req({ ...GOOD, password: 'short1' }) as any)).status).toBe(400);
    expect((await POST(req({ ...GOOD, password: 'a1'.repeat(40) }) as any)).status).toBe(400);
  });

  it('a registered email gets a generic message, not "Email already registered"', async () => {
    dbWith({ takenEmails: ['jo.smith@corp.com'] });
    const res = await POST(req(GOOD) as any);
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error).not.toMatch(/already registered|taken/i);
    expect(error).toMatch(/log in/i);
  });

  it('an email that races in at insert time gets the same generic message', async () => {
    dbWith();
    vi.mocked(db.insert).mockRejectedValue(
      Object.assign(new Error("Duplicate entry 'x' for key 'account.email'"), { code: 'ER_DUP_ENTRY' }),
    );
    const res = await POST(req(GOOD) as any);
    expect(res.status).toBe(409);
  });

  it('allows 3 signups per IP per hour, then 429', async () => {
    dbWith();
    for (let i = 0; i < 3; i++) {
      const r = await POST(req({ ...GOOD, email: `u${i}@corp.com` }, '203.0.113.50') as any);
      expect(r.status).toBe(201);
    }
    const fourth = await POST(req({ ...GOOD, email: 'u9@corp.com' }, '203.0.113.50') as any);
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get('Retry-After')).toBeTruthy();
  });

  it('does not leak internal error text', async () => {
    vi.mocked(db.exists).mockRejectedValue(new Error("Unknown column 'secret_col' in 'field list'"));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(req(GOOD) as any);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/secret_col|Unknown column/);
    spy.mockRestore();
  });
});
