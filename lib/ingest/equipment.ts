// Equipment list connector — TS, deterministic. A plant keeps a list of its
// machines (a maintenance asset register, or the equipment inventory of an
// energy audit) with each machine's rated power and the work center it sits
// in. The routing already says how many hours each operation spends at its
// work center, so the electricity an operation uses per unit is
//
//     rated kW × typical load × hours per unit
//
// the estimate industrial energy audits use when machines are not
// sub-metered, and the patent's driver factor × driver value (kW per machine
// hour × machine hours). It fills the one quantity ERP routings lack.
//
// The list never creates steps. It adds electricity (and its cost at the
// reference industrial rate) to the operations of an EXISTING case, joined on
// the work center. A machine at a work center no step uses, or a step without
// hours, is reported, never guessed.

import type { IngestCost, IngestFlow, IngestNode, ProcessModel } from './schema';
import { ENERGY_RATES } from '@/lib/integrations/reference-rates';
import { unmappedColumnNotes } from './columns';
import { parseQuantity } from './parse-values';

export interface EquipmentColumnMap {
  asset?: string;
  workCenter?: string;
  power?: string;
  load?: string;
  count?: string;
  description?: string;
}
type Field = keyof EquipmentColumnMap;

const HEADER_PATTERNS: Record<Field, RegExp> = {
  asset: /^(asset|asset\s*(id|no|number|tag|#)|equipment\s*(id|no|number|tag)|tag\s*(no|#)?|machine\s*(id|no))$/i,
  workCenter: /^(work\s*cent(er|re)(\s*(id|code|no))?|workcent(er|re)|wc|resource(\s*id)?|cell|station|work\s*station|workstation|location)$/i,
  power: /^(rated\s*(power|input|kw|hp)|nameplate(\s*(power|rating|kw|hp))?|power(\s*rating)?|input\s*power|kw|hp|horsepower|motor\s*(kw|hp|rating)|connected\s*load|installed\s*power)$/i,
  load: /^(load|load\s*factor|typical\s*load|avg\.?\s*load|average\s*load|utili[sz]ation|duty\s*cycle)$/i,
  count: /^(qty|quantity|count|units|no\.?\s*of\s*(units|machines))$/i,
  description: /^(description|equipment|equipment\s*(name|description|type)|asset\s*(name|description)|machine|machine\s*(name|type)|name)$/i,
};
const ORDER: Field[] = ['asset', 'workCenter', 'power', 'load', 'count', 'description'];

/** Whether a cleaned header is one this connector understands (for table location). */
export function isEquipmentHeader(h: string): boolean {
  const s = String(h ?? '').trim();
  return ORDER.some((f) => HEADER_PATTERNS[f].test(s));
}

/** Detect which spreadsheet columns hold which equipment field, by header text. */
export function detectEquipmentColumns(headers: string[]): EquipmentColumnMap {
  const map: EquipmentColumnMap = {};
  for (const h of headers) {
    const key = String(h ?? '').trim();
    if (!key || key.startsWith('__')) continue;
    const field = ORDER.find((f) => !map[f] && HEADER_PATTERNS[f].test(key));
    if (field) map[field] = h;
  }
  return map;
}

/** A step of the target case, as the preview route reads it from the database. */
export interface CaseStep {
  id: number;
  name: string;
  /** The work center the routing put the step at, else its parent group. */
  workCenter: string | null;
  /** Hours per unit the routing gave the step (component.labor_hours). */
  hoursPerUnit: number | null;
}

export interface EquipmentOptions {
  productName: string;
  steps: CaseStep[];
  /** Power unit named in a header ("Rated power (hp)"), from the sheet reader. */
  powerHints?: Record<string, string>;
  decimalComma?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
const fmt = (x: number) => String(Number(x.toPrecision(3)));
const usd = (x: number) => `$${Number(x.toPrecision(3))}`; // $0.0862, not a rounded $0.09
const HP_TO_KW = 0.7457; // 1 mechanical horsepower = 745.7 W

/** Build energy flows (and their cost) for the case's steps from an equipment list. */
export function structureEquipment(
  rows: Array<Record<string, unknown>>,
  docName: string,
  opts: EquipmentOptions,
): ProcessModel {
  const headers = rows.length ? Object.keys(rows[0]).filter((h) => !h.startsWith('__')) : [];
  const cols = detectEquipmentColumns(headers);
  const dc = !!opts.decimalComma;
  const loc = `Equipment list ${docName}`;
  const rate = ENERGY_RATES.electricity_industrial;
  const product = opts.productName;

  const nodes: IngestNode[] = [
    { name: product, tier: 'product', parent: null, quantity: 1, unit: 'unit', provenance: { doc: docName, locator: loc } },
  ];
  const flows: IngestFlow[] = [];
  const costs: IngestCost[] = [];
  const notes: string[] = [];

  // Both documents come from the same plant, so work center names match as
  // written. An ID prefix ("WLD1" vs "WLD1 TIG station") also counts; a shared
  // ordinary word ("Assembly") does not.
  const stepsAt = (wc: string): CaseStep[] => {
    const n = norm(wc);
    if (!n) return [];
    const exact = opts.steps.filter((s) => s.workCenter && norm(s.workCenter) === n);
    if (exact.length) return exact;
    const id = n.split(' ')[0];
    if (!/\d/.test(id)) return [];
    return opts.steps.filter((s) => s.workCenter && norm(s.workCenter).split(' ')[0] === id);
  };

  const withEnergy = new Set<number>();
  const shownStep = new Set<string>();
  let noLoad = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = Number(r.__row) || i + 2;
    const cell = (c?: string) => (c ? String(r[c] ?? '').trim() : '');
    const wc = cell(cols.workCenter);
    const name = cell(cols.description) || cell(cols.asset) || `Machine on row ${rowNo}`;
    const p = cols.power ? parseQuantity(r[cols.power], { decimalComma: dc }) : null;
    if (!wc && !p) continue; // a blank or heading row

    const unit = (p?.unit || (cols.power ? opts.powerHints?.[cols.power] : '') || (cols.power && /hp|horse/i.test(cols.power) ? 'hp' : 'kw')).toLowerCase();
    let kw = p?.value ?? null;
    if (kw !== null && /^(hp|bhp|horsepower)$/.test(unit)) kw *= HP_TO_KW;
    else if (kw !== null && unit === 'w') kw /= 1000;
    if (kw === null || !(kw > 0)) {
      notes.push(`${name}${wc ? ` (${wc})` : ''}: no rated power, so no energy was estimated for it.`);
      continue;
    }
    const loadCell = cols.load ? String(r[cols.load] ?? '').replace('%', '').trim() : '';
    const lq = loadCell ? parseQuantity(loadCell, { decimalComma: dc }) : null;
    const load = lq && lq.value > 0 ? (lq.value > 1 ? lq.value / 100 : lq.value) : null;
    if (load === null) noLoad++;
    const count = (cols.count ? parseQuantity(r[cols.count], { decimalComma: dc })?.value : null) || 1;

    const targets = stepsAt(wc);
    if (!targets.length) {
      notes.push(
        wc
          ? `${name} (${fmt(kw)} kW) is at "${wc}", and no step in this case runs there, so it was not counted. Equipment shared by the whole plant (compressor, lighting) belongs at the product level or needs an allocation rule.`
          : `${name} (${fmt(kw)} kW) has no work center, so it cannot be tied to a step; not counted.`,
      );
      continue;
    }
    for (const s of targets) {
      if (!(s.hoursPerUnit && s.hoursPerUnit > 0)) {
        notes.push(`${s.name} has no hours per unit, so the energy of ${name} could not be estimated there. Its hours come from the routing.`);
        continue;
      }
      const lf = load ?? 1;
      const kwh = kw * lf * count * s.hoursPerUnit;
      if (!shownStep.has(s.name)) {
        nodes.push({ name: s.name, tier: 'operation', parent: product, provenance: { doc: docName, locator: loc } });
        shownStep.add(s.name);
      }
      const basis = `${fmt(kw)} kW${count !== 1 ? ` × ${count}` : ''} × ${Math.round(lf * 100)}% load × ${fmt(s.hoursPerUnit)} h per unit`;
      // One line per machine per step: the locator names the step so two steps
      // sharing a work center keep separate lines.
      const prov = { doc: docName, locator: `${loc}, row ${rowNo} → ${s.name}`, snippet: `${name}: ${basis}` };
      flows.push({
        node: s.name,
        substance_text: 'Electricity',
        direction: 'input',
        quantity: round(kwh, 4),
        unit: 'kWh',
        provenance: prov,
        label: `${name}: ${basis}`,
        attach_component_id: s.id,
      });
      const amount = round(kwh * rate.rate, 2);
      if (amount > 0) {
        costs.push({
          node: s.name,
          category: 'energy',
          amount,
          basis: `${fmt(kwh)} kWh × ${usd(rate.rate)}/kWh (${rate.label})`,
          provenance: prov,
          label: name,
          attach_component_id: s.id,
        });
      }
      withEnergy.add(s.id);
    }
  }

  if (!cols.workCenter || !cols.power) {
    notes.push('The list needs a work center column and a rated power column to tie machines to steps.');
  }
  if (flows.length) {
    notes.push(
      `Energy per step = rated kW × typical load × the step's hours per unit from the routing. Electricity is costed at ${usd(rate.rate)}/kWh (${rate.label}).`,
    );
  }
  if (noLoad) {
    notes.push(`${noLoad} machine(s) had no load given, so their full rated power was used: an upper bound.`);
  }
  const idle = opts.steps.filter((s) => !withEnergy.has(s.id));
  if (idle.length && flows.length) {
    notes.push(`No machine on the list for: ${idle.map((s) => s.name).join(', ')}. These steps get no machine energy (manual work, or a machine missing from the list).`);
  }
  notes.push(...unmappedColumnNotes(rows, Object.values(cols)));

  return {
    product_name: product,
    case_name: `Energy from ${docName}`.slice(0, 100),
    nodes,
    flows,
    costs,
    source_docs: [docName],
    notes,
  };
}
