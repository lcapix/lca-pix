import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';

// GET /api/driver-factors - Get all driver impact factors
//
// Only factors the caller may see: library substances (is_custom = 0) and the
// caller's own custom ones. Quarantined rows (method 'QUARANTINE: …', see
// migrate-017/024) are not factors and are left out.
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const substanceIdParam = searchParams.get('substance_id');
    const driverName = searchParams.get('driver_name');

    let substanceId: number | null = null;
    if (substanceIdParam !== null) {
      substanceId = parseId(substanceIdParam);
      if (!Number.isInteger(substanceId) || substanceId <= 0) {
        return NextResponse.json({ error: 'substance_id must be a positive integer' }, { status: 400 });
      }
    }

    // Prod schema joins substances (FK by substance_id) — surface the
    // substance name as `driver_name` for backwards-compat callers.
    const build = (scoped: boolean) => {
      let sql = `
        SELECT dif.*,
               s.substance_name AS driver_name,
               ic.category_name, ic.description as category_description, ic.unit as category_unit
        FROM driver_impact_factors dif
        LEFT JOIN impact_categories ic ON dif.category_id = ic.category_id
        LEFT JOIN substances s          ON dif.substance_id = s.substance_id
        WHERE dif.method_name NOT LIKE 'QUARANTINE%'
      `;
      const params: any[] = [];

      if (scoped) {
        sql += ` AND (s.is_custom = 0 OR s.created_by = ?)`;
        params.push(userId);
      }

      if (categoryId) {
        sql += ` AND dif.category_id = ?`;
        params.push(parseId(categoryId));
      }

      if (substanceId !== null) {
        sql += ` AND dif.substance_id = ?`;
        params.push(substanceId);
      } else if (driverName) {
        sql += ` AND s.substance_name = ?`;
        params.push(driverName);
      }

      sql += ` ORDER BY s.substance_name, ic.category_name`;
      return { sql, params };
    };

    let factors;
    try {
      const q = build(true);
      factors = await query(q.sql, q.params);
    } catch (e: any) {
      // A database without migrate-020 has no is_custom column (and so no
      // custom substances to hide).
      if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      const q = build(false);
      factors = await query(q.sql, q.params);
    }

    return NextResponse.json({ success: true, factors });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get driver factors error:', error);
    return NextResponse.json({ error: 'Failed to fetch driver factors' }, { status: 500 });
  }
}
