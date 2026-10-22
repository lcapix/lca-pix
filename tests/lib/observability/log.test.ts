import { afterEach, describe, expect, it, vi } from 'vitest';
import { installJsonConsole } from '@/lib/observability/console-json';
import { isLogLine, logLine, redact, serializeError } from '@/lib/observability/log';
import { reportError, setErrorSink } from '@/lib/observability/report';

describe('structured logs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setErrorSink(null);
  });

  it('masks email addresses', () => {
    expect(redact("Duplicate entry 'ana.b@uni.edu' for key 'users.email'")).toBe("Duplicate entry '[email]' for key 'users.email'");
  });

  it('keeps an error\'s name, message and codes, never its SQL', () => {
    const e = Object.assign(new Error("Unknown column 'x'"), { code: 'ER_BAD_FIELD_ERROR', errno: 1054, sqlState: '42S22', sql: "SELECT x FROM users WHERE email='a@b.co'" });
    const s = serializeError(e);
    expect(s).toMatchObject({ name: 'Error', message: "Unknown column 'x'", code: 'ER_BAD_FIELD_ERROR', errno: 1054, sqlState: '42S22' });
    expect(JSON.stringify(s)).not.toContain('SELECT');
  });

  it('writes one JSON object a line, starting with level', () => {
    const line = logLine('error', 'GET /api/x', { request_id: 'r1', err: new Error('boom for z@y.io'), skip: undefined });
    expect(isLogLine(line)).toBe(true);
    const o = JSON.parse(line);
    expect(o).toMatchObject({ level: 'error', event: 'GET /api/x', request_id: 'r1', err: { message: 'boom for [email]' } });
    expect('skip' in o).toBe(false);
    expect(Number.isNaN(Date.parse(o.time))).toBe(false);
  });

  it('reportError marks the line as an alert and hands the error to a sink, if one is set', () => {
    const out = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn(() => {
      throw new Error('monitor down');
    });
    setErrorSink(sink);
    const err = new Error('x');
    expect(() => reportError(err, { event: 'label', request_id: 'r2' })).not.toThrow();
    expect(sink).toHaveBeenCalledWith(err, { event: 'label', request_id: 'r2' });
    expect(JSON.parse(out.mock.calls[0][0] as string)).toMatchObject({ level: 'error', event: 'label', alert: true, request_id: 'r2' });
  });

  it('the production console turns free text into one structured line, and passes structured lines through', () => {
    const writes: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void writes.push(a));
    vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => void writes.push(a));
    installJsonConsole();
    console.error('Get substances error:', new Error('ECONNRESET'));
    console.warn('slow query', { ms: 900 });
    const already = logLine('info', 'kept');
    console.error(already);
    expect(writes).toHaveLength(3);
    expect(JSON.parse(writes[0][0] as string)).toMatchObject({ level: 'error', event: 'console', alert: true, msg: 'Get substances error:', err: { message: 'ECONNRESET' } });
    expect(JSON.parse(writes[1][0] as string)).toMatchObject({ level: 'warn', event: 'console', msg: 'slow query {"ms":900}' });
    expect(writes[2][0]).toBe(already);
  });
});
