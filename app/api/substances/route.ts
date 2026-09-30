import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { query, queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';
import { validateCustomSubstance } from '@/lib/substances/custom';

// GET /api/substances - Get all substances
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Per-method factor coverage rides along so pickers can say, before
    // selection, whether a substance will actually contribute anything under
    // the chosen method — the tool review's #1 bug was two near-identical
    // substances where only one had factors, and the other silently
    // contributed zero.
    // data_source: the cited sources of the substance's factors (the text of
    // source_reference before its first "(" or ","), so a flow's source label
    // names where its numbers come from. Quarantined rows are not factors.
    let sql = `
      SELECT s.*,
             COALESCE(fc.methods_with_factors, '') AS methods_with_factors,
             COALESCE(fc.factor_count, 0) AS factor_count,
             fc.data_source AS data_source
      FROM substances s
      LEFT JOIN (
        SELECT substance_id,
               GROUP_CONCAT(DISTINCT method_name ORDER BY method_name SEPARATOR '|') AS methods_with_factors,
               COUNT(*) AS factor_count,
               SUBSTRING(
                 GROUP_CONCAT(
                   DISTINCT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(source_reference, ' (', 1), ',', 1))
                   ORDER BY TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(source_reference, ' (', 1), ',', 1))
                   SEPARATOR ' · '
                 ),
                 1, 160
               ) AS data_source
        FROM driver_impact_factors
        WHERE factor_value <> 0 AND method_name NOT LIKE 'QUARANTINE%'
        GROUP BY substance_id
      ) fc ON fc.substance_id = s.substance_id`;
    const params: any[] = [];

    if (category) {
      sql += ` WHERE s.category = ?`;
      params.push(category);
    }

    const ordered = (base: string) => `${base} ORDER BY s.substance_name`;

    let substances;
    try {
      // Hand-added substances belong to the person who added them; the library
      // (is_custom = 0) is everyone's.
      const ownFilter = category ? ` AND` : ` WHERE`;
      substances = await query(ordered(`${sql}${ownFilter} (s.is_custom = 0 OR s.created_by = ?)`), [
        ...params,
        userId,
      ]);
    } catch (e: any) {
      // A database without migrate-020 has no is_custom column.
      if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      substances = await query(ordered(sql), params);
    }

    return NextResponse.json({ success: true, substances });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get substances error:', error);
    return NextResponse.json({ error: 'Failed to fetch substances' }, { status: 500 });
  }
}

// POST /api/substances — add a substance by hand, with the one factor that
// makes it usable. No library has everything: a student modelling cork, hemp
// or a supplier-specific alloy must be able to enter it rather than pick
// something "close enough" and quietly model the wrong material.
//
// The factor is stored with a "User-entered" source, so `classifyFactorSource`
// grades it unverified and the run's data-quality statement counts it there.
// The substance is visible only to the account that added it.
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;

    const checked = validateCustomSubstance(body);
    if (!checked.ok || !checked.value) {
      return NextResponse.json({ error: checked.errors.join(' '), errors: checked.errors }, { status: 400 });
    }
    const v = checked.value;

    // Duplicates are checked among what the caller can see: the library and
    // their own custom rows. Another user's private substance stays private.
    let existing: any;
    try {
      existing = await queryOne<any>(
        `SELECT substance_id, substance_name FROM substances
          WHERE LOWER(TRIM(substance_name)) = LOWER(TRIM(?))
            AND (is_custom = 0 OR created_by = ?)
          LIMIT 1`,
        [v.name, userId]
      );
    } catch (e: any) {
      // Before migrate-020 there are no custom substances to hide.
      if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      existing = await queryOne<any>(
        `SELECT substance_id, substance_name FROM substances
          WHERE LOWER(TRIM(substance_name)) = LOWER(TRIM(?)) LIMIT 1`,
        [v.name]
      );
    }
    if (existing) {
      return NextResponse.json(
        {
          error: `"${existing.substance_name}" is already in the catalog. Search for it in the picker instead of adding it twice.`,
          substance_id: existing.substance_id,
        },
        { status: 409 }
      );
    }

    const category = await queryOne<any>(
      `SELECT category_id FROM impact_categories WHERE category_name = ? LIMIT 1`,
      [v.impactCategory]
    );
    if (!category) {
      return NextResponse.json({ error: `No impact category called "${v.impactCategory}".` }, { status: 400 });
    }

    // The substance is useless without its factor: both rows or neither.
    let substanceId: number;
    try {
      substanceId = await transaction(async (conn) => {
        let id: number;
        try {
          const [res]: any = await conn.execute(
            `INSERT INTO substances (substance_name, category, unit, cas_number, is_custom, created_by)
             VALUES (?, ?, ?, ?, 1, ?)`,
            [v.name, v.category, v.unit, v.casNumber, userId]
          );
          id = res.insertId;
        } catch (e: any) {
          // Before migrate-020 there is nowhere to record who added it.
          if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
          const [res]: any = await conn.execute(
            `INSERT INTO substances (substance_name, category, unit, cas_number) VALUES (?, ?, ?, ?)`,
            [v.name, v.category, v.unit, v.casNumber]
          );
          id = res.insertId;
        }

        await conn.execute(
          `INSERT INTO driver_impact_factors
             (substance_id, category_id, method_name, factor_value, unit,
              geographic_scope, source_reference, factor_basis)
           VALUES (?, ?, ?, ?, ?, 'Global', ?, ?)`,
          [
            id,
            category.category_id,
            v.method,
            v.factorValue,
            v.factorUnit,
            v.sourceReference,
            v.factorBasis,
          ]
        );
        return id;
      });
    } catch (e: any) {
      // substance_name is globally unique, so a name another user already
      // uses privately still collides. Say so without naming their row.
      if (e?.code === 'ER_DUP_ENTRY') {
        return NextResponse.json(
          { error: 'That name is already taken. Add a distinguishing detail (supplier, grade, region) to the name.' },
          { status: 409 }
        );
      }
      throw e;
    }

    const substance = await queryOne<any>(`SELECT * FROM substances WHERE substance_id = ?`, [substanceId]);
    return NextResponse.json(
      {
        success: true,
        substance,
        note: `Added for ${v.method}, ${v.impactCategory}. It counts as unverified data until you replace the source with a published one.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create substance error:', error);
    return NextResponse.json({ error: 'Failed to add the substance' }, { status: 500 });
  }
}
