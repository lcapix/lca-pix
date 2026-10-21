/**
 * GET /api/health: for an uptime monitor and the post-deploy smoke test.
 * Public, cheap (one SELECT 1, given 3 s), never cached. Says whether the
 * database answers and which commit is running; nothing about where the
 * database is or what it holds. 200 when healthy, 503 when the database is not.
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = performance.now();
  let db: 'ok' | 'down' = 'ok';
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
  } catch {
    db = 'down';
  }
  return NextResponse.json(
    {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      ms: Math.round(performance.now() - started),
    },
    { status: db === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
