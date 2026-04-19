import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';

// GET /api/substances - Get all substances
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let sql = `SELECT * FROM substances`;
    const params: any[] = [];

    if (category) {
      sql += ` WHERE category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY substance_name`;

    const substances = await query(sql, params);

    return NextResponse.json({ success: true, substances });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get substances error:', error);
    return NextResponse.json({ error: 'Failed to fetch substances' }, { status: 500 });
  }
}
