/**
 * Preloaded into the e2e dev server (NODE_OPTIONS=--require …, set by
 * serve.mjs). The server may only talk to this machine and to Google Fonts
 * (next/font downloads Inter Tight and IBM Plex Mono when it compiles the root
 * layout). Everything else — Hugging Face, BLS/EIA/metals lookups, PubChem,
 * Google OAuth, Upstash, the npm registry version check — fails fast with a
 * network error, so a test can never reach a real service by accident.
 *
 * The browser side has its own guard (tests/e2e/support/net.ts).
 */
'use strict';

const http = require('node:http');
const https = require('node:https');

const ALLOWED = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

const reported = new Set();
function refuse(host, via) {
  if (!reported.has(host)) {
    reported.add(host);
    process.stderr.write(`[e2e block-outbound] refused ${via} request to ${host}\n`);
  }
  const err = new TypeError(`e2e: outbound request to ${host} is blocked`);
  err.code = 'E2E_BLOCKED';
  return err;
}

function hostOf(value) {
  try {
    if (!value) return '';
    if (typeof value === 'string') return new URL(value).hostname;
    if (value instanceof URL) return value.hostname;
    if (typeof value.url === 'string') return new URL(value.url).hostname;
    return String(value.hostname || value.host || '').replace(/:\d+$/, '');
  } catch {
    return '';
  }
}

const realFetch = globalThis.fetch;
if (typeof realFetch === 'function') {
  globalThis.fetch = function guardedFetch(input, init) {
    const host = hostOf(input);
    if (host && !ALLOWED.has(host)) return Promise.reject(refuse(host, 'fetch'));
    return realFetch.call(this, input, init);
  };
}

for (const [name, mod] of [['http', http], ['https', https]]) {
  for (const fn of ['request', 'get']) {
    const real = mod[fn];
    mod[fn] = function guarded(...args) {
      const first = args[0];
      const host =
        typeof first === 'string' || first instanceof URL
          ? hostOf(first)
          : hostOf(first && (first.hostname || first.host) ? first : args[1]);
      if (host && !ALLOWED.has(host)) throw refuse(host, `${name}.${fn}`);
      return real.apply(this, args);
    };
  }
}
