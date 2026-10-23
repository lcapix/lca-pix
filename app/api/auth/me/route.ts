/**
 * GET /api/auth/me
 * Get current authenticated user information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { internalError } from '@/lib/http';
import { isAuthError } from '@/lib/route-guard';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });

  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    return internalError('auth me', 'Could not read your account. You are still signed in; try again.', error);
  }
}
