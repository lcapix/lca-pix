// lib/costs/auto-populate.ts
// Fill a step's labor and energy costs from public rates (BLS, EIA) or the
// dated reference table, and record how each was built (migrate-035).
//
// Labor: labor_hours x the hourly wage for labor_occupation (a BLS OEWS code)
// in the case's state, else the national reference for that code.
// Energy: each energy flow priced in its own unit. A live price is used when
// its unit converts from the flow's unit ($/Mcf for an amount in m3), else the
// reference price for that unit; a flow no price applies to is left out and
// named, never multiplied across units.

import { query, queryOne, transaction } from '@/lib/db-helpers';
import { stateCode } from '@/lib/integrations/rate-lookup';
import { classifyEnergyCarrier } from '@/lib/integrations/reference-rates';
import { costAmount, type CostLine } from './cost-basis';
import { RateNotFound, isEnergyCarrier, resolveEnergyRate, resolveLaborRate, type ResolvedRate } from './rate-resolve';

export interface AutoPopulateResult {
  laborSet: boolean;
  energySet: boolean;
  totalsSet: number;
  /** Energy flows no price applies to, as "Natural gas in 'L'". */
  skipped: string[];
}

/** The case's region as a BLS/EIA state code, else the national figure. */
export function lookupRegion(regionCode: unknown): string {
  const r = String(regionCode ?? '').trim().toUpperCase().slice(0, 2);
  return stateCode.safeParse(r).success ? r : 'US';
}

async function writeCost(
  componentId: number,
  kind: 'labor' | 'energy',
  amount: number,
  basis: {
    driver_quantity: number | null;
    driver_unit: string | null;
    rate: number | null;
    rate_unit: string | null;
    rate_label: string | null;
    rate_code: string | null;
    region: string | null;
    source_kind: ResolvedRate['source_kind'];
    source_name: string | null;
    vintage: string | null;
    lines: CostLine[] | null;
  },
) {
  await transaction(async (conn) => {
    await conn.query(`UPDATE component SET ${kind === 'labor' ? 'labor_cost' : 'energy_cost'} = ? WHERE component_id = ?`, [
      amount,
      componentId,
    ]);
    try {
      await conn.query(
        `INSERT INTO component_cost_basis
           (component_id, cost_kind, driver_quantity, driver_unit, rate, rate_unit, rate_label, rate_code,
            region, source_kind, source_name, vintage, cost_lines, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT (component_id, cost_kind) DO UPDATE SET driver_quantity = EXCLUDED.driver_quantity, driver_unit = EXCLUDED.driver_unit,
           rate = EXCLUDED.rate, rate_unit = EXCLUDED.rate_unit, rate_label = EXCLUDED.rate_label,
           rate_code = EXCLUDED.rate_code, region = EXCLUDED.region, source_kind = EXCLUDED.source_kind,
           source_name = EXCLUDED.source_name, vintage = EXCLUDED.vintage, cost_lines = EXCLUDED.cost_lines,
           updated_by = NULL`,
        [
          componentId, kind, basis.driver_quantity, basis.driver_unit, basis.rate, basis.rate_unit,
          basis.rate_label, basis.rate_code, basis.region, basis.source_kind, basis.source_name,
          basis.vintage, basis.lines ? JSON.stringify(basis.lines) : null,
        ],
      );
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') throw err; // before migrate-035: the amount alone
    }
  });
}

export async function autoPopulateCosts(componentId: number): Promise<AutoPopulateResult> {
  const comp = await queryOne<any>(
    `SELECT c.component_id, c.labor_occupation, c.labor_hours, ct.region_code
       FROM component c
       JOIN case_table ct ON c.case_id = ct.case_id
      WHERE c.component_id = ?`,
    [componentId],
  );
  if (!comp) throw new Error(`component ${componentId} not found`);

  const region = lookupRegion(comp.region_code);
  let laborSet = false;
  let energySet = false;
  const skipped: string[] = [];

  // --- Labor ----------------------------------------------------------
  const hours = Number(comp.labor_hours);
  if (comp.labor_occupation && Number.isFinite(hours) && hours > 0) {
    const r = await resolveLaborRate(String(comp.labor_occupation), region);
    await writeCost(componentId, 'labor', costAmount(hours, r.rate), {
      ...r,
      driver_quantity: hours,
      lines: null,
    });
    laborSet = true;
  }

  // --- Energy ---------------------------------------------------------
  const flows = await query<any>(
    `SELECT f.quantity, f.unit, s.substance_name
       FROM flows f
       JOIN substances s ON f.substance_id = s.substance_id
      WHERE f.component_id = ? AND f.is_driver = 1 AND f.flow_type = 'input'`,
    [componentId],
  );

  const lines: CostLine[] = [];
  for (const f of flows) {
    const qty = Number(f.quantity);
    if (f.quantity === null || !Number.isFinite(qty)) continue; // no amount yet: nothing to price
    const carrier = classifyEnergyCarrier(f.substance_name);
    if (!carrier || !isEnergyCarrier(carrier)) continue; // only the carriers with a lookup
    try {
      const r = await resolveEnergyRate(carrier, region, String(f.unit ?? ''));
      lines.push({
        label: String(f.substance_name),
        quantity: qty,
        unit: r.driver_unit,
        rate: r.rate,
        rate_unit: r.rate_unit,
        source_kind: r.source_kind,
        source_name: r.source_name,
        vintage: r.vintage,
      });
    } catch (err) {
      if (!(err instanceof RateNotFound)) throw err;
      skipped.push(`${f.substance_name} in '${f.unit}'`);
    }
  }

  if (lines.length) {
    const amount = lines.reduce((s, l) => s + costAmount(l.quantity, l.rate), 0);
    const one = lines.length === 1 ? lines[0] : null;
    const allLive = lines.every((l) => l.source_kind === 'live');
    const names = [...new Set(lines.map((l) => l.source_name).filter(Boolean))];
    await writeCost(componentId, 'energy', Math.round(amount * 1e6) / 1e6, {
      driver_quantity: one ? one.quantity : null,
      driver_unit: one ? one.unit : null,
      rate: one ? one.rate : null,
      rate_unit: one ? one.rate_unit : null,
      rate_label: one ? one.label : `${lines.length} energy flows`,
      rate_code: null,
      region: allLive ? region : 'US',
      source_kind: allLive ? 'live' : 'reference',
      source_name: names.join(', ') || null,
      vintage: one ? one.vintage : null,
      lines: one ? null : lines,
    });
    energySet = true;
  }

  return { laborSet, energySet, totalsSet: Number(laborSet) + Number(energySet), skipped };
}
