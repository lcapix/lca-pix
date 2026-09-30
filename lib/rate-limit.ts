/**
 * Rate limiting and request-size guards for the API routes.
 *
 * A limit is a policy (N requests per window) applied to a key built from the
 * caller (IP, user id, email). `enforceRateLimit` returns null when the request
 * may go ahead, or a ready 429 response with `Retry-After` when it may not.
 *
 *   const limited = await enforceRateLimit(RATE_LIMITS.insights, [userId]);
 *   if (limited) return limited;
 *
 * Storage is pluggable. The default in-memory store is a sliding-window log in
 * a Map with TTL cleanup. It is per process: on Vercel each warm instance has
 * its own counts, so the effective limit is "N per window per instance". That
 * still stops a single client hammering one instance, and it costs nothing.
 * For a limit shared across instances, set either
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or
 *   KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV, which is Upstash)
 * and the REST store below is used instead (fixed window, plain fetch, no SDK).
 * RATE_LIMIT_STORE=memory forces the in-memory store. Anything else can be
 * plugged in at startup with `setRateLimitStore()`.
 *
 * If the store fails (network, quota) the request is allowed and a warning is
 * logged: a broken limiter must not lock every user out of login.
 *
 * Client IP: the first `x-forwarded-for` hop, then `x-real-ip`. Vercel sets
 * these itself; behind no proxy (a bare Docker deploy) the header is client
 * controlled, so per-IP limits there need a proxy that overwrites it.
 */
import { NextResponse } from 'next/server';

export interface RateLimitPolicy {
  /** Short id, used as the key prefix (e.g. 'login'). */
  id: string;
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until another request would be allowed (0 when allowed). */
  retryAfterMs: number;
}

/** A backing store: record one hit for `key` under `policy` at time `now`. */
export interface RateLimitStore {
  hit(key: string, policy: RateLimitPolicy, now: number): Promise<RateLimitResult>;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The limits the app applies. Assessments and PubChem enrichment are defined
 * here for the routes that will adopt them; the rest are wired already.
 */
export const RATE_LIMITS = {
  /** Per IP + email. */
  login: { id: 'login', limit: 5, windowMs: MINUTE },
  /** Per IP. */
  signup: { id: 'signup', limit: 3, windowMs: HOUR },
  /** Per user: each call streams from the paid Hugging Face router. */
  insights: { id: 'insights', limit: 20, windowMs: HOUR },
  /** Per user: each upload can fan out to several LLM calls. */
  ingestPreview: { id: 'ingest-preview', limit: 10, windowMs: HOUR },
  /** Per user: one run holds a DB transaction for the whole engine pass. */
  assessments: { id: 'assessments', limit: 30, windowMs: HOUR },
  /** Per user: one call can make hundreds of PubChem requests. */
  pubchemEnrich: { id: 'pubchem-enrich', limit: 5, windowMs: HOUR },
  /** Per user, shared by the BLS / EIA / Metals rate lookups (upstream quotas). */
  costRates: { id: 'cost-rates', limit: 60, windowMs: HOUR },
} satisfies Record<string, RateLimitPolicy>;

// ── In-memory store ──────────────────────────────────────────────────────────

interface Entry {
  hits: number[]; // ascending timestamps inside the window
  windowMs: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private entries = new Map<string, Entry>();
  private readonly maxKeys: number;
  private readonly sweepEveryMs: number;
  private lastSweep = 0;

  constructor(opts: { maxKeys?: number; sweepEveryMs?: number } = {}) {
    this.maxKeys = opts.maxKeys ?? 50_000;
    this.sweepEveryMs = opts.sweepEveryMs ?? MINUTE;
  }

  async hit(key: string, policy: RateLimitPolicy, now: number): Promise<RateLimitResult> {
    if (now - this.lastSweep >= this.sweepEveryMs) this.sweep(now);

    const cutoff = now - policy.windowMs;
    const entry = this.entries.get(key) ?? { hits: [], windowMs: policy.windowMs };
    entry.windowMs = policy.windowMs;
    while (entry.hits.length && entry.hits[0] <= cutoff) entry.hits.shift();

    if (entry.hits.length >= policy.limit) {
      this.entries.set(key, entry);
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterMs: Math.max(1, entry.hits[0] + policy.windowMs - now),
      };
    }

    entry.hits.push(now);
    // Re-insert so Map order tracks recency (oldest first for eviction).
    this.entries.delete(key);
    this.entries.set(key, entry);
    if (this.entries.size > this.maxKeys) this.evict(now);

    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit - entry.hits.length,
      retryAfterMs: 0,
    };
  }

  /** Drop keys whose every hit has left its window. */
  sweep(now: number): void {
    this.lastSweep = now;
    for (const [key, entry] of this.entries) {
      const last = entry.hits[entry.hits.length - 1];
      if (last === undefined || last <= now - entry.windowMs) this.entries.delete(key);
    }
  }

  size(): number {
    return this.entries.size;
  }

  private evict(now: number): void {
    this.sweep(now);
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxKeys) break;
      this.entries.delete(key);
    }
  }
}

// ── Upstash / Vercel KV REST store ───────────────────────────────────────────

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Fixed-window counter over the Upstash Redis REST API: one pipeline call,
 * INCR on a key per window, PEXPIRE so it cleans itself up.
 */
export class UpstashRestRateLimitStore implements RateLimitStore {
  private readonly baseUrl: string;

  constructor(
    url: string,
    private readonly token: string,
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  async hit(key: string, policy: RateLimitPolicy, now: number): Promise<RateLimitResult> {
    const window = Math.floor(now / policy.windowMs);
    const redisKey = `rl:${key}:${window}`;
    const res = await this.fetchImpl(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(policy.windowMs)],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`rate-limit store HTTP ${res.status}`);
    const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(out?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error('rate-limit store returned no count');
    const allowed = count <= policy.limit;
    return {
      allowed,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - count),
      retryAfterMs: allowed ? 0 : (window + 1) * policy.windowMs - now,
    };
  }
}

// ── Store selection ──────────────────────────────────────────────────────────

export function createRateLimitStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): RateLimitStore {
  if (env.RATE_LIMIT_STORE === 'memory') return new MemoryRateLimitStore();
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (url && token) return new UpstashRestRateLimitStore(url, token);
  return new MemoryRateLimitStore();
}

let store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (!store) store = createRateLimitStoreFromEnv();
  return store;
}

/** Replace the backing store (a shared store at startup, a fresh one in tests). */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next;
}

// ── Public helpers ───────────────────────────────────────────────────────────

/** First `x-forwarded-for` hop, then `x-real-ip`, else 'unknown'. */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  if (first) return first;
  const real = request.headers.get('x-real-ip')?.trim();
  return real || 'unknown';
}

function keyFor(policy: RateLimitPolicy, parts: Array<string | number>): string {
  return [policy.id, ...parts.map((p) => String(p).trim().toLowerCase())].join(':');
}

/** Record one request against `policy` for the caller identified by `parts`. */
export async function rateLimit(
  policy: RateLimitPolicy,
  parts: Array<string | number>,
): Promise<RateLimitResult> {
  try {
    return await getStore().hit(keyFor(policy, parts), policy, Date.now());
  } catch (err: any) {
    console.warn(`[rate-limit] store error, allowing request (${policy.id}):`, err?.message ?? err);
    return { allowed: true, limit: policy.limit, remaining: policy.limit, retryAfterMs: 0 };
  }
}

/** A 429 carrying Retry-After (seconds) and the usual X-RateLimit headers. */
export function rateLimitResponse(
  result: RateLimitResult,
  extra: Record<string, unknown> = {},
): NextResponse {
  const retryAfter = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return NextResponse.json(
    {
      error: `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
      retry_after: retryAfter,
      ...extra,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

/** null when the request may proceed; otherwise the 429 to return. */
export async function enforceRateLimit(
  policy: RateLimitPolicy,
  parts: Array<string | number>,
  extra?: Record<string, unknown>,
): Promise<NextResponse | null> {
  const result = await rateLimit(policy, parts);
  return result.allowed ? null : rateLimitResponse(result, extra);
}

// ── Request-size guards ──────────────────────────────────────────────────────

export class PayloadTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = 'PayloadTooLargeError';
  }
}

/** The declared Content-Length, or null when absent or malformed. */
export function declaredContentLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (raw === null || !/^\d+$/.test(raw.trim())) return null;
  return Number(raw);
}

/**
 * Read the body, giving up as soon as it passes `maxBytes`. Covers chunked
 * uploads that declare no Content-Length, which a header check alone misses.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = declaredContentLength(request);
  if (declared !== null && declared > maxBytes) throw new PayloadTooLargeError(maxBytes);
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
