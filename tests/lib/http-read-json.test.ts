import { describe, expect, it } from 'vitest';
import { readJson } from '@/lib/http';

const req = (body?: string) =>
  new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body }),
  });

describe('readJson', () => {
  it('returns the parsed object', async () => {
    const r = await readJson(req('{"a":1,"b":"x"}'));
    expect(r).toEqual({ ok: true, body: { a: 1, b: 'x' } });
  });

  it.each(['{not json', '{"a":', '\u0000\u0001', ''])('answers 400 "Invalid JSON body" for %j', async (raw) => {
    const r = await readJson(req(raw));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(400);
    expect(await r.response.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it.each(['"just a string"', '[]', '[1,2]', 'null', '42', 'true'])('answers 400 for valid JSON that is not an object: %s', async (raw) => {
    const r = await readJson(req(raw));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(400);
    expect(await r.response.json()).toEqual({ error: 'Request body must be a JSON object' });
  });

  it('treats a missing or blank body as {} when the body is optional', async () => {
    expect(await readJson(req(), { optional: true })).toEqual({ ok: true, body: {} });
    expect(await readJson(req('  \n'), { optional: true })).toEqual({ ok: true, body: {} });
  });

  it('still refuses malformed JSON when the body is optional', async () => {
    const r = await readJson(req('{oops'), { optional: true });
    expect(r.ok).toBe(false);
  });

  it('never echoes the body back', async () => {
    const r = await readJson(req('{"secret": SELECT password_hash'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(await r.response.text()).not.toContain('password_hash');
  });
});
