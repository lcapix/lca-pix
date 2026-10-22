/**
 * Per-file setup for tests/api-real (after tests/setup.ts and
 * tests/db/support/worker-env.ts, which point DATABASE_* at the throwaway
 * database). Runs before any test module imports lib/db.
 *
 * - Environment hygiene: the test JWT secret, localhost URLs, dummy Google
 *   client, no upstream API keys, and the in-memory rate-limit store.
 * - Outbound network: global fetch is the fixture mock in outbound.ts; a
 *   request to an unmocked host fails the test that made it.
 * - A fresh in-memory rate limiter before every test.
 * - The app's pool and the suite's own connection are closed after the file.
 */
import { afterAll, afterEach, beforeEach, expect, vi } from 'vitest';
import { mockedFetch, outbound, resetOutbound } from './outbound';

const LOCAL = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
if (!LOCAL.has(String(process.env.DATABASE_HOST).toLowerCase()) || !/^lcapix_t_/.test(String(process.env.DATABASE_NAME))) {
  throw new Error(
    `tests/api-real runs only against a local lcapix_t_* database (got ${process.env.DATABASE_HOST}/${process.env.DATABASE_NAME})`,
  );
}

process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3002';
process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.RATE_LIMIT_STORE = 'memory';
for (const key of [
  'HF_TOKEN',
  'HF_INSIGHTS_MODEL',
  'EIA_API_KEY',
  'BLS_API_KEY',
  'METALS_API_KEY',
  'ELECTRICITY_MAPS_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
]) {
  delete process.env[key];
}

vi.stubGlobal('fetch', mockedFetch);

// Route handlers log every handled failure with console.error / warn. The
// suite provokes thousands on purpose; keep the output readable.
if (process.env.API_TESTS_VERBOSE !== '1') {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
}

beforeEach(async () => {
  resetOutbound();
  const { MemoryRateLimitStore, setRateLimitStore } = await import('@/lib/rate-limit');
  setRateLimitStore(new MemoryRateLimitStore());
});

afterEach(() => {
  // Anything the fixture mock refused would have gone to the real network.
  expect(outbound.unmocked, 'outbound requests to hosts the suite does not mock').toEqual([]);
});

afterAll(async () => {
  const { closePool } = await import('@/lib/db');
  const { closeSql } = await import('./db');
  await closePool();
  await closeSql();
});
