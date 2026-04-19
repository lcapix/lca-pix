import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';

// GET /api/driver-factors - Get all driver impact factors
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    let sql = `
      SELECT dif.*,
             ic.category_name, ic.description as category_description, ic.unit as category_unit
      FROM driver_impact_factors dif
      LEFT JOIN impact_categories ic ON dif.category_id = ic.category_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (categoryId) {
      sql += ` AND dif.category_id = ?`;
      params.push(parseInt(categoryId));
    }

    const substanceId = searchParams.get('substance_id');
    if (substanceId) {
      sql += ` AND dif.substance_id = ?`;
      params.push(parseInt(substanceId));
    }

    sql += ` ORDER BY dif.substance_id, ic.category_name`;

    const factors = await query(sql, params);

    return NextResponse.json({ success: true, factors });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get driver factors error:', error);
    return NextResponse.json({ error: 'Failed to fetch driver factors' }, { status: 500 });
  }
}
