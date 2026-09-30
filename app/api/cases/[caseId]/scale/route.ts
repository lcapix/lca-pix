/**
 * POST /api/cases/[caseId]/scale — change how many units of product a case
 * models, after the user has confirmed what the change means.
 *
 * Body { from, to, mode }:
 *   mode 'scale-inputs' — multiply every flow quantity and every per-unit cost
 *     in the case by to/from, so the inventory now describes `to` units.
 *   mode 'data-covers'  — leave the inventory as it is; the data already
 *     describes `to` units, so results per unit are divided by `to`.
 * Either way the product's quantity and the case's data basis (modeled_output,
 * ISO 14044 reference-flow scaling) are set to `to`, in one transaction.
 * Capital cost (capex) does not scale with output and is left alone.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { COLUMN_LIMITS, decimalMax, isOutOfRangeError } from '@/lib/field-limits';

// `to` becomes the product's quantity and the case's modeled_output, both
// DECIMAL(15,6): at least 0.000001 (a smaller one would be stored as 0) and at
// most 999,999,999.999999. `from` is a stored quantity, so the same range.
const AMOUNT_MIN = 0.000001;
const AMOUNT_MAX = decimalMax(COLUMN_LIMITS.component.quantity);

const PER_UNIT_COST_COLUMNS = [
  'labor_cost',
  'labor_hours',
  'energy_cost',
  'material_cost',
  'transportation_cost',
  'equipment_cost',
  'overhead_cost',
  'opex',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseId(caseIdParam);

    const caseRow = await queryOne<any>(`SELECT project_id FROM case_table WHERE case_id = ?`, [caseId]);
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const denied = await projectAccessDenied(userId, caseRow.project_id, 'editor', { notFound: 'Case not found' });
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const { from, to, mode } = json.body;
    const f = Number(from);
    const t = Number(to);
    const inRange = (n: number) => Number.isFinite(n) && n >= AMOUNT_MIN && n <= AMOUNT_MAX;
    if (!inRange(f) || !inRange(t)) {
      return NextResponse.json(
        { error: `from and to must be numbers from ${AMOUNT_MIN} to ${AMOUNT_MAX}` },
        { status: 400 }
      );
    }
    if (mode !== 'scale-inputs' && mode !== 'data-covers') {
      return NextResponse.json({ error: "mode must be 'scale-inputs' or 'data-covers'" }, { status: 400 });
    }
    const factor = t / f;

    let result: { flowsScaled: number };
    try {
      result = await transaction(async (conn) => {
        let flowsScaled = 0;
        if (mode === 'scale-inputs') {
          const [fr]: any = await conn.query(
            `UPDATE flows f JOIN component c ON c.component_id = f.component_id
                SET f.quantity = f.quantity * ?
              WHERE c.case_id = ?`,
            [factor, caseId]
          );
          flowsScaled = fr.affectedRows ?? 0;
          // Only the cost columns this database has (later migrations add some).
          const [cols]: any = await conn.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'component'
                AND COLUMN_NAME IN (${PER_UNIT_COST_COLUMNS.map(() => '?').join(', ')})`,
            PER_UNIT_COST_COLUMNS
          );
          const present: string[] = cols.map((r: any) => r.COLUMN_NAME);
          if (present.length) {
            await conn.query(
              `UPDATE component SET ${present.map((c) => `${c} = ${c} * ?`).join(', ')} WHERE case_id = ?`,
              [...present.map(() => factor), caseId]
            );
          }
        }
        await conn.query(
          `UPDATE component SET quantity = ?
            WHERE case_id = ? AND parent_component_id IS NULL AND component_type = 'product'`,
          [t, caseId]
        );
        try {
          await conn.query(`UPDATE case_table SET modeled_output = ? WHERE case_id = ?`, [t, caseId]);
        } catch (e: any) {
          if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e; // no migrate-014: quantity alone
        }
        return { flowsScaled };
      });
    } catch (e) {
      // A scaled flow or cost that no longer fits its column: the transaction
      // rolled back, so nothing changed. Not a server fault.
      if (!isOutOfRangeError(e)) throw e;
      return NextResponse.json(
        { error: `Scaling by ${Number(factor.toPrecision(6))} would push a flow or cost past what can be stored. Nothing was changed.` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, mode, factor, flows_scaled: result.flowsScaled });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Scale case error:', error);
    return NextResponse.json({ error: 'Failed to rescale the case' }, { status: 500 });
  }
}
