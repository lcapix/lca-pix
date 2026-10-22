// The BLS / EIA / Metals rate lookups are open to any signed-in user: the
// component form's Suggest panel and the inspector's state-wage picker call
// them. The caller only chooses a key from a fixed list (an OEWS occupation
// code, a US state, a sector, a metal symbol); the value stored in the shared
// cost_rates cache always comes from the upstream public API. So: requireAuth,
// strict allowlisted input, and one per-user hourly budget across the three.
import { NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isAuthError } from '@/lib/route-guard';

/** The 50 states plus 'US' for the national figure. */
export const RATE_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'US',
] as const;

export const stateCode = z.enum(RATE_STATE_CODES);

/** BLS OEWS occupation code, e.g. 51-4121. */
export const occupationCode = z.string().regex(/^\d{2}-\d{4}$/);

export type RateLookupGuard =
  | { userId: number; response?: undefined }
  | { userId?: undefined; response: NextResponse };

/** 401 unless signed in; 429 once the caller's hourly lookup budget is spent. */
export async function guardRateLookup(request: Request): Promise<RateLookupGuard> {
  let userId: number;
  try {
    userId = await requireAuth(request);
  } catch (err: any) {
    if (isAuthError(err)) {
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    console.error('Rate lookup auth check failed:', err);
    return { response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
  }
  const limited = await enforceRateLimit(RATE_LIMITS.costRates, [userId]);
  if (limited) return { response: limited };
  return { userId };
}

/** Parse a JSON body against a schema; a generic 400 that echoes nothing back. */
export async function parseLookupBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
  hint: string,
): Promise<{ data: z.infer<T>; response?: undefined } | { data?: undefined; response: NextResponse }> {
  const json = await readJson(request);
  if (!json.ok) return { response: json.response };
  const parsed = schema.safeParse(json.body);
  if (!parsed.success) {
    return { response: NextResponse.json({ error: `Invalid request: ${hint}` }, { status: 400 }) };
  }
  return { data: parsed.data };
}
