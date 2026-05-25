import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';

// GET /api/driver-factors - Get all driver impact factors
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    // Prod schema joins substances (FK by substance_id) — surface the
    // substance name as `driver_name` for backwards-compat callers.
    let sql = `
      SELECT dif.*,
             s.substance_name AS driver_name,
             ic.category_name, ic.description as category_description, ic.unit as category_unit
      FROM driver_impact_factors dif
      LEFT JOIN impact_categories ic ON dif.category_id = ic.category_id
      LEFT JOIN substances s          ON dif.substance_id = s.substance_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (categoryId) {
      sql += ` AND dif.category_id = ?`;
      params.push(parseInt(categoryId));
    }

    const driverName = searchParams.get('driver_name') || searchParams.get('substance_id');
    if (driverName) {
      sql += ` AND s.substance_name = ?`;
      params.push(driverName);
    }

    sql += ` ORDER BY s.substance_name, ic.category_name`;

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
