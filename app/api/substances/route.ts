import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';

// GET /api/substances - Get all substances
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Per-method factor coverage rides along so pickers can say, before
    // selection, whether a substance will actually contribute anything under
    // the chosen method — the tool review's #1 bug was two near-identical
    // substances where only one had factors, and the other silently
    // contributed zero.
    let sql = `
      SELECT s.*,
             COALESCE(fc.methods_with_factors, '') AS methods_with_factors,
             COALESCE(fc.factor_count, 0) AS factor_count
      FROM substances s
      LEFT JOIN (
        SELECT substance_id,
               GROUP_CONCAT(DISTINCT method_name ORDER BY method_name SEPARATOR '|') AS methods_with_factors,
               COUNT(*) AS factor_count
        FROM driver_impact_factors
        WHERE factor_value <> 0
        GROUP BY substance_id
      ) fc ON fc.substance_id = s.substance_id`;
    const params: any[] = [];

    if (category) {
      sql += ` WHERE s.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY s.substance_name`;

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
