// lib/integrations/admin-guard.ts
// The integration endpoints write the shared factor library, the substance
// catalog and the cost-rate cache that every tenant's runs read, so they are
// admin-only. This turns requireAdmin's thrown errors into the right response.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

const AUTH_ERRORS = new Set([
  'Unauthorized',
  'No authentication token provided',
  'Invalid or expired token',
  'User account not found or inactive',
]);

export type AdminGuard =
  | { userId: number; response?: undefined }
  | { userId?: undefined; response: NextResponse };

export async function guardAdmin(request: Request): Promise<AdminGuard> {
  try {
    return { userId: await requireAdmin(request) };
  } catch (err: any) {
    const message = err?.message;
    if (message === 'Admin privileges required') {
      return { response: NextResponse.json({ error: 'Admin privileges required' }, { status: 403 }) };
    }
    if (AUTH_ERRORS.has(message)) {
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    console.error('Admin check failed:', err);
    return { response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
  }
}
