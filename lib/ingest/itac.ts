// Deterministic connector for the DOE ITAC assessment database — TS port of
// lcapix-ingest/ingest/structure.py's structure_itac(). No LLM, no guessing:
// the stream codes below come from the workbook's own Terms sheet, and a
// value absent from the row simply produces no node/flow.

import type { IngestCost, IngestFlow, IngestNode, ProcessModel, Provenance } from './schema';

// ITAC ASSESS energy/waste stream codes:
// (code, human name, substance as stated, unit as stated, direction)
export const ITAC_STREAMS: Array<[string, string, string, string, 'input' | 'output']> = [
  ['EC', 'Electricity consumption', 'Electricity', 'kWh', 'input'],
  ['E2', 'Natural gas', 'Natural Gas', 'MMBtu', 'input'],
  ['E3', 'LPG', 'LPG', 'MMBtu', 'input'],
  ['E4', '#1 Fuel oil', 'Fuel Oil', 'MMBtu', 'input'],
  ['E5', '#2 Fuel oil', 'Fuel Oil', 'MMBtu', 'input'],
  ['E6', '#4 Fuel oil', 'Fuel Oil', 'MMBtu', 'input'],
  ['E7', '#6 Fuel oil', 'Fuel Oil', 'MMBtu', 'input'],
  ['E8', 'Coal', 'Coal', 'MMBtu', 'input'],
  ['E9', 'Wood', 'Wood', 'MMBtu', 'input'],
  ['W0', 'Water consumption', 'Water', 'Tgal', 'input'],
  ['W1', 'Water disposal', 'Wastewater', 'gal', 'output'],
  ['W2', 'Other liquid disposal (non-haz)', 'Wastewater', 'gal', 'output'],
  ['W4', 'Solid waste disposal (non-haz)', 'Solid Waste', 'lbs', 'output'],
  ['W5', 'Solid waste disposal (haz)', 'Solid Waste', 'lbs', 'output'],
];

// A numeric cell that pandas would have seen as NaN arrives from SheetJS as
// undefined, null, '', or a non-numeric string. Treat all of those as absent.
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function structureItac(
  rows: Array<Record<string, unknown>>,
  plantId: string,
  docName: string
): ProcessModel {
  const r = rows.find((row) => String(row['ID'] ?? '').trim() === plantId);
  if (!r) throw new Error(`assessment ${plantId} not found`);
  const loc = `sheet ASSESS, row ID=${plantId}`;

  const products = String(r['PRODUCTS'] ?? '').trim() || 'Plant output';
  const fy = num(r['FY']);
  const prodlevel = num(r['PRODLEVEL']);
  const root = fy ? `${products} — FY${fy}` : products;
  const caseName = `Ingested: ITAC ${plantId} (${products}${fy ? `, FY${fy}` : ''})`.slice(0, 100);

  const nodes: IngestNode[] = [];
  const flows: IngestFlow[] = [];
  const costs: IngestCost[] = [];

  nodes.push({
    name: root,
    tier: 'product',
    parent: null,
    description:
      `Real DOE ITAC assessment ${plantId}: NAICS ${r['NAICS']}, ${r['STATE']}, ` +
      `${r['EMPLOYEES']} employees, annual production ${prodlevel}, ${r['PRODHOURS']} op hours.`,
    quantity: prodlevel,
    unit: 'units/yr',
    provenance: { doc: docName, locator: loc, snippet: `PRODUCTS=${products}` },
  });

  const line = 'Facility energy & utility systems';
  nodes.push({
    name: line,
    tier: 'machine_line',
    parent: root,
    description: 'Annual facility-level streams as assessed by the DOE ITAC visit.',
    provenance: { doc: docName, locator: loc, snippet: 'facility-level assessment' },
  });

  // One operation per assessed stream, directly under the facility: the
  // assessment states annual facility totals, nothing finer, so no finer level
  // is invented.
  const streamName = (human: string) => (fy ? `${human} FY${fy}` : `${human} (annual)`);
  for (const [code, human, substance, unit, direction] of ITAC_STREAMS) {
    const usage = num(r[`${code}_plant_usage`]);
    const cost = num(r[`${code}_plant_cost`]);
    if (usage === null || usage === 0) continue;
    const op = streamName(human);
    const prov: Provenance = {
      doc: docName,
      locator: loc,
      snippet: `${code}_plant_usage=${usage}, ${code}_plant_cost=${cost}`,
    };
    if (nodes.some((n) => n.name === op)) {
      // Several fuel-oil grades share one stream name: add to the existing step.
      flows.push({ node: op, substance_text: substance, direction, quantity: usage, unit, provenance: prov });
    } else {
      nodes.push({ name: op, tier: 'operation', parent: line, quantity: 1, unit: 'year', provenance: prov });
      flows.push({ node: op, substance_text: substance, direction, quantity: usage, unit, provenance: prov });
    }
    if (cost !== null && cost !== 0) {
      costs.push({
        node: op,
        category: code.startsWith('E') ? 'energy' : 'opex',
        amount: cost,
        basis: 'annual, from ITAC assessed totals',
        provenance: prov,
      });
    }
  }

  // Demand charges are cost-only (no physical flow): attach to the electricity
  // step, or to the facility when no electricity use was assessed.
  const edCost = num(r['ED_plant_cost']);
  if (edCost !== null && edCost !== 0) {
    const elec = streamName('Electricity consumption');
    costs.push({
      node: nodes.some((n) => n.name === elec) ? elec : line,
      category: 'energy',
      amount: edCost,
      basis: 'annual electricity demand charges',
      provenance: { doc: docName, locator: loc, snippet: `ED_plant_cost=${edCost}` },
    });
  }

  return {
    product_name: root,
    case_name: caseName,
    nodes,
    flows,
    costs,
    source_docs: [docName],
    notes: [
      'Labor and material costs are NOT in the ITAC assessment and were deliberately ' +
        'not estimated. Pair with payroll/BOM documents to fill them.',
    ],
  };
}

/** IDs available in the workbook — used for "plant not found" guidance. */
export function listPlantIds(rows: Array<Record<string, unknown>>, query?: string, limit = 10): {
  total: number;
  sample: string[];
} {
  const ids = rows.map((row) => String(row['ID'] ?? '').trim()).filter(Boolean);
  const q = (query ?? '').trim().toUpperCase();
  const matching = q ? ids.filter((id) => id.toUpperCase().includes(q)) : ids;
  return { total: matching.length, sample: matching.slice(0, limit) };
}
