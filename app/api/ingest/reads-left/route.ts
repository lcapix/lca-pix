import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';
import { RATE_LIMITS, rateLimitStatus } from '@/lib/rate-limit';

// GET /api/ingest/reads-left — how many document reads (POST /api/ingest/preview)
// the caller has left this hour, without using one (F2.2). With a shared store
// (Upstash or Vercel KV env set) the count holds across server instances.
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const s = await rateLimitStatus(RATE_LIMITS.ingestPreview, [userId]);
    return NextResponse.json({
      success: true,
      limit: s.limit,
      remaining: s.remaining,
      resets_in_seconds: s.remaining > 0 ? null : Math.ceil(s.retryAfterMs / 1000),
    });
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Reads left error:', error);
    return NextResponse.json({ error: 'Failed to read the allowance' }, { status: 500 });
  }
}
