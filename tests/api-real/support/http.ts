/**
 * Calling a route handler the way Next does: a NextRequest (headers, body,
 * cookies) and a context whose `params` is a Promise. No server runs.
 *
 * Every 4xx/5xx body that passes through `call()` is scanned for signs of an
 * internal error reaching the client (SQL error codes and text, a stack
 * frame, the database product name). A hit fails the calling test on the
 * spot, so the scan covers every error response the suite produces. A test
 * that probes a leak on purpose passes `allowLeak: true` and asserts itself.
 */
import { NextRequest } from 'next/server';

export const BASE_URL = 'http://localhost:3002';

export type RouteHandler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  /** Bearer token; null/undefined sends no Authorization header. */
  token?: string | null;
  /** JSON body (serialised, content-type set). */
  json?: unknown;
  /** Raw string body (content-type application/json unless headers say otherwise). */
  raw?: string;
  /** Multipart body. */
  form?: FormData;
  /** Any other body. */
  body?: BodyInit;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  /** Route params (default: none). */
  params?: Record<string, string>;
  /** Client IP (x-forwarded-for). */
  ip?: string;
  /** Skip the leak scan: the test inspects the error body itself. */
  allowLeak?: boolean;
}

export interface ApiResponse {
  status: number;
  headers: Headers;
  /** Body decoded as UTF-8. */
  text: string;
  /** Parsed JSON, or undefined when the body is not JSON. */
  json: any;
  bytes: Uint8Array;
}

/**
 * What an internal error looks like when it reaches a client. `at ` from the
 * brief is matched as a stack frame ("at fn (file:1:2)"), since plain prose
 * such as "That placement…" contains the two letters too.
 */
export const LEAK_PATTERNS: RegExp[] = [
  /\bER_[A-Z0-9_]{3,}/,
  /\bSELECT\b/,
  /\bINSERT INTO\b/,
  /\bUPDATE\s+`?\w+`?\s+SET\b/,
  /\bDELETE FROM\b/,
  /mysql/i,
  /sqlMessage|sqlState|Unknown column|SQL syntax|Duplicate entry|Data too long|Out of range value|Incorrect \w+ value/i,
  /^\s*at\s+\S+.*\(.*:\d+:\d+\)\s*$/m,
  /\bat\s+[\w$.<>\[\] ]+\s+\((?:file:|node:|\/)[^)]*\)/,
  /\bat\s+(?:file:\/\/|\/)[^\s]+:\d+:\d+/,
  /\.(?:ts|tsx|js|mjs):\d+:\d+/,
  /rds\.amazonaws\.com/i,
  /ECONNREFUSED|ETIMEDOUT/,
];

export const leakScan = { scanned: 0, errorStatuses: {} as Record<number, number> };

export function findLeak(text: string): string | null {
  for (const re of LEAK_PATTERNS) {
    const m = re.exec(text);
    if (m) return `${re} matched "${m[0]}"`;
  }
  return null;
}

let ipSeq = 0;
/** A client IP nobody else in this worker uses (keeps per-IP limits apart). */
export function freshIp(): string {
  ipSeq++;
  return `10.${(process.pid >> 8) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`;
}

export function buildRequest(method: string, url: string, opts: CallOptions = {}): NextRequest {
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? '203.0.113.10', ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cookies && Object.keys(opts.cookies).length) {
    headers.cookie = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers['content-type'] ??= 'application/json';
  } else if (opts.raw !== undefined) {
    body = opts.raw;
    headers['content-type'] ??= 'application/json';
  } else if (opts.body !== undefined) body = opts.body;
  const full = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const init: any = { method, headers, body };
  if (body instanceof ReadableStream) init.duplex = 'half';
  return new NextRequest(full, init);
}

export async function readResponse(res: Response): Promise<ApiResponse> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  let json: any;
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('json') || /^\s*[{[]/.test(text.slice(0, 16))) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  return { status: res.status, headers: res.headers, text, json, bytes };
}

/** Send one request to a handler and read the whole response. */
export async function call(
  handler: RouteHandler,
  method: string,
  url: string,
  opts: CallOptions = {},
): Promise<ApiResponse> {
  const req = buildRequest(method, url, opts);
  const params = opts.params ?? {};
  const res = await handler(req, { params: Promise.resolve(params) });
  const out = await readResponse(res);
  if (out.status >= 400) {
    leakScan.scanned++;
    leakScan.errorStatuses[out.status] = (leakScan.errorStatuses[out.status] ?? 0) + 1;
    if (!opts.allowLeak) {
      const leak = findLeak(out.text);
      if (leak) {
        throw new Error(`${method} ${url} answered ${out.status} with internal detail (${leak}): ${out.text.slice(0, 300)}`);
      }
    }
  }
  return out;
}

/** Parse Set-Cookie headers into { name: { value, attrs } } (attrs lower-cased). */
export function setCookies(headers: Headers): Record<string, { value: string; attrs: string; raw: string }> {
  const out: Record<string, { value: string; attrs: string; raw: string }> = {};
  for (const line of headers.getSetCookie()) {
    const [pair, ...rest] = line.split(';');
    const i = pair.indexOf('=');
    out[pair.slice(0, i).trim()] = {
      value: decodeURIComponent(pair.slice(i + 1)),
      attrs: rest.map((s) => s.trim()).join('; ').toLowerCase(),
      raw: line,
    };
  }
  return out;
}
