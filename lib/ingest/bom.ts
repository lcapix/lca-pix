// Bill-of-materials connector — TS, deterministic. A BOM is how a plant already
// records what a product is MADE OF; this turns an ERP/CAD BOM export
// (CSV/XLSX) into an LCAPIX process model: each line item becomes a material
// INPUT flow (mapped to a material substance) with its purchased-part cost.
//
// Real BOM exports vary wildly, so columns are detected by header keyword and
// values are read the way they are written:
//   - a count ("Qty 8 ea") with a per-part weight column → mass = qty × weight;
//   - a quantity already in a mass unit (2.5 kg, 500 g) → that mass;
//   - a mass written in the cell ("4861.20 g", SolidWorks) → that unit;
//   - "Unit Cost" is multiplied by the quantity; "Extended/Total Cost" is used
//     as the line total — never the other way round;
//   - in an indented (multi-level) BOM an assembly row is not counted again:
//     its parts, listed under it, are.
// A line with no way to a mass ("8 bolts" and no weight) is surfaced for
// review, never silently turned into zero. The BOM does not say which process
// step uses each part: an operation column is kept as a placement hint, and
// the review screen asks for the step.

import type { IngestCost, IngestFlow, IngestNode, ProcessModel, Provenance } from './schema';
import { convertQuantity } from '@/lib/units';
import { unmappedColumnNotes } from './columns';
import { parseQuantity } from './parse-values';

export interface BomColumnMap {
  level?: string;
  part?: string;
  description?: string;
  material?: string;
  quantity?: string;
  weight?: string;
  unit?: string;
  weightUnit?: string;
  unitCost?: string;
  extCost?: string;
  opHint?: string;
}
type Field = keyof BomColumnMap;

const HEADER_PATTERNS: Record<Field, RegExp> = {
  level: /^(level|lvl|bom\s*level|indent(ed)?\s*level|indent)$/i,
  part: /^(part|part\s*(no|nbr|number|#|id|code)|component|component\s*(no|number|id|code)|item|item\s*(no|nbr|number|code|#|id)|sku|article)$/i,
  description: /^(description|name|part\s*name|item\s*name|component\s*name|part\s*description|item\s*description|title)$/i,
  material: /^(material|matl|material\s*(type|grade|spec|name)|substance|composition|raw\s*material)$/i,
  quantity: /^(qty|quantity|qty\s*per|quantity\s*per|count|pcs|qty\s*req(uired)?|required\s*qty|qnty|no\s*req)$/i,
  weightUnit: /^(weight\s*unit|mass\s*unit|wt\s*unit|weight\s*uom|mass\s*uom)$/i,
  weight: /^(mass|weight|net\s*weight|net\s*wt|gross\s*weight|unit\s*weight|unit\s*mass|weight\s*(each|per\s*unit|per\s*part)|mass\s*(each|per\s*unit)|wt)$/i,
  unit: /^(unit|uom|u\/?m|units|unit\s*of\s*measure|qty\s*unit|quantity\s*unit)$/i,
  extCost: /^(extended\s*cost|ext\s*cost|extended\s*price|total\s*cost|line\s*cost|line\s*total|amount|total|total\s*price)$/i,
  unitCost: /^(unit\s*cost|unit\s*price|price|rate|cost\s*each|price\s*each|cost\s*per\s*unit|std\s*cost|standard\s*cost|valuation\s*rate|cost)$/i,
  opHint: /^(operation|op|op\s*(no|seq)|operation\s*(no|seq)|routing\s*op(eration)?|used\s*(at|in)|where\s*used|work\s*cent(er|re)|consumed\s*at|station)$/i,
};
const ORDER: Field[] = [
  'level', 'part', 'description', 'material', 'quantity', 'weightUnit', 'weight', 'unit', 'extCost', 'unitCost', 'opHint',
];

/** Whether a cleaned header is one this connector understands (for table location). */
export function isBomHeader(h: string): boolean {
  const s = String(h ?? '').trim();
  return ORDER.some((f) => HEADER_PATTERNS[f].test(s));
}

/** Detect which spreadsheet columns hold which BOM field, by header text. */
export function detectBomColumns(headers: string[]): BomColumnMap {
  const map: BomColumnMap = {};
  for (const h of headers) {
    const key = String(h ?? '').trim();
    if (!key || key.startsWith('__')) continue;
    const field = ORDER.find((f) => !map[f] && HEADER_PATTERNS[f].test(key));
    if (field) map[field] = h;
  }
  return map;
}

const isMassUnit = (u: string) => !!u && convertQuantity(1, u, 'kg') !== null;
const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

export interface BomOptions {
  /** Mass units named in headers ("Weight (kg)"), from the sheet reader. */
  massHints?: Record<string, string>;
  decimalComma?: boolean;
}

/**
 * Build a ProcessModel from BOM rows (array of {header: value} objects).
 * `productName` names the assembly (falls back to the file name).
 */
export function structureBom(
  rows: Array<Record<string, unknown>>,
  docName: string,
  productName?: string,
  opts: BomOptions = {},
): ProcessModel {
  const headers = rows.length ? Object.keys(rows[0]).filter((h) => !h.startsWith('__')) : [];
  const cols = detectBomColumns(headers);
  const dc = !!opts.decimalComma;
  const loc = `BOM ${docName}`;
  const product = (productName || docName.replace(/\.(csv|xlsx?|tsv)$/i, '')).trim() || 'Assembled product';

  const nodes: IngestNode[] = [];
  const flows: IngestFlow[] = [];
  const costs: IngestCost[] = [];
  const notes: string[] = [];

  nodes.push({
    name: product,
    tier: 'product',
    parent: null,
    description: `Assembled product — bill of materials ingested from ${docName}.`,
    quantity: 1,
    unit: 'unit',
    provenance: { doc: docName, locator: loc, snippet: `product=${product}` },
  });
  // Lines land on one "Purchased materials" operation in a new case; appended
  // to a routing case, each line is placed on its own step at review.
  const leaf = product.toLowerCase() === 'purchased materials' ? 'Purchased materials (BOM)' : 'Purchased materials';
  nodes.push({ name: leaf, tier: 'operation', parent: product, quantity: 1, unit: 'unit', provenance: { doc: docName, locator: loc } });

  // Indented BOM: an assembly row is followed by deeper rows (its parts).
  const levelOf = (r: Record<string, unknown>): number | null => {
    if (!cols.level) return null;
    const v = String(r[cols.level] ?? '').trim();
    if (!v) return null;
    if (/^\d+(\.\d+)+$/.test(v)) return v.split('.').length;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const levels = rows.map(levelOf);
  const isAssembly = (i: number): boolean => {
    const l = levels[i];
    if (l === null) return false;
    for (let j = i + 1; j < rows.length; j++) {
      const lj = levels[j];
      if (lj !== null) return lj > l;
    }
    return false;
  };

  let held = 0;
  let assemblies = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = Number(r.__row) || i + 2;
    if (isAssembly(i)) {
      assemblies++;
      continue;
    }
    const cell = (c?: string) => (c ? String(r[c] ?? '').trim() : '');
    const label = cell(cols.description) || cell(cols.part);
    const material = cell(cols.material);
    const substanceText = material || label;
    if (!substanceText) continue;
    const opHint = cell(cols.opHint);

    const q = cols.quantity ? parseQuantity(r[cols.quantity], { decimalComma: dc }) : null;
    const unit = cell(cols.unit) || q?.unit || '';
    const w = cols.weight ? parseQuantity(r[cols.weight], { decimalComma: dc }) : null;
    const wUnit =
      cell(cols.weightUnit) ||
      w?.unit ||
      (cols.weight ? opts.massHints?.[cols.weight] ?? '' : '') ||
      (!cols.quantity ? unit : '');

    // Mass: count × per-part weight, or a quantity already in a mass unit.
    let massQty: number | null = null;
    let massUnit = '';
    let how = '';
    if (w && w.value > 0 && isMassUnit(wUnit)) {
      const count = q?.value ?? 1;
      massQty = count * w.value;
      massUnit = wUnit;
      how = q ? ` (${q.value} × ${w.value} ${wUnit})` : '';
    } else if (q && isMassUnit(unit)) {
      massQty = q.value;
      massUnit = unit;
    }
    if (q?.estimate || w?.estimate) {
      notes.push(`Line "${label || material}": a range was given; the midpoint was used — check it.`);
    }

    const prov: Provenance = {
      doc: docName,
      locator: `${loc}, row ${rowNo}`,
      snippet: `${label || material}${q ? ` qty=${q.value} ${unit}` : ''}${how}`,
    };

    if (massQty !== null && massQty > 0) {
      flows.push({
        node: leaf,
        substance_text: substanceText,
        direction: 'input',
        quantity: round(massQty, 6),
        unit: massUnit,
        provenance: prov,
        label: label || undefined,
        op_hint: opHint || undefined,
      });
    } else {
      held++;
      notes.push(
        `Line "${label || material}" has no mass (` +
          `${q ? `${q.value} ${unit || '?'}` : 'no quantity'}) — needs a per-part mass to ` +
          `contribute a material impact; not counted.`,
      );
    }

    // Purchased-part cost: an extended/total cost is the line total; a unit
    // cost is per unit of the quantity, so it is multiplied by it.
    const ext = cols.extCost ? parseQuantity(r[cols.extCost], { decimalComma: dc }) : null;
    const uc = cols.unitCost ? parseQuantity(r[cols.unitCost], { decimalComma: dc }) : null;
    const qtyForCost = q?.value ?? 1;
    const amount = ext ? ext.value : uc ? uc.value * qtyForCost : null;
    if (amount !== null && amount !== 0) {
      costs.push({
        node: leaf,
        category: 'material',
        amount: round(amount, 2),
        basis: ext
          ? `line cost from BOM${label ? ` (${label})` : ''}`
          : `${qtyForCost} ${unit || 'ea'} × $${uc!.value} from BOM${label ? ` (${label})` : ''}`,
        provenance: prov,
        label: label || undefined,
        op_hint: opHint || undefined,
      });
    }
  }

  if (!cols.material && !cols.part && !cols.description) {
    notes.push('No recognizable part/material column found — check the BOM headers.');
  }
  if (held) {
    notes.push(`${held} line(s) had no mass and were left out of the impact — add a mass/weight column to include them.`);
  }
  if (assemblies) {
    notes.push(`${assemblies} assembly row(s) were not counted again: their parts are listed under them.`);
  }
  // Nothing silently lost: report every column we did NOT map.
  notes.push(...unmappedColumnNotes(rows, Object.values(cols)));

  return { product_name: product, case_name: product.slice(0, 100), nodes, flows, costs, source_docs: [docName], notes };
}
