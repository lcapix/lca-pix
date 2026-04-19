/**
 * GET /api/auth/me
 * Get current authenticated user information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

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
    return NextResponse.json(
      { error: 'Authentication failed', details: error.message },
      { status: 401 }
    );
  }
}
