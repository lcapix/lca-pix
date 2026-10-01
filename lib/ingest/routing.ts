// Routing / Bill-of-Process connector — TS, deterministic. A routing (a.k.a.
// traveler, route sheet) is how a plant records the SEQUENCE OF OPERATIONS to
// make a product. This is the process-side twin of the BOM: where the BOM gives
// the material inputs, the routing gives the process SKELETON — the lines,
// stations, and operations — plus per-operation hours.
//
// The tree is only as deep as the document: product → [a line node per value
// of a line/plant column, when there is one] → [a subprocess per work center,
// when there is a work-center column] → one operation per routing row. No
// level is invented. The operation is the terminating node: its hours become a
// labor cost ON THE OPERATION (real hours × a cited representative wage).
//
// Real exports state time many ways, and all of them are read as written:
// minutes vs hours (from the header "(min)", a companion unit column such as
// SAP's repeated "Unit", or the cell "20 min" / "1:30"), times per BASE
// QUANTITY (SAP: per 100), Epicor production standards (HP / MP / PH / PM),
// and rows typed Setup vs Process. Setup is per LOT, never per product: it is
// spread over the lot size when one is known, otherwise left out of the
// per-unit labor and called out. No hours are invented; every unmapped column
// is surfaced.

import type { IngestCost, IngestNode, ProcessModel } from './schema';
import { getLaborRate } from '@/lib/integrations/reference-rates';
import { unmappedColumnNotes } from './columns';
import { parseDurationHours, parseQuantity, timeUnit, type TimeUnit } from './parse-values';

export interface RoutingColumnMap {
  seq?: string;
  description?: string;
  line?: string;
  workCenter?: string;
  setupHrs?: string;
  runHrs?: string;
  laborHrs?: string;
  machineHrs?: string;
  baseQty?: string;
  lotSize?: string;
  stdFormat?: string;
  rowType?: string;
  timeUnit?: string;
}
type Field = keyof RoutingColumnMap;

const HEADER_PATTERNS: Record<Field, RegExp> = {
  seq: /^(op|opr|oper|op\s*(no|nbr|num|number|#|seq)|operation\s*(no|nbr|number|#|seq|id)|seq|sequence|seq\s*no|step|step\s*(no|#)|activity\s*(no|#)|line\s*no)$/i,
  description: /^(description|operation|operation\s*(description|name|text)|activity|task|process\s*step|work\s*description|op\s*desc(ription)?|step\s*(description|name)|process)$/i,
  // A department / resource group holds several work centers (Epicor JCDept
  // and ResourceGrp, SAP work centers under a plant area): the coarser group.
  line: /^(line|production\s*line|plant|area|shop|site|department|dept|resource\s*group|work\s*cent(er|re)\s*group|workstation\s*group)$/i,
  workCenter: /^(work\s*cent(er|re)(\s*(id|code))?|workcent(er|re)|wc|machine\s*(name|id)|resource|resource\s*(id|name)|cell|station|work\s*station|workstation|op\s*code|opcode)$/i,
  setupHrs: /^(setup|set-?up|setup\s*(hrs?|hours|time|std)|est\s*set\s*hours|estsethours|changeover(\s*time)?)(\s*(per|\/)\s*(unit|piece|pc|ea|each|part))?$/i,
  laborHrs: /^(labor|labour|labor\s*(hrs?|hours|time|std)|labour\s*(hrs?|hours|time)|operator\s*(hours|time)|man\s*hours|manhours|direct\s*labor)(\s*(per|\/)\s*(unit|piece|pc|ea|each|part))?$/i,
  machineHrs: /^(machine\s*(time|hrs?|hours|std))(\s*(per|\/)\s*(unit|piece|pc|ea|each|part))?$/i,
  runHrs: /^(run|run\s*(hrs?|hours|time|std)|cycle|cycle\s*time|prod\s*std|prodstd|production\s*standard|operation\s*time|time|time\s*in\s*mins?|duration|default\s*duration|processing\s*time|std\s*time|standard\s*time|hours|hrs|est\s*prod\s*hours|estprodhours)(\s*(per|\/)\s*(unit|piece|pc|ea|each|part))?$/i,
  baseQty: /^(base\s*(quantity|qty)|batch\s*(size|qty|quantity)|per\s*qty)$/i,
  lotSize: /^(lot\s*size|lot\s*qty|run\s*qty|order\s*(qty|quantity)|job\s*qty|production\s*qty)$/i,
  stdFormat: /^(std\s*format|stdformat|standard\s*format)$/i,
  rowType: /^(type|time\s*type|step\s*type|operation\s*type)$/i,
  timeUnit: /^(time\s*unit|unit\s*of\s*time|time\s*uom)$/i,
};
const ORDER: Field[] = [
  'seq', 'description', 'line', 'workCenter', 'setupHrs', 'laborHrs', 'machineHrs', 'runHrs',
  'baseQty', 'lotSize', 'stdFormat', 'rowType', 'timeUnit',
];

/** Whether a cleaned header is one this connector understands (for table location). */
export function isRoutingHeader(h: string): boolean {
  const s = String(h ?? '').trim();
  return /^(operation|op|machine)$/i.test(s) || ORDER.some((f) => HEADER_PATTERNS[f].test(s));
}

function numericShare(rows: Array<Record<string, unknown>>, col: string): number {
  let hits = 0;
  let total = 0;
  for (const r of rows.slice(0, 50)) {
    const v = r[col];
    if (v === '' || v === null || v === undefined) continue;
    total++;
    if (parseDurationHours(v) !== null) hits++;
  }
  return total ? hits / total : 0;
}

/**
 * Detect which routing columns hold which field. Header text first; for the
 * ambiguous headers a CONTENT check decides: "Operation" holding numbers is the
 * step number (SAP), holding text it is the step name; "Machine" holding
 * numbers is machine time (SAP), holding names it is the work center.
 */
export function detectRoutingColumns(
  headers: string[],
  rows: Array<Record<string, unknown>> = [],
  timeHints: Record<string, TimeUnit> = {},
): RoutingColumnMap {
  const cands: Partial<Record<Field, string[]>> = {};
  for (const raw of headers) {
    const h = String(raw ?? '').trim();
    if (!h || h.startsWith('__')) continue;
    let field: Field | null;
    if (/^(operation|op)$/i.test(h)) field = rows.length && numericShare(rows, raw) >= 0.7 ? 'seq' : 'description';
    else if (/^machine$/i.test(h)) field = rows.length && numericShare(rows, raw) < 0.5 ? 'workCenter' : 'machineHrs';
    else field = ORDER.find((f) => HEADER_PATTERNS[f].test(h)) ?? null;
    if (field) (cands[field] ??= []).push(raw);
  }
  const hinted = (h: string) => !!timeHints[h] || /min|hour|hrs?\b|sec/i.test(h);
  const pick = (f: Field, prefer?: (h: string) => boolean): string | undefined => {
    const list = cands[f] ?? [];
    return (prefer ? list.find(prefer) : undefined) ?? list[0];
  };
  const hasStdFormat = !!cands.stdFormat?.length;
  return {
    seq: pick('seq'),
    description: pick('description', (h) => /desc|name|text/i.test(h)),
    line: pick('line'),
    workCenter: pick('workCenter', (h) => /work\s*cent|workstation|resource/i.test(h)),
    setupHrs: pick('setupHrs', hinted),
    laborHrs: pick('laborHrs', hinted),
    machineHrs: pick('machineHrs', hinted),
    runHrs: pick('runHrs', hasStdFormat ? (h) => /prod\s*std|prodstd/i.test(h) : hinted),
    baseQty: pick('baseQty'),
    lotSize: pick('lotSize'),
    stdFormat: pick('stdFormat'),
    rowType: pick('rowType'),
    timeUnit: pick('timeUnit'),
  };
}

export interface RoutingOptions {
  /** Units per lot (from the import screen or a lot-size column): spreads setup. */
  lotSize?: number | null;
  /** Time units named in headers ("Time (min)"), from the sheet reader. */
  timeHints?: Record<string, TimeUnit>;
  decimalComma?: boolean;
}

const fmtH = (x: number) => String(Number(x.toPrecision(4)));

/** Build a skeleton ProcessModel from routing rows. */
export function structureRouting(
  rows: Array<Record<string, unknown>>,
  docName: string,
  productName?: string,
  opts: RoutingOptions = {},
): ProcessModel {
  const headers = rows.length ? Object.keys(rows[0]).filter((h) => !h.startsWith('__')) : [];
  const hints = opts.timeHints ?? {};
  const cols = detectRoutingColumns(headers, rows, hints);
  const dc = !!opts.decimalComma;
  const loc = `Routing ${docName}`;
  const product =
    (productName || docName.replace(/\.(csv|xlsx?|tsv)$/i, '')).trim() || 'Manufactured product';

  const nodes: IngestNode[] = [];
  const costs: IngestCost[] = [];
  const notes: string[] = [];

  nodes.push({
    name: product,
    tier: 'product',
    parent: null,
    description: `Manufactured product — process routing ingested from ${docName}.`,
    quantity: 1,
    unit: 'unit',
    provenance: { doc: docName, locator: loc, snippet: `product=${product}` },
  });

  // Node names must be unique across the plan; the product name is taken first.
  const usedNames = new Set<string>([product]);
  const uniq = (base: string): string => {
    let name = base.slice(0, 118) || 'Step';
    let i = 2;
    while (usedNames.has(name)) name = `${base.slice(0, 112)} (${i++})`;
    usedNames.add(name);
    return name;
  };
  // Grouping nodes exist only for values the document states.
  const groups = new Map<string, string>();
  const groupFor = (tier: 'machine_line' | 'subprocess', value: string, parent: string, row: number): string => {
    const key = `${tier}|${parent}|${value}`;
    const existing = groups.get(key);
    if (existing) return existing;
    const name = uniq(value);
    groups.set(key, name);
    nodes.push({ name, tier, parent, provenance: { doc: docName, locator: `${loc}, row ${row}`, snippet: value } });
    return name;
  };

  // A time cell's unit: companion unit column ("Setup unit"), header hint
  // ("(min)"), or a shared time-unit column; a unit in the cell wins over all.
  const unitFor = (col: string | undefined, r: Record<string, unknown>): TimeUnit | null => {
    if (!col) return null;
    return timeUnit(r[`${col} unit`]) ?? hints[col] ?? (cols.timeUnit ? timeUnit(r[cols.timeUnit]) : null);
  };
  const hoursOf = (col: string | undefined, r: Record<string, unknown>): number | null =>
    col ? parseDurationHours(r[col], unitFor(col, r), { decimalComma: dc }) : null;

  let opCount = 0;
  let setupExcluded = 0;
  let setupOps = 0;
  let baseDivided = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = Number(r.__row) || i + 2;
    const seq = cols.seq ? String(r[cols.seq] ?? '').trim() : '';
    const desc = cols.description ? String(r[cols.description] ?? '').trim() : '';
    const lineVal = cols.line ? String(r[cols.line] ?? '').trim() : '';
    const wc = cols.workCenter ? String(r[cols.workCenter] ?? '').trim() : '';

    const opLabel = desc || (seq ? `Operation ${seq}` : '');
    if (!opLabel) continue; // a blank row is not an operation

    let setupH = hoursOf(cols.setupHrs, r) ?? 0;
    let runH = hoursOf(cols.runHrs, r);
    // Epicor production standard: ProdStd in the format StdFormat names.
    if (cols.stdFormat && cols.runHrs) {
      const f = String(r[cols.stdFormat] ?? '').trim().toUpperCase();
      const std = parseQuantity(r[cols.runHrs], { decimalComma: dc })?.value ?? null;
      if (std !== null && std > 0) {
        if (f === 'HP') runH = std;
        else if (f === 'MP') runH = std / 60;
        else if (f === 'PH') runH = 1 / std;
        else if (f === 'PM') runH = 1 / (60 * std);
        else if (f === 'HR' || f === 'OH') {
          setupH += std; // fixed hours per operation, not per piece
          runH = 0;
        }
      }
    }
    let laborH = hoursOf(cols.laborHrs, r);
    let machineH = hoursOf(cols.machineHrs, r);
    // Times per base quantity (SAP: per 100 pieces) → per unit.
    const base = cols.baseQty ? parseQuantity(r[cols.baseQty], { decimalComma: dc })?.value ?? 1 : 1;
    if (base > 0 && base !== 1) {
      if (runH !== null) runH /= base;
      if (laborH !== null) laborH /= base;
      if (machineH !== null) machineH /= base;
      baseDivided++;
    }
    // A row typed Setup / Fixed is per lot, not per product.
    const type = cols.rowType ? String(r[cols.rowType] ?? '').toLowerCase() : '';
    if (/setup|fixed|per\s*order|changeover/.test(type)) {
      setupH += laborH ?? runH ?? 0;
      runH = 0;
      if (laborH !== null) laborH = 0;
    }
    const rowLot = cols.lotSize ? parseQuantity(r[cols.lotSize], { decimalComma: dc })?.value ?? null : null;
    const lot = opts.lotSize && opts.lotSize > 0 ? opts.lotSize : rowLot && rowLot > 0 ? rowLot : null;

    let parent = product;
    if (lineVal) parent = groupFor('machine_line', lineVal, parent, rowNo);
    if (wc) parent = groupFor('subprocess', wc, parent, rowNo);
    const opName = uniq(seq ? `${seq}. ${opLabel}` : opLabel);
    const description = [
      wc ? `Work center: ${wc}` : null,
      machineH ? `Machine time: ${fmtH(machineH)} h per unit` : null,
    ]
      .filter(Boolean)
      .join('; ');
    nodes.push({
      name: opName,
      tier: 'operation',
      parent,
      description: description || undefined,
      provenance: { doc: docName, locator: `${loc}, row ${rowNo}`, snippet: opLabel },
    });
    // The operation IS the unit process — the terminating node (ISO 14044 /
    // ecoinvent). Its inputs and outputs are EXCHANGES on the operation, its
    // labor / machine are its costs; every tier above is a pure sum.
    opCount++;

    // Labor per unit = run (or labor) hours + setup ÷ lot. Real hours, cited rate.
    let perUnit = laborH ?? runH ?? 0;
    const parts: string[] = [];
    if (perUnit) parts.push(`${laborH !== null ? 'labor' : 'run'} ${fmtH(perUnit)} h`);
    if (setupH > 0) {
      if (lot) {
        perUnit += setupH / lot;
        parts.push(`setup ${fmtH(setupH)} h ÷ lot ${lot}`);
      } else {
        setupExcluded += setupH;
        setupOps++;
      }
    }
    const hours = Math.round(perUnit * 10000) / 10000;
    if (hours > 0) {
      const lr = getLaborRate(`${opLabel} ${wc}`);
      costs.push({
        node: opName,
        category: 'labor',
        amount: Math.round(lr.rate * hours * 100) / 100,
        // Hours from the routing; the wage is reference data, so it says so.
        basis: `${fmtH(hours)} h per unit (${parts.join(' + ')}) × $${lr.rate.toFixed(2)}/h ${lr.label}, BLS OEWS mean wage`,
        provenance: { doc: docName, locator: `${loc}, row ${rowNo}` },
        // Kept so apply stores the multiplicands (hours × wage) on the step.
        hours,
        rate_label: lr.label,
        occupation: lr.soc,
      });
    }
  }

  if (!opCount) {
    notes.push('No operations found — check the routing has a description/operation column.');
  }
  if (!cols.setupHrs && !cols.runHrs && !cols.laborHrs && !cols.machineHrs) {
    notes.push(
      `No hours column found, so these operations carry no labor cost. Columns read: ${Object.keys(
        rows[0] ?? {},
      )
        .filter((c) => !c.startsWith('__'))
        .join(', ')}. Rename the time column to something like "Run Hours" or add the hours per step by hand.`,
    );
  } else if (!cols.runHrs && !cols.laborHrs && !cols.machineHrs && cols.setupHrs) {
    // Setup alone is per lot, not per unit. Without a lot size nothing can be
    // spread, so the routing lands with no labor at all — silently, until now.
    notes.push(
      'The only time column found is setup, which is per lot rather than per unit. Enter the lot size so it can be spread (setup ÷ lot), or the operations will carry no labor cost.',
    );
  }
  if (setupExcluded > 0) {
    notes.push(
      `Setup time (${fmtH(setupExcluded)} h across ${setupOps} operation(s)) is per lot, not per product, so it is not in the per-unit labor. Enter the lot size to spread it over each unit (setup ÷ lot size).`,
    );
  }
  if (baseDivided) notes.push(`Times were divided by the base quantity on ${baseDivided} operation(s) to get hours per unit.`);
  notes.push(...unmappedColumnNotes(rows, Object.values(cols)));

  return {
    product_name: product,
    case_name: product.slice(0, 100),
    nodes,
    flows: [],
    costs,
    source_docs: [docName],
    notes,
  };
}
