// lib/integrations/admin-guard.ts
// The integration endpoints write the shared factor library, the substance
// catalog and the cost-rate cache that every tenant's runs read, so they are
// admin-only. This turns requireAdmin's thrown errors into the right response.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';

export type AdminGuard =
  | { userId: number; response?: undefined }
  | { userId?: undefined; response: NextResponse };

export async function guardAdmin(request: Request): Promise<AdminGuard> {
  try {
    return { userId: await requireAdmin(request) };
  } catch (err: any) {
    if (err?.message === 'Admin privileges required') {
      return { response: NextResponse.json({ error: 'Admin privileges required' }, { status: 403 }) };
    }
    // Same rule as every other route: any requireAuth failure is a 401.
    if (isAuthError(err)) {
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    console.error('Admin check failed:', err);
    return { response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
  }
}
