import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { queryOne, execute, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { planPlacement, descendantsOf } from '@/lib/component-tree';
import {
  BadRequest,
  COMPONENT_TYPES,
  has,
  nonNegative,
  parseStage,
  parseCostColumns,
  loadCaseTree,
  changedLevels,
  updateExistingColumns,
} from '@/lib/component-fields';
import type { TreeRow } from '@/lib/component-tree';
import { parseId } from '@/lib/ids';
import { COLUMN_LIMITS, firstLengthError } from '@/lib/field-limits';

const ALLOCATION_METHODS = ['none', 'physical', 'economic', 'system_expansion'];

// GET /api/components/[componentId] - Get single component
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseId(componentIdParam);

    // The parent's name is only joined from the same case, so a row that was
    // pointed at another tenant's step (M1) cannot echo that step's name.
    const component = await queryOne(
      `SELECT c.*, parent.component_name as parent_component_name,
              ct.project_id
       FROM component c
       LEFT JOIN component parent
         ON c.parent_component_id = parent.component_id AND parent.case_id = c.case_id
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const denied = await projectAccessDenied(userId, (component as any).project_id, undefined, { notFound: 'Component not found' });
    if (denied) return denied;

    return NextResponse.json({ success: true, component });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get component error:', error);
    return NextResponse.json({ error: 'Failed to fetch component' }, { status: 500 });
  }
}

// PUT /api/components/[componentId] - Update component
//
// Every field is validated before anything is written, so a 400 never leaves a
// half-applied edit behind. Fields that may legitimately be "unknown" (costs,
// hours, opex/capex, unit, description, allocation note) are cleared to NULL
// when their key is sent as null; a key that is absent keeps its value.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseId(componentIdParam);

    const existing = await queryOne<any>(
      `SELECT c.case_id, c.component_type, c.parent_component_id, c.hierarchy_level,
              ct.project_id
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const denied = await projectAccessDenied(userId, existing.project_id, 'editor', { notFound: 'Component not found' });
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const {
      component_name,
      component_type,
      process_type,
      driver_category,
      driver_type,
      drivers,
      quantity,
      allocation_method,
      allocation_factor,
    } = body;

    // ---------- Validate everything first ----------
    let quantityValue: number | null = null;
    let stageValue: string | null | undefined;
    let allocFactor: number | null = null;
    let placement: { rows: TreeRow[]; parentId: number | null; levels: Array<[number, number]> } | null =
      null;
    let costValues: Array<[string, unknown]> = [];
    const coreClears: Array<[string, unknown]> = [];
    try {
      if (component_type != null && !COMPONENT_TYPES.includes(component_type)) {
        throw new BadRequest('Invalid component type');
      }
      if (
        component_name != null &&
        (typeof component_name !== 'string' || !component_name.trim() || component_name.length > 200)
      ) {
        throw new BadRequest('Component name must be 1 to 200 characters');
      }
      const K = COLUMN_LIMITS.component;
      const tooLong = firstLengthError([
        ['Description', body.component_description ?? body.description, K.description],
        ['Process type', process_type, K.process_type],
        ['Driver category', driver_category, K.driver_category],
        ['Driver type', driver_type, K.driver_type],
      ]);
      if (tooLong) throw new BadRequest(tooLong);
      if (quantity !== undefined && quantity !== null && quantity !== '') {
        quantityValue = nonNegative('quantity', quantity);
        const type = component_type ?? existing.component_type;
        if (type === 'product' && !(Number(quantityValue) > 0)) {
          throw new BadRequest('The product quantity (the data basis) must be above 0');
        }
      }
      stageValue = parseStage(body);

      // Clearable core fields.
      if (has(body, 'component_description') || has(body, 'description')) {
        const d = body.component_description ?? body.description;
        coreClears.push(['description', typeof d === 'string' && d.trim() ? d : null]);
      }
      if (has(body, 'unit')) {
        const u = body.unit;
        if (u != null && (typeof u !== 'string' || u.length > 50)) {
          throw new BadRequest('unit must be text of at most 50 characters');
        }
        coreClears.push(['unit', typeof u === 'string' && u.trim() ? u.trim() : null]);
      }
      for (const col of ['opex', 'capex'] as const) {
        if (has(body, col)) coreClears.push([col, nonNegative(col, body[col])]);
      }

      // Cost breakdown.
      costValues = parseCostColumns(body);

      // ISO 14044 4.3.4 allocation: 0 < factor <= 1.
      if (allocation_factor !== undefined && allocation_factor !== null && allocation_factor !== '') {
        allocFactor = Number(allocation_factor);
        if (!Number.isFinite(allocFactor) || allocFactor <= 0 || allocFactor > 1) {
          throw new BadRequest('allocation_factor must be greater than 0 and at most 1');
        }
      }
      if (allocation_method != null && !ALLOCATION_METHODS.includes(allocation_method)) {
        throw new BadRequest('allocation_method must be none, physical, economic or system_expansion');
      }

      // Placement: same case, not itself, not under its own subtree (M1/FLOW-1),
      // and every moved row gets its new depth (EDIT-9).
      if (has(body, 'parent_component_id')) {
        const raw = body.parent_component_id;
        const parentId = raw === null || raw === '' || raw === undefined ? null : Number(raw);
        if (parentId !== null && !Number.isInteger(parentId)) {
          throw new BadRequest('parent_component_id must be a step id or null');
        }
        const rows = await loadCaseTree(Number(existing.case_id));
        const plan = planPlacement(rows, componentId, parentId);
        if (!plan.ok) throw new BadRequest(plan.error);
        placement = { rows, parentId, levels: changedLevels(rows, plan.levels) };
      }
    } catch (e) {
      if (e instanceof BadRequest) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // ---------- Write ----------
    // Core row + tree placement in one transaction: a re-parent never lands
    // without the depths that go with it.
    const clearSql = coreClears.map(([c]) => `${c} = ?`);
    await transaction(async (conn) => {
      await conn.query(
        `UPDATE component
         SET component_name = COALESCE(?, component_name),
             component_type = COALESCE(?, component_type),
             ${placement ? 'parent_component_id = ?,' : ''}
             process_type = COALESCE(?, process_type),
             driver_category = COALESCE(?, driver_category),
             driver_type = COALESCE(?, driver_type),
             drivers = COALESCE(?, drivers),
             quantity = COALESCE(?, quantity)${clearSql.length ? ',\n             ' + clearSql.join(',\n             ') : ''}
         WHERE component_id = ?`,
        [
          component_name ?? null,
          component_type ?? null,
          ...(placement ? [placement.parentId] : []),
          process_type ?? null,
          driver_category ?? null,
          driver_type ?? null,
          drivers ? (typeof drivers === 'string' ? drivers : JSON.stringify(drivers)) : null,
          quantityValue,
          ...coreClears.map(([, v]) => v),
          componentId,
        ]
      );
      for (const [id, level] of placement?.levels ?? []) {
        await conn.query('UPDATE component SET hierarchy_level = ? WHERE component_id = ?', [
          level,
          id,
        ]);
      }
    });

    if (stageValue !== undefined) {
      try {
        await execute('UPDATE component SET life_cycle_stage = ? WHERE component_id = ?', [
          stageValue,
          componentId,
        ]);
      } catch (stageErr: any) {
        if (stageErr?.code !== 'ER_BAD_FIELD_ERROR') throw stageErr;
        console.warn('[component PUT] life_cycle_stage missing (run migrate-022)');
      }
    }

    // ABC cost breakdown: its own statement, built from the columns this
    // database has. Only a missing column is tolerated; anything else is a 500
    // rather than a silently discarded edit.
    await updateExistingColumns(componentId, costValues, 'component PUT');

    // The product's quantity IS the case's data basis (how many units the
    // entered data make): whichever path changes it, keep the two equal.
    if (quantityValue !== null) {
      try {
        await execute(
          `UPDATE case_table ct
             JOIN component c ON c.case_id = ct.case_id
              SET ct.modeled_output = c.quantity
            WHERE c.component_id = ? AND c.parent_component_id IS NULL
              AND c.component_type = 'product' AND c.quantity > 0`,
          [componentId],
        );
      } catch (syncErr: any) {
        if (syncErr?.code !== 'ER_BAD_FIELD_ERROR') throw syncErr; // no migrate-014
      }
    }

    // ISO 14044 4.3.4 allocation of a multi-output unit process (migrate-014).
    const allocValues: Array<[string, unknown]> = [];
    if (allocation_method != null) allocValues.push(['allocation_method', allocation_method]);
    if (allocFactor !== null) allocValues.push(['allocation_factor', allocFactor]);
    if (has(body, 'allocation_note')) {
      const note = body.allocation_note;
      allocValues.push(['allocation_note', typeof note === 'string' && note.trim() ? note.slice(0, 500) : null]);
    }
    await updateExistingColumns(componentId, allocValues, 'component PUT');

    const updatedComponent = await queryOne(
      `SELECT c.*, parent.component_name as parent_component_name
       FROM component c
       LEFT JOIN component parent
         ON c.parent_component_id = parent.component_id AND parent.case_id = c.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    return NextResponse.json({ success: true, component: updatedComponent });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update component error:', error);
    return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
  }
}

// DELETE /api/components/[componentId]?children=delete|reparent
//
// children=delete (the default, and what the parent FK's ON DELETE CASCADE
// always did): the step and everything under it go, with their flows.
// children=reparent: the step's children move up to its parent (keeping their
// own subtrees, re-levelled), then the step alone is deleted.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseId(componentIdParam);

    const mode = new URL(request.url).searchParams.get('children') ?? 'delete';
    if (mode !== 'delete' && mode !== 'reparent') {
      return NextResponse.json(
        { error: "children must be 'delete' or 'reparent'" },
        { status: 400 },
      );
    }

    const existing = await queryOne<any>(
      `SELECT c.case_id, c.parent_component_id, ct.project_id
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    // Editor, the same level that creates and edits steps (FLOW-10): an
    // editor could already empty a step of flows and costs, so admin-only
    // delete protected nothing and left editors unable to undo their own adds.
    const denied = await projectAccessDenied(userId, existing.project_id, 'editor', { notFound: 'Component not found' });
    if (denied) return denied;

    const rows = await loadCaseTree(Number(existing.case_id));
    const below = [...descendantsOf(rows, componentId)];
    const grandparent =
      existing.parent_component_id == null ? null : Number(existing.parent_component_id);

    const result = await transaction(async (conn) => {
      if (mode === 'reparent') {
        const children = rows.filter((r) => Number(r.parent_component_id) === componentId);
        // New depths: each child's subtree moves up to the grandparent.
        const without = rows.filter((r) => Number(r.component_id) !== componentId);
        const moved = without.map((r) =>
          Number(r.parent_component_id) === componentId ? { ...r, parent_component_id: grandparent } : r,
        );
        const levels = new Map<number, number>();
        for (const child of children) {
          const plan = planPlacement(moved, Number(child.component_id), grandparent);
          if (plan.ok) for (const [id, lvl] of plan.levels) levels.set(id, lvl);
        }
        await conn.query(
          'UPDATE component SET parent_component_id = ? WHERE parent_component_id = ?',
          [grandparent, componentId],
        );
        for (const [id, level] of changedLevels(rows, levels)) {
          await conn.query('UPDATE component SET hierarchy_level = ? WHERE component_id = ?', [
            level,
            id,
          ]);
        }
        await conn.query('DELETE FROM flows WHERE component_id = ?', [componentId]);
        await conn.query('DELETE FROM component WHERE component_id = ?', [componentId]);
        return { deleted: 1, reparented: children.length };
      }

      // Whole subtree, explicitly, so it does not depend on the FK cascade.
      const ids = [componentId, ...below];
      const marks = ids.map(() => '?').join(', ');
      await conn.query(`DELETE FROM flows WHERE component_id IN (${marks})`, ids);
      await conn.query(`DELETE FROM component WHERE component_id IN (${marks})`, ids);
      return { deleted: ids.length, reparented: 0 };
    });

    return NextResponse.json({ success: true, message: 'Component deleted', ...result });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete component error:', error);
    return NextResponse.json({ error: 'Failed to delete component' }, { status: 500 });
  }
}
