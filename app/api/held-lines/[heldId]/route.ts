import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { convertQuantity } from '@/lib/units';
import { findUsableSubstance, SUBSTANCE_ERROR } from '@/lib/flow-fields';
import { costColumn } from '@/lib/ingest/cost-columns';
import { COST_BASIS_KINDS, type CostBasisKind } from '@/lib/costs/cost-basis';
import { HeldLineAction } from '@/lib/import/held-lines';

// PUT /api/held-lines/[heldId] — act on one import line held for review
// (migrate-040), as someone who may change its case:
//   { action: 'dismiss' }                          drop it, keep the record
//   { action: 'resolve', component_id, ... }       make it real on a step of
//     the same case: a flow (substance and unit checked exactly as a new flow
//     is) or a cost added to the step's column. One line resolves once.

const NOT_FOUND = { error: 'Held line not found' };
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ heldId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const heldId = parseId((await params).heldId);

    let line: any;
    try {
      line = await queryOne<any>(`SELECT * FROM import_held_lines WHERE held_id = ?`, [heldId]);
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
      line = null;
    }
    if (!line) return NextResponse.json(NOT_FOUND, { status: 404 });
    const denied = await caseAccessDenied(userId, Number(line.case_id), 'editor', { notFound: NOT_FOUND.error });
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const parsed = HeldLineAction.safeParse(json.body);
    if (!parsed.success) {
      return bad('Send { action: "dismiss" } or { action: "resolve", component_id, substance_id?, unit?, quantity? }');
    }
    const act = parsed.data;
    if (line.status !== 'held') {
      return NextResponse.json({ error: `This line is already ${line.status}.` }, { status: 409 });
    }

    if (act.action === 'dismiss') {
      const done = await transaction(async (conn) => {
        const [r]: any = await conn.query(
          `UPDATE import_held_lines SET status = 'dismissed', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
            WHERE held_id = ? AND status = 'held'`,
          [userId, heldId]
        );
        return r.affectedRows === 1;
      });
      if (!done) return NextResponse.json({ error: 'This line was just acted on.' }, { status: 409 });
      return NextResponse.json({ success: true, held_id: heldId, status: 'dismissed' });
    }

    // The step must be in the line's own case.
    const step = await queryOne<any>(`SELECT component_id, case_id FROM component WHERE component_id = ?`, [act.component_id]);
    if (!step || Number(step.case_id) !== Number(line.case_id)) return bad('component_id: a step of this case');

    if (line.line_kind === 'flow') {
      const substanceId = act.substance_id ?? (line.substance_id == null ? null : Number(line.substance_id));
      if (!substanceId) return bad('substance_id: pick the substance this line is');
      const substance = await findUsableSubstance(substanceId, userId);
      if (!substance) return bad(SUBSTANCE_ERROR);
      const unit = act.unit ?? line.unit;
      if (!unit) return bad('unit: the unit the amount is in');
      if (substance.default_unit && !convertQuantity(1, unit, substance.default_unit)) {
        return bad(`unit: '${unit}' cannot be converted to '${substance.default_unit}', the unit ${substance.substance_name}'s factors are stated in.`);
      }
      const quantity = act.quantity ?? (line.quantity == null ? null : Number(line.quantity));
      if (quantity != null && (!Number.isFinite(quantity) || quantity < 0)) return bad('quantity: 0 or more');

      const flowId = await transaction(async (conn) => {
        const [[locked]]: any = await conn.query(`SELECT status FROM import_held_lines WHERE held_id = ? FOR UPDATE`, [heldId]);
        if (locked?.status !== 'held') return null;
        const [ins]: any = await conn.query(
          `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [
            act.component_id,
            substanceId,
            line.direction ?? 'input',
            quantity,
            unit,
            `held import line: ${String(line.substance_text ?? '').slice(0, 200)}`,
          ]
        );
        await conn.query(
          `UPDATE import_held_lines SET status = 'resolved', resolved_flow_id = ?, resolved_component_id = ?,
                  resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE held_id = ?`,
          [ins.insertId, act.component_id, userId, heldId]
        );
        return Number(ins.insertId);
      });
      if (flowId == null) return NextResponse.json({ error: 'This line was just acted on.' }, { status: 409 });
      return NextResponse.json({ success: true, held_id: heldId, status: 'resolved', flow_id: flowId });
    }

    // A cost line: added to the step's column; a cost the basis no longer
    // explains loses its basis row (migrate-035).
    const col = costColumn(line.cost_category);
    if (!col || line.amount == null) return bad('This cost line has no category or amount to place.');
    const ok = await transaction(async (conn) => {
      const [[locked]]: any = await conn.query(`SELECT status FROM import_held_lines WHERE held_id = ? FOR UPDATE`, [heldId]);
      if (locked?.status !== 'held') return false;
      await conn.query(`UPDATE component SET ${col} = COALESCE(${col}, 0) + ? WHERE component_id = ?`, [
        Number(line.amount),
        act.component_id,
      ]);
      const kind = String(line.cost_category) as CostBasisKind;
      if ((COST_BASIS_KINDS as readonly string[]).includes(kind)) {
        try {
          await conn.query(`DELETE FROM component_cost_basis WHERE component_id = ? AND cost_kind = ?`, [act.component_id, kind]);
        } catch (e: any) {
          if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
        }
      }
      await conn.query(
        `UPDATE import_held_lines SET status = 'resolved', resolved_component_id = ?, resolved_by = ?,
                resolved_at = CURRENT_TIMESTAMP WHERE held_id = ?`,
        [act.component_id, userId, heldId]
      );
      return true;
    });
    if (!ok) return NextResponse.json({ error: 'This line was just acted on.' }, { status: 409 });
    return NextResponse.json({ success: true, held_id: heldId, status: 'resolved', component_id: act.component_id });
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Held line error:', error);
    return NextResponse.json({ error: 'Failed to update the held line' }, { status: 500 });
  }
}
