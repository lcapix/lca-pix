import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { COLUMN_LIMITS, decimalMax, firstLengthError } from '@/lib/field-limits';
import { query, insert, queryOne, execute } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { convertQuantity, compatibleUnits } from '@/lib/units';
import {
  parseFlowQuantity,
  QUANTITY_ERROR,
  findUsableSubstance,
  SUBSTANCE_ERROR,
} from '@/lib/flow-fields';
import { parseId } from '@/lib/ids';

// GET /api/components/[componentId]/flows - Get all flows for a component
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseId(componentIdParam);

    const component = await queryOne<any>(
      `SELECT ct.project_id 
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const denied = await projectAccessDenied(userId, component.project_id, undefined, { notFound: 'Component not found' });
    if (denied) return denied;

    // The live `flows` table columns are `direction` and `amount` (a migration
    // renamed them from flow_type/quantity). Querying/ordering by the old names
    // 500'd the whole fetch. We alias `direction AS flow_type` and
    // `amount AS quantity` so existing clients that read those keys keep working,
    // and surface `cas_number` so the inspector can show each flow's data source.
    // `s.unit` is intentionally omitted (absent in some environments); the flow's
    // own `unit` column carries the unit.
    // Prod schema: the flows table uses flow_type/quantity natively (NOT
    // direction/amount). `f.*` returns them; we add substance fields for the
    // inspector. `s.unit` is omitted (absent in some environments).
    const flows = await query(
      `SELECT f.*,
              s.substance_name, s.category as substance_category, s.cas_number
       FROM flows f
       LEFT JOIN substances s ON f.substance_id = s.substance_id
       WHERE f.component_id = ?
       ORDER BY f.flow_type, f.created_at`,
      [componentId]
    );

    return NextResponse.json({ success: true, flows });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get flows error:', error);
    return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
  }
}

// POST /api/components/[componentId]/flows - Create new flow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseId(componentIdParam);

    const component = await queryOne<any>(
      `SELECT ct.project_id 
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const denied = await projectAccessDenied(userId, component.project_id, 'editor', { notFound: 'Component not found' });
    if (denied) return denied;

    // Prod schema: the flows table columns are flow_type / quantity (NOT
    // direction / amount). Accept either key from the client for resilience.
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const substance_id = body.substance_id;
    const flow_type = body.flow_type ?? body.direction;
    const rawQuantity = body.quantity ?? body.amount;
    const unit = body.unit;
    const driver_description = body.driver_description ?? null;

    if (!substance_id || !flow_type || rawQuantity === undefined || !unit) {
      return NextResponse.json(
        { error: 'Substance, flow_type, quantity, and unit are required' },
        { status: 400 }
      );
    }

    if (!['input', 'output'].includes(flow_type)) {
      return NextResponse.json({ error: 'Invalid flow_type (must be input or output)' }, { status: 400 });
    }
    const F = COLUMN_LIMITS.flows;
    const tooLong = firstLengthError([
      ['Unit', unit, F.unit],
      ['Driver description', driver_description, F.driver_description],
      ['Transport mode', body.transport_mode, F.transport_mode],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });

    // FLOW-4: null, words, NaN and negatives used to reach MySQL or the engine.
    const quantity = parseFlowQuantity(rawQuantity);
    if (quantity === null) {
      return NextResponse.json({ error: QUANTITY_ERROR }, { status: 400 });
    }

    // L3: only a library substance or the caller's own custom one.
    const substanceRow = await findUsableSubstance(substance_id, userId);
    if (!substanceRow) {
      return NextResponse.json({ error: SUBSTANCE_ERROR }, { status: 400 });
    }

    // Unit guard: the entered unit must be convertible into the substance's
    // factor unit, or the assessment could only exclude this flow later. The
    // flow keeps the unit AS ENTERED (provenance); the engine converts at
    // calculation time.
    if (substanceRow?.default_unit) {
      const conv = convertQuantity(1, unit, substanceRow.default_unit);
      if (!conv) {
        return NextResponse.json(
          {
            error: `Unit '${unit}' cannot be converted to '${substanceRow.default_unit}', the unit ${substanceRow.substance_name}'s impact factors are stored in. Compatible units: ${compatibleUnits(substanceRow.default_unit).join(', ') || substanceRow.default_unit}.`,
          },
          { status: 400 }
        );
      }
    }

    // A transport leg's distance is DECIMAL(18,3): checked before the flow is written.
    const legMass = Number(body.transport_mass_kg);
    const legKm = Number(body.transport_distance_km);
    if (isFinite(legMass) && legMass > 0 && isFinite(legKm) && legKm > decimalMax(F.transport_distance_km)) {
      return NextResponse.json(
        { error: `transport_distance_km must be at most ${decimalMax(F.transport_distance_km)}` },
        { status: 400 }
      );
    }

    // Bug #9: default is_driver to TRUE so new flows count in assessments.
    const flowId = await insert(
      `INSERT INTO flows
         (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [componentId, Number(substance_id), flow_type, quantity, unit, body.is_driver === false ? 0 : 1, driver_description]
    );

    // What a transport leg was computed from (migrate-022). Its own statement,
    // so a database without the columns still records the flow itself.
    if (isFinite(legMass) && legMass > 0 && isFinite(legKm) && legKm > 0) {
      try {
        await execute(
          'UPDATE flows SET transport_mass_kg = ?, transport_distance_km = ?, transport_mode = ? WHERE flow_id = ?',
          [legMass, legKm, body.transport_mode ?? null, flowId],
        );
      } catch (legErr: any) {
        if (legErr?.code !== 'ER_BAD_FIELD_ERROR') throw legErr;
        console.warn('[flow POST] transport columns missing (run migrate-022)');
      }
    }

    const newFlow = await queryOne(
      `SELECT f.*,
              s.substance_name, s.category as substance_category, s.cas_number
       FROM flows f
       LEFT JOIN substances s ON f.substance_id = s.substance_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    return NextResponse.json({ success: true, flow: newFlow }, { status: 201 });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create flow error:', error);
    return NextResponse.json({ error: 'Failed to create flow' }, { status: 500 });
  }
}
