import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { execute, query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { toFactorBasis } from '@/lib/units';
import {
  FactorOverrideInput,
  methodCategoryUnit,
  overrideImpactUnit,
} from '@/lib/factor-override';

// A person's own factor for one flow (migrate-034, E03 "Use my own number").
//   GET     the flow's own factors, one per impact category (any member)
//   PUT     set or replace the one for a category ("Can change")
//   DELETE  ?category_id=N goes back to the library factor ("Can change")
// The number is stated in the unit the project's method reports the category
// in, per one per_unit of the flow (default: the flow's own unit).

const NOT_FOUND = { notFound: 'Flow not found' };
const NEEDS_MIGRATION = 'Your own factors need migration 034 on this database. Nothing was changed.';

async function flowContext(flowId: number) {
  return queryOne<any>(
    `SELECT f.flow_id, f.unit AS flow_unit, c.case_id, ct.project_id,
            s.substance_name, s.unit AS substance_unit, p.lcia_method
       FROM flows f
       JOIN component c ON c.component_id = f.component_id
       JOIN case_table ct ON ct.case_id = c.case_id
       JOIN project p ON p.project_id = ct.project_id
       JOIN substances s ON s.substance_id = f.substance_id
      WHERE f.flow_id = ?`,
    [flowId],
  );
}

async function listOverrides(flowId: number) {
  return query<any>(
    `SELECT o.category_id, ic.category_name, o.factor_value, o.impact_unit, o.per_unit,
            o.source, o.note, o.updated_at
       FROM flow_factor_overrides o
       JOIN impact_categories ic ON ic.category_id = o.category_id
      WHERE o.flow_id = ?
      ORDER BY o.category_id`,
    [flowId],
  );
}

function routeError(error: any, what: string) {
  if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (error?.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: NEEDS_MIGRATION }, { status: 409 });
  console.error(`Flow factor ${what} error:`, error);
  return NextResponse.json({ error: `Failed to ${what} the factor` }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const flowId = parseId((await params).flowId);
    const flow = await flowContext(flowId);
    if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, flow.case_id, undefined, NOT_FOUND);
    if (denied) return denied;
    return NextResponse.json({ success: true, factors: await listOverrides(flowId) });
  } catch (error: any) {
    return routeError(error, 'read');
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const flowId = parseId((await params).flowId);
    const flow = await flowContext(flowId);
    if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, flow.case_id, 'editor', NOT_FOUND);
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const parsed = FactorOverrideInput.safeParse(json.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') || 'body';
      return NextResponse.json({ error: `${field}: ${issue?.message ?? 'invalid'}` }, { status: 400 });
    }
    const input = parsed.data;

    const category = await queryOne<any>(
      `SELECT category_id, category_name, unit FROM impact_categories WHERE category_id = ?`,
      [input.category_id],
    );
    if (!category) return NextResponse.json({ error: 'category_id: unknown impact category' }, { status: 400 });

    // The result unit: the one the project's method reports this category in,
    // so the number adds to the library factors of the same run.
    const method = String(flow.lcia_method || 'CML 2001');
    const unitRows = await query<any>(
      `SELECT DISTINCT unit FROM driver_impact_factors WHERE method_name = ? AND category_id = ?`,
      [method, input.category_id],
    );
    const impactUnit = overrideImpactUnit(methodCategoryUnit(unitRows.map((r) => r.unit)), category.unit);

    // The number must apply to this flow: per_unit in the flow's own unit, or
    // one the flow's amount converts to, as the engine checks on every run.
    const perUnit = input.per_unit ?? String(flow.flow_unit ?? '').trim();
    const basis = toFactorBasis(1, flow.flow_unit, flow.substance_unit, `${impactUnit} / ${perUnit}`);
    if (!perUnit || !basis.ok) {
      return NextResponse.json(
        {
          error: `per_unit: a number per '${perUnit || '(none)'}' cannot apply to ${flow.substance_name} measured in '${flow.flow_unit}'. Use the flow's unit or one it converts to.`,
        },
        { status: 400 },
      );
    }

    const note = input.note ? input.note : null;
    await execute(
      `INSERT INTO flow_factor_overrides
         (flow_id, category_id, factor_value, impact_unit, per_unit, source, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (flow_id, category_id) DO UPDATE SET factor_value = EXCLUDED.factor_value, impact_unit = EXCLUDED.impact_unit,
         per_unit = EXCLUDED.per_unit, source = EXCLUDED.source, note = EXCLUDED.note,
         created_by = EXCLUDED.created_by`,
      [flowId, input.category_id, input.factor_value, impactUnit, perUnit, input.source, note, userId],
    );
    return NextResponse.json({ success: true, factors: await listOverrides(flowId) });
  } catch (error: any) {
    return routeError(error, 'save');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const flowId = parseId((await params).flowId);
    const flow = await flowContext(flowId);
    if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, flow.case_id, 'editor', NOT_FOUND);
    if (denied) return denied;

    const categoryId = parseId(request.nextUrl.searchParams.get('category_id') ?? '');
    if (Number.isNaN(categoryId)) {
      return NextResponse.json({ error: 'category_id: a positive whole number is required' }, { status: 400 });
    }
    await execute(`DELETE FROM flow_factor_overrides WHERE flow_id = ? AND category_id = ?`, [flowId, categoryId]);
    return NextResponse.json({ success: true, factors: await listOverrides(flowId) });
  } catch (error: any) {
    return routeError(error, 'remove');
  }
}
