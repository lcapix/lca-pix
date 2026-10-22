/**
 * Structured server logs: one JSON object per line, so Vercel's log view and
 * any log drain read fields (level, event, request_id, err.code) instead of
 * free text. Email addresses are masked in every message and error text; a
 * Duplicate-entry SQL error, for one, carries the address it collided on.
 *
 * Lines go out through console.log / console.error at call time, so a test
 * that silences the console silences these too. In production
 * instrumentation.ts formats the remaining free-text console calls the same
 * way (console-json.ts) and passes lines that are already structured through.
 */

export type Level = 'info' | 'warn' | 'error';
export type SerializedError = { name: string; message: string; code?: string; errno?: number; sqlState?: string; stack?: string };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redact(text: string): string {
  return text.replace(EMAIL, '[email]');
}

/** The useful, non-sensitive parts of an error. Never the SQL text, which can carry values. */
export function serializeError(err: unknown): SerializedError {
  if (!(err instanceof Error)) return { name: 'NonError', message: redact(String(err)).slice(0, 1000) };
  const e = err as Error & { code?: unknown; errno?: unknown; sqlState?: unknown };
  return {
    name: e.name,
    message: redact(e.message).slice(0, 1000),
    ...(typeof e.code === 'string' ? { code: e.code } : {}),
    ...(typeof e.errno === 'number' ? { errno: e.errno } : {}),
    ...(typeof e.sqlState === 'string' ? { sqlState: e.sqlState } : {}),
    ...(e.stack ? { stack: redact(e.stack).split('\n').slice(0, 12).join('\n') } : {}),
  };
}

export function logLine(level: Level, event: string, fields: Record<string, unknown> = {}): string {
  const body: Record<string, unknown> = { level, event, time: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    body[k] = k === 'err' ? serializeError(v) : typeof v === 'string' ? redact(v) : v;
  }
  try {
    return JSON.stringify(body);
  } catch {
    return JSON.stringify({ level, event, time: body.time, note: 'fields could not be serialised' });
  }
}

export function log(level: Level, event: string, fields?: Record<string, unknown>): void {
  const line = logLine(level, event, fields);
  if (level === 'info') console.log(line);
  else console[level](line);
}

/** True for a line this module wrote (console-json.ts passes these through untouched). */
export function isLogLine(arg: unknown): boolean {
  return typeof arg === 'string' && arg.startsWith('{"level":"');
}
