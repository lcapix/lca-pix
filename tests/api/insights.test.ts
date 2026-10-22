import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/insights/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import * as guard from '@/lib/route-guard';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/route-guard', async (orig) => ({ ...(await orig<any>()), caseAccessDenied: vi.fn() }));

/** The run a narration is about (education 2.13): reachable, in a project with AI on. */
let project = { ai_enabled: 1 };
let cached: { reply: string; model: string } | null = null;
function runAndCache() {
  vi.mocked(guard.caseAccessDenied).mockResolvedValue(null);
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
    if (/FROM assessment_runs r/.test(sql)) return { case_id: 3, ...project } as any;
    if (/FROM insight_cache/.test(sql)) return cached as any;
    return null;
  });
  vi.mocked(db.execute).mockResolvedValue(1 as any);
}

const FACTS = {
  run_id: 41,
  caseName: 'Bracket',
  method: 'CML 2001',
  categoryLabel: 'Global Warming',
  contributors: [{ name: 'Paint', pct: 60, value: 6 }],
  mode: 'summary',
};

const enc = new TextEncoder();

/** An upstream SSE body that yields `parts` one read at a time. */
function sse(parts: string[]) {
  let i = 0;
  const reads = { count: 0 };
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      reads.count++;
      if (i < parts.length) c.enqueue(enc.encode(parts[i++]));
      else c.close();
    },
  });
  return { body, reads };
}

function req(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://t/api/insights', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer x', ...headers },
    body: text,
  });
}

async function readAll(res: Response, ms = 1500): Promise<string> {
  return Promise.race([
    res.text(),
    new Promise<string>((_, rej) => setTimeout(() => rej(new Error(`stream stalled for ${ms}ms`)), ms)),
  ]);
}

describe('POST /api/insights', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    process.env.HF_TOKEN = 'hf_test';
    setRateLimitStore(new MemoryRateLimitStore());
    project = { ai_enabled: 1 };
    cached = null;
    runAndCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.HF_TOKEN;
  });

  describe('SSE to text stream (INS-1)', () => {
    it('streams content that arrives after role-only and reasoning deltas', async () => {
      const { body } = sse([
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"reasoning":"thinking..."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
      vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
      const res = await POST(req(FACTS) as any);
      expect(res.headers.get('content-type')).toMatch(/text\/plain/);
      expect(await readAll(res)).toBe('Hello');
    });

    it('survives keep-alive comments and an event split across reads', async () => {
      const { body } = sse([
        ': keep-alive\n\n',
        'data: {"choices":[{"delta":{"content":"Hel',
        'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":", world"}}]}\n',
        '\ndata: [DONE]\n\n',
      ]);
      vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
      expect(await readAll(await POST(req(FACTS) as any))).toBe('Hello, world');
    });

    it('closes when upstream ends without [DONE]', async () => {
      const { body } = sse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n']);
      vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
      expect(await readAll(await POST(req(FACTS) as any))).toBe('Hi');
    });
  });

  describe('limits (INS-2, H5)', () => {
    it('413 when Content-Length is over 16 KB, before reading or calling the model', async () => {
      const f = vi.fn();
      vi.stubGlobal('fetch', f);
      const res = await POST(req(FACTS, { 'content-length': String(16 * 1024 + 1) }) as any);
      expect(res.status).toBe(413);
      expect(f).not.toHaveBeenCalled();
    });

    it('413 when an oversized body arrives without a usable Content-Length', async () => {
      const f = vi.fn();
      vi.stubGlobal('fetch', f);
      const big = JSON.stringify({ ...FACTS, caseName: 'x'.repeat(20_000) });
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode(big));
          c.close();
        },
      });
      const r = new Request('http://t/api/insights', {
        method: 'POST',
        headers: { authorization: 'Bearer x' },
        body: stream,
        duplex: 'half',
      } as any);
      const res = await POST(r as any);
      expect(res.status).toBe(413);
      expect(f).not.toHaveBeenCalled();
    });

    it('400 for a question over 500 characters', async () => {
      const f = vi.fn();
      vi.stubGlobal('fetch', f);
      const res = await POST(req({ ...FACTS, mode: 'custom', question: 'q'.repeat(501) }) as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.fallback).toBe(true);
      expect(f).not.toHaveBeenCalled();
    });

    it('caps the contributors sent to the model', async () => {
      const { body } = sse(['data: [DONE]\n\n']);
      const f = vi.fn(async () => new Response(body, { status: 200 }));
      vi.stubGlobal('fetch', f);
      const contributors = Array.from({ length: 200 }, (_, i) => ({ name: `s${i}`, pct: 0.5, value: 1 }));
      await POST(req({ ...FACTS, contributors }) as any);
      const sent = JSON.parse((f.mock.calls[0] as any[])[1].body);
      const userMsg: string = sent.messages[1].content;
      expect(userMsg).toContain('s24:');
      expect(userMsg).not.toContain('s25:');
    });

    it('allows 20 narrations per user per hour, then 429 with a fallback signal', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(sse(['data: [DONE]\n\n']).body, { status: 200 })));
      for (let i = 0; i < 20; i++) {
        const r = await POST(req(FACTS) as any);
        expect(r.status).toBe(200);
        await r.text();
      }
      const res = await POST(req(FACTS) as any);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeTruthy();
      expect((await res.json()).fallback).toBe(true);
      // Another user has their own budget.
      vi.mocked(auth.requireAuth).mockResolvedValue(8);
      expect((await POST(req(FACTS) as any)).status).toBe(200);
    });

    it('does not spend the rate limit when no model key is configured', async () => {
      delete process.env.HF_TOKEN;
      for (let i = 0; i < 25; i++) {
        const r = await POST(req(FACTS) as any);
        expect((await r.json()).fallback).toBe(true);
        expect(r.status).toBe(200);
      }
    });

    it('401 when not signed in', async () => {
      vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
      expect((await POST(req(FACTS) as any)).status).toBe(401);
    });
  });

  describe('the run, the AI switch and the cache (education 2.13)', () => {
    const upstream = () => {
      const fetchMock = vi.fn(async () =>
        new Response(sse(['data: {"choices":[{"delta":{"content":"Paint is 60% of it."}}]}\n\n', 'data: [DONE]\n\n']).body, { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    };

    it('no run: the computed insight, nothing sent', async () => {
      const fetchMock = upstream();
      const { run_id: _r, ...noRun } = FACTS;
      const res = await POST(req(noRun) as any);
      expect(await res.json()).toMatchObject({ fallback: true, reason: 'no run' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('a run the caller cannot reach is 404, and nothing is sent', async () => {
      const fetchMock = upstream();
      vi.mocked(guard.caseAccessDenied).mockResolvedValue(new Response(JSON.stringify({ error: 'Run not found' }), { status: 404 }) as any);
      const res = await POST(req(FACTS) as any);
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("AI switched off for the project: the computed insight, and the run's figures never leave", async () => {
      const fetchMock = upstream();
      project = { ai_enabled: 0 };
      const res = await POST(req(FACTS) as any);
      expect(await res.json()).toMatchObject({ fallback: true, ai: 'off' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('a checked reply is kept for the run; asking again reads it back without a model call or the allowance', async () => {
      const fetchMock = upstream();
      const first = await POST(req(FACTS) as any);
      expect(first.headers.get('x-insights-cache')).toBe('miss');
      expect(await first.text()).toBe('Paint is 60% of it.');
      const kept = vi.mocked(db.execute).mock.calls.find(([sql]) => /INSERT INTO insight_cache .* ON CONFLICT DO NOTHING/.test(String(sql)));
      expect(kept?.[1]).toEqual([41, expect.stringMatching(/^[0-9a-f]{64}$/), expect.any(String), 'Paint is 60% of it.']);

      cached = { reply: 'Paint is 60% of it.', model: 'm' };
      fetchMock.mockClear();
      delete process.env.HF_TOKEN; // a kept reply needs no key
      const again = await POST(req(FACTS) as any);
      expect(again.headers.get('x-insights-cache')).toBe('hit');
      expect(await again.text()).toBe('Paint is 60% of it.');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
