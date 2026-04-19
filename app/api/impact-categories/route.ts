import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';

// GET /api/impact-categories - Get all impact categories
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const categories = await query(
      `SELECT * FROM impact_categories ORDER BY category_name`
    );

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get impact categories error:', error);
    return NextResponse.json({ error: 'Failed to fetch impact categories' }, { status: 500 });
  }
}
