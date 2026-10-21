import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { query, queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { occupationCode, stateCode } from '@/lib/integrations/rate-lookup';
import { unitProblem } from '@/lib/units';
import {
  COST_BASIS_KINDS,
  COST_COLUMN,
  CostBasisInput,
  costAmount,
  toCostBasis,
  type CostBasisKind,
} from '@/lib/costs/cost-basis';
import { FROM_FLOWS, costsFromFlows, type FlowForCost } from '@/lib/costs/from-flows';
import { REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates';
import {
  RateNotFound,
  energyReferenceRate,
  isEnergyCarrier,
  laborReferenceRate,
  resolveEnergyRate,
  resolveLaborRate,
  type ResolvedRate,
} from '@/lib/costs/rate-resolve';

// A step's costs and how each was built (migrate-035, E14).
//   GET     the six amounts, each with its basis when it has one ("4 of 6 set"),
//           and from_flows: what the material and energy cost would be from
//           the step's flows, with the flows no price applies to named
//   PUT     set one cost: mode "lookup" (the server finds the rate: labor by
//           BLS occupation, energy by carrier), mode "entered" (the
//           person's own rate, or an amount alone), or mode "flows" (material
//           or energy, from the step's flows: the "Use it" the panels offer)
//                                                            ("Can change")
//   DELETE  ?kind=labor clears that cost and its basis      ("Can change")
// The amount stays in its component column; the basis row explains it.

const NOT_FOUND = { notFound: 'Component not found' };
const NEEDS_MIGRATION = 'Cost sources need migration 035 on this database. Nothing was changed.';

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

async function stepOf(componentId: number) {
  return queryOne<any>(`SELECT component_id, case_id FROM component WHERE component_id = ?`, [componentId]);
}

/** The step's flows as the cost-from-flows rules read them. */
async function flowsOf(componentId: number): Promise<FlowForCost[]> {
  const rows = await query<any>(
    `SELECT s.substance_name, f.flow_type, f.quantity, f.unit
       FROM flows f LEFT JOIN substances s ON s.substance_id = f.substance_id
      WHERE f.component_id = ? ORDER BY f.flow_id`,
    [componentId],
  );
  return rows.map((r: any) => ({
    substance: String(r.substance_name ?? ''),
    direction: r.flow_type === 'output' ? 'output' : 'input',
    quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
    unit: String(r.unit ?? ''),
  }));
}

async function costsOf(componentId: number) {
  const [step] = await query<any>(
    `SELECT ${COST_BASIS_KINDS.map((k) => COST_COLUMN[k]).join(', ')}, currency FROM component WHERE component_id = ?`,
    [componentId],
  );
  const rows = await query<any>(`SELECT * FROM component_cost_basis WHERE component_id = ?`, [componentId]);
  const byKind = new Map(rows.map((r: any) => [r.cost_kind as CostBasisKind, r]));
  const costs = COST_BASIS_KINDS.map((kind) => {
    const raw = step?.[COST_COLUMN[kind]];
    const amount = raw === null || raw === undefined ? null : Number(raw);
    const row = byKind.get(kind);
    return { kind, amount, basis: row ? toCostBasis(row, raw) : null };
  });
  return {
    currency: step?.currency ?? 'USD',
    costs,
    set: costs.filter((c) => c.amount !== null).length,
    of: COST_BASIS_KINDS.length,
    from_flows: costsFromFlows(await flowsOf(componentId)),
  };
}

function routeError(error: any, what: string) {
  if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (error?.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: NEEDS_MIGRATION }, { status: 409 });
  console.error(`Step cost ${what} error:`, error);
  return NextResponse.json({ error: `Failed to ${what} the cost` }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ componentId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const componentId = parseId((await params).componentId);
    const step = await stepOf(componentId);
    if (!step) return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, step.case_id, undefined, NOT_FOUND);
    if (denied) return denied;
    return NextResponse.json({ success: true, ...(await costsOf(componentId)) });
  } catch (error: any) {
    return routeError(error, 'read');
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ componentId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const componentId = parseId((await params).componentId);
    const step = await stepOf(componentId);
    if (!step) return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, step.case_id, 'editor', NOT_FOUND);
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    if ((json.body as any)?.mode === 'flows') return useFlows(componentId, json.body, userId);
    const parsed = CostBasisInput.safeParse(json.body);
    if (!parsed.success) {
      // A union reports every branch; the branch the mode names is the one to explain.
      const mode = (json.body as any)?.mode;
      const issues = parsed.error.issues.flatMap((i: any) => (i.code === 'invalid_union' ? i.unionErrors.flatMap((e: any) => e.issues) : [i]));
      const issue = issues.find((i: any) => i.path?.[0] !== 'mode') ?? issues[0];
      if (mode !== 'lookup' && mode !== 'entered') return bad('mode: must be "lookup", "entered" or "flows"');
      return bad(`${issue?.path?.join('.') || 'body'}: ${issue?.message ?? 'invalid'}`);
    }
    const input = parsed.data;
    const kind = input.kind as CostBasisKind;

    let basis: {
      driver_quantity: number | null;
      driver_unit: string | null;
      rate: number | null;
      rate_unit: string | null;
      rate_label: string | null;
      rate_code: string | null;
      region: string | null;
      source_kind: 'reference' | 'live' | 'entered';
      source_name: string | null;
      vintage: string | null;
    };
    let amount: number;

    if (input.mode === 'lookup') {
      const referenceOnly = input.prefer === 'reference';
      // Lookups reach public APIs: the same hourly budget as the rate lookups.
      // A reference pick reads the dated table only, so it spends none.
      if (!referenceOnly) {
        const limited = await enforceRateLimit(RATE_LIMITS.costRates, [userId]);
        if (limited) return limited;
      }
      if (!stateCode.safeParse(input.region).success) return bad('region: a US state code or US');
      let resolved: ResolvedRate;
      try {
        if (kind === 'labor') {
          if (!occupationCode.safeParse(input.rate_code).success) {
            return bad('rate_code: a BLS OEWS occupation code such as 51-4121');
          }
          if (input.driver_unit && !['h', 'hr', 'hour', 'hours'].includes(input.driver_unit.toLowerCase())) {
            return bad('driver_unit: labor is priced per hour (h)');
          }
          resolved = referenceOnly ? laborReferenceRate(input.rate_code) : await resolveLaborRate(input.rate_code, input.region);
        } else {
          if (!isEnergyCarrier(input.rate_code)) return bad('rate_code: electricity or natural_gas');
          if (!input.driver_unit) return bad('driver_unit: the unit the energy amount is in (kWh, m3, MMBtu)');
          const problem = unitProblem(input.driver_unit);
          if (problem) return bad(`driver_unit: ${problem}`);
          resolved = referenceOnly
            ? energyReferenceRate(input.rate_code, input.driver_unit)
            : await resolveEnergyRate(input.rate_code, input.region, input.driver_unit);
        }
      } catch (lookupErr: any) {
        if (lookupErr instanceof RateNotFound) return bad(lookupErr.message);
        throw lookupErr;
      }
      amount = costAmount(input.driver_quantity, resolved.rate);
      basis = {
        driver_quantity: input.driver_quantity,
        driver_unit: resolved.driver_unit,
        rate: resolved.rate,
        rate_unit: resolved.rate_unit,
        rate_label: resolved.rate_label,
        rate_code: resolved.rate_code,
        region: resolved.region,
        source_kind: resolved.source_kind,
        source_name: resolved.source_name,
        vintage: resolved.vintage,
      };
    } else {
      const byRate = input.driver_quantity !== undefined && input.rate !== undefined;
      amount = byRate ? costAmount(input.driver_quantity!, input.rate!) : input.amount!;
      basis = {
        driver_quantity: byRate ? input.driver_quantity! : null,
        driver_unit: byRate ? input.driver_unit ?? (kind === 'labor' ? 'h' : null) : null,
        rate: byRate ? input.rate! : null,
        rate_unit: byRate ? input.rate_unit ?? (kind === 'labor' ? '$/h' : null) : null,
        rate_label: input.rate_label ?? null,
        rate_code: null,
        region: null,
        source_kind: 'entered',
        source_name: input.source_name ?? null,
        vintage: null,
      };
    }

    // The amount, the labor driver and the basis change together.
    const sets: Array<[string, unknown]> = [[COST_COLUMN[kind], amount]];
    if (kind === 'labor' && basis.driver_quantity !== null) sets.push(['labor_hours', basis.driver_quantity]);
    if (kind === 'labor' && input.mode === 'lookup') sets.push(['labor_occupation', basis.rate_code]);
    await transaction(async (conn) => {
      await conn.query(
        `UPDATE component SET ${sets.map(([c]) => `${c} = ?`).join(', ')} WHERE component_id = ?`,
        [...sets.map(([, v]) => v), componentId],
      );
      await conn.query(
        `INSERT INTO component_cost_basis
           (component_id, cost_kind, driver_quantity, driver_unit, rate, rate_unit, rate_label, rate_code,
            region, source_kind, source_name, vintage, cost_lines, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
         ON DUPLICATE KEY UPDATE driver_quantity = VALUES(driver_quantity), driver_unit = VALUES(driver_unit),
           rate = VALUES(rate), rate_unit = VALUES(rate_unit), rate_label = VALUES(rate_label),
           rate_code = VALUES(rate_code), region = VALUES(region), source_kind = VALUES(source_kind),
           source_name = VALUES(source_name), vintage = VALUES(vintage), cost_lines = NULL,
           updated_by = VALUES(updated_by)`,
        [
          componentId, kind, basis.driver_quantity, basis.driver_unit, basis.rate, basis.rate_unit,
          basis.rate_label, basis.rate_code, basis.region, basis.source_kind, basis.source_name,
          basis.vintage, userId,
        ],
      );
    });
    return NextResponse.json({ success: true, ...(await costsOf(componentId)) });
  } catch (error: any) {
    return routeError(error, 'save');
  }
}

/**
 * Mode "flows": the material or energy cost from the step's own flows, priced
 * by the dated reference table (no live call, no guess). The number is worked
 * out here, never taken from the request, and kept with one line per priced
 * flow; flows no price applies to stay out and are named in from_flows.
 */
async function useFlows(componentId: number, body: any, userId: number) {
  const kind = body?.kind;
  if (kind !== 'material' && kind !== 'energy') return bad('kind: material or energy, for mode "flows"');
  const suggestion = costsFromFlows(await flowsOf(componentId))[kind as 'material' | 'energy'];
  if (suggestion.amount === null) {
    return bad(
      suggestion.noPrice.length
        ? `No ${kind} flow on this step has a price (${suggestion.noPrice.join(', ')}): add the cost by hand.`
        : `This step has no ${kind} flow with an amount to price.`,
    );
  }
  const amount = suggestion.amount;
  await transaction(async (conn) => {
    await conn.query(`UPDATE component SET ${COST_COLUMN[kind as CostBasisKind]} = ? WHERE component_id = ?`, [amount, componentId]);
    await conn.query(
      `INSERT INTO component_cost_basis
         (component_id, cost_kind, driver_quantity, driver_unit, rate, rate_unit, rate_label, rate_code,
          region, source_kind, source_name, vintage, cost_lines, updated_by)
       VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, ?, NULL, 'reference', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE driver_quantity = NULL, driver_unit = NULL, rate = NULL, rate_unit = NULL,
         rate_label = NULL, rate_code = VALUES(rate_code), region = NULL, source_kind = VALUES(source_kind),
         source_name = VALUES(source_name), vintage = VALUES(vintage), cost_lines = VALUES(cost_lines),
         updated_by = VALUES(updated_by)`,
      [componentId, kind, FROM_FLOWS, "Reference prices for the step's flows", REFERENCE_VINTAGE, JSON.stringify(suggestion.lines), userId],
    );
  });
  return NextResponse.json({ success: true, ...(await costsOf(componentId)) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ componentId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const componentId = parseId((await params).componentId);
    const step = await stepOf(componentId);
    if (!step) return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, step.case_id, 'editor', NOT_FOUND);
    if (denied) return denied;

    const kind = request.nextUrl.searchParams.get('kind') ?? '';
    if (!(COST_BASIS_KINDS as readonly string[]).includes(kind)) {
      return bad(`kind: one of ${COST_BASIS_KINDS.join(', ')}`);
    }
    await transaction(async (conn) => {
      await conn.query(`UPDATE component SET ${COST_COLUMN[kind as CostBasisKind]} = NULL WHERE component_id = ?`, [componentId]);
      await conn.query(`DELETE FROM component_cost_basis WHERE component_id = ? AND cost_kind = ?`, [componentId, kind]);
    });
    return NextResponse.json({ success: true, ...(await costsOf(componentId)) });
  } catch (error: any) {
    return routeError(error, 'clear');
  }
}
