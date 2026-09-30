import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { structureWithLLM, CHUNK_CHARS, MAX_CHUNKS, chunkText } from '@/lib/ingest/llm-structure';

const MODEL_JSON = {
  product_name: 'Bike',
  case_name: 'Ingested: Bike',
  nodes: [
    { name: 'Bike', tier: 'product', parent: null, description: '', quantity: null, unit: null },
    { name: 'Cut tubes', tier: 'operation', parent: 'Bike', description: '', quantity: null, unit: null },
  ],
  flows: [],
  costs: [],
  notes: [],
};

const ok = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(MODEL_JSON) } }] }), { status: 200 });

/** Text that splits into exactly `n` parts. */
function textOf(n: number): string {
  const line = 'Operation text line for the routing sheet.\n';
  const perPart = Math.floor((CHUNK_CHARS - 100) / line.length);
  return line.repeat(perPart * n);
}

describe('structureWithLLM network handling (ING-10)', () => {
  beforeEach(() => {
    process.env.HF_TOKEN = 'hf_test';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.HF_TOKEN;
  });

  it('keeps the parts that worked when one part has a network error', async () => {
    expect(chunkText(textOf(2)).length).toBe(2);
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) throw new TypeError('fetch failed');
      return ok();
    }));
    const pm = await structureWithLLM(textOf(2), 'routing', 'r.pdf');
    expect(pm.nodes.some((n) => n.name === 'Cut tubes')).toBe(true);
    expect(pm.notes.join(' ')).toMatch(/Part 1 of 2 could not be read/);
  });

  it('aborts a part that exceeds the per-part timeout', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: any) => {
      call++;
      if (call === 1) {
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
        });
      }
      return Promise.resolve(ok());
    }));
    const started = Date.now();
    const pm = await structureWithLLM(textOf(2), 'routing', 'r.pdf', { partTimeoutMs: 50 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(pm.notes.join(' ')).toMatch(/Part 1 of 2 could not be read: .*timed out/i);
  });

  it('passes an abort signal to every model call', async () => {
    const f = vi.fn(async () => ok());
    vi.stubGlobal('fetch', f);
    await structureWithLLM(textOf(1), 'routing', 'r.pdf');
    expect((f.mock.calls[0] as any[])[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('throws a clear error without upstream text when every part fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('secret upstream stack trace', { status: 500 })));
    const err = await structureWithLLM(textOf(2), 'routing', 'r.pdf').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/HTTP 500/);
    expect(err.message).not.toMatch(/secret upstream/);
  });

  it('never makes more than MAX_CHUNKS model calls', async () => {
    const f = vi.fn(async () => ok());
    vi.stubGlobal('fetch', f);
    const pm = await structureWithLLM(textOf(MAX_CHUNKS + 4), 'routing', 'r.pdf');
    expect(f.mock.calls.length).toBe(MAX_CHUNKS);
    expect(pm.notes.join(' ')).toMatch(new RegExp(`Only the first ${MAX_CHUNKS} of`));
  });

  it('skips parts that would start after the overall budget', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 60));
      return ok();
    }));
    const pm = await structureWithLLM(textOf(8), 'routing', 'r.pdf', { budgetMs: 30, concurrency: 1 });
    expect(pm.notes.join(' ')).toMatch(/not read: the time budget/i);
  });
});
