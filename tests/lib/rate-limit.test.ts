import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MemoryRateLimitStore,
  UpstashRestRateLimitStore,
  setRateLimitStore,
  rateLimit,
  enforceRateLimit,
  clientIp,
  createRateLimitStoreFromEnv,
  readBodyCapped,
  declaredContentLength,
  PayloadTooLargeError,
  RATE_LIMITS,
  type RateLimitPolicy,
} from '@/lib/rate-limit';

const POLICY: RateLimitPolicy = { id: 'test', limit: 3, windowMs: 60_000 };

describe('MemoryRateLimitStore (sliding window)', () => {
  it('allows up to the limit, then denies with a retry-after', async () => {
    const store = new MemoryRateLimitStore();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      const r = await store.hit('k', POLICY, t0 + i);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(2 - i);
    }
    const denied = await store.hit('k', POLICY, t0 + 10);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    // The oldest hit (t0) leaves the window at t0 + 60s.
    expect(denied.retryAfterMs).toBe(60_000 - 10);
  });

  it('frees a slot once the oldest hit slides out of the window', async () => {
    const store = new MemoryRateLimitStore();
    const t0 = 5_000_000;
    await store.hit('k', POLICY, t0);
    await store.hit('k', POLICY, t0 + 1000);
    await store.hit('k', POLICY, t0 + 2000);
    expect((await store.hit('k', POLICY, t0 + 59_999)).allowed).toBe(false);
    expect((await store.hit('k', POLICY, t0 + 60_000)).allowed).toBe(true);
  });

  it('keeps keys independent', async () => {
    const store = new MemoryRateLimitStore();
    for (let i = 0; i < 3; i++) await store.hit('a', POLICY, 1);
    expect((await store.hit('a', POLICY, 2)).allowed).toBe(false);
    expect((await store.hit('b', POLICY, 2)).allowed).toBe(true);
  });

  it('drops expired keys on sweep so memory stays bounded', async () => {
    const store = new MemoryRateLimitStore({ maxKeys: 10_000 });
    await store.hit('old', POLICY, 0);
    await store.hit('fresh', POLICY, 120_000);
    store.sweep(120_000);
    expect(store.size()).toBe(1);
  });

  it('evicts the oldest keys when over maxKeys', async () => {
    const store = new MemoryRateLimitStore({ maxKeys: 2 });
    await store.hit('a', POLICY, 1);
    await store.hit('b', POLICY, 2);
    await store.hit('c', POLICY, 3);
    expect(store.size()).toBeLessThanOrEqual(2);
  });
});

describe('rateLimit / enforceRateLimit', () => {
  beforeEach(() => setRateLimitStore(new MemoryRateLimitStore()));

  it('builds the key from policy id and parts', async () => {
    const r1 = await rateLimit(POLICY, ['1.2.3.4', 'A@x.com']);
    expect(r1.allowed).toBe(true);
    // Email part is case-insensitive.
    await rateLimit(POLICY, ['1.2.3.4', 'a@X.com']);
    await rateLimit(POLICY, ['1.2.3.4', 'a@x.com']);
    const r4 = await rateLimit(POLICY, ['1.2.3.4', 'a@x.com']);
    expect(r4.allowed).toBe(false);
  });

  it('returns null while allowed and a 429 with Retry-After when not', async () => {
    for (let i = 0; i < 3; i++) expect(await enforceRateLimit(POLICY, ['u1'])).toBeNull();
    const res = await enforceRateLimit(POLICY, ['u1']);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const retry = Number(res!.headers.get('Retry-After'));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(60);
    const body = await res!.json();
    expect(body.error).toMatch(/too many/i);
  });

  it('merges extra body fields into the 429 payload', async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit(POLICY, ['u2']);
    const res = await enforceRateLimit(POLICY, ['u2'], { fallback: true });
    expect((await res!.json()).fallback).toBe(true);
  });

  it('fails open (allows) when the store throws', async () => {
    setRateLimitStore({
      hit: async () => {
        throw new Error('store down');
      },
    });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await enforceRateLimit(POLICY, ['u3'])).toBeNull();
    spy.mockRestore();
  });

  it('ships the documented policies', () => {
    expect(RATE_LIMITS.login).toMatchObject({ limit: 5, windowMs: 60_000 });
    expect(RATE_LIMITS.signup).toMatchObject({ limit: 3, windowMs: 3_600_000 });
    expect(RATE_LIMITS.insights).toMatchObject({ limit: 20, windowMs: 3_600_000 });
    expect(RATE_LIMITS.ingestPreview).toMatchObject({ limit: 10, windowMs: 3_600_000 });
    expect(RATE_LIMITS.assessments).toMatchObject({ limit: 30, windowMs: 3_600_000 });
    expect(RATE_LIMITS.pubchemEnrich).toMatchObject({ limit: 5, windowMs: 3_600_000 });
    // BLS / EIA / Metals lookups, one budget per user across the three.
    expect(RATE_LIMITS.costRates).toMatchObject({ id: 'cost-rates', limit: 60, windowMs: 3_600_000 });
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for hop', () => {
    const r = new Request('http://t/', { headers: { 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' } });
    expect(clientIp(r)).toBe('203.0.113.9');
  });
  it('falls back to x-real-ip, then "unknown"', () => {
    expect(clientIp(new Request('http://t/', { headers: { 'x-real-ip': '198.51.100.2' } }))).toBe('198.51.100.2');
    expect(clientIp(new Request('http://t/'))).toBe('unknown');
  });
});

describe('store selection from env', () => {
  it('uses memory by default', () => {
    expect(createRateLimitStoreFromEnv({})).toBeInstanceOf(MemoryRateLimitStore);
  });
  it('uses the Upstash REST store when its URL and token are set', () => {
    const s = createRateLimitStoreFromEnv({
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 't',
    });
    expect(s).toBeInstanceOf(UpstashRestRateLimitStore);
  });
  it('accepts Vercel KV variable names', () => {
    const s = createRateLimitStoreFromEnv({ KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' });
    expect(s).toBeInstanceOf(UpstashRestRateLimitStore);
  });
  it('RATE_LIMIT_STORE=memory forces memory', () => {
    const s = createRateLimitStoreFromEnv({
      RATE_LIMIT_STORE: 'memory',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 't',
    });
    expect(s).toBeInstanceOf(MemoryRateLimitStore);
  });
});

describe('UpstashRestRateLimitStore (fixed window over REST)', () => {
  it('INCRs a per-window key with an expiry and maps the count', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([{ result: 4 }, { result: 1 }]), { status: 200 }),
    );
    const store = new UpstashRestRateLimitStore('https://r.example/', 'tok', fetchImpl as any);
    const r = await store.hit('login:ip', POLICY, 125_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(180_000 - 125_000);
    const [url, init] = fetchImpl.mock.calls[0] as any[];
    expect(url).toBe('https://r.example/pipeline');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const cmds = JSON.parse(init.body);
    expect(cmds[0]).toEqual(['INCR', 'rl:login:ip:2']);
    expect(cmds[1]).toEqual(['PEXPIRE', 'rl:login:ip:2', '60000']);
  });

  it('throws on a non-2xx so the caller can fail open', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }));
    const store = new UpstashRestRateLimitStore('https://r.example', 'tok', fetchImpl as any);
    await expect(store.hit('k', POLICY, 1)).rejects.toThrow();
  });
});

describe('request-size guards', () => {
  it('reads the declared Content-Length', () => {
    const r = new Request('http://t/', { method: 'POST', headers: { 'content-length': '123' }, body: 'x' });
    expect(declaredContentLength(r)).toBe(123);
    expect(declaredContentLength(new Request('http://t/'))).toBeNull();
  });

  it('reads a body under the cap', async () => {
    const r = new Request('http://t/', { method: 'POST', body: 'hello' });
    const buf = await readBodyCapped(r, 10);
    expect(new TextDecoder().decode(buf)).toBe('hello');
  });

  it('stops reading and throws once the cap is passed, even without Content-Length', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++;
        if (pulled > 100) return c.close();
        c.enqueue(new Uint8Array(1024));
      },
    });
    const r = new Request('http://t/', { method: 'POST', body, duplex: 'half' } as any);
    await expect(readBodyCapped(r, 4096)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(pulled).toBeLessThan(10);
  });
});
