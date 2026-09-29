/**
 * Unit normalization and conversion.
 *
 * Characterization factors are stored per the substance's default unit
 * (kg, kWh, m3, tkm, …). Flow quantities arrive in whatever unit the user or
 * an imported document used. Before a factor is applied the quantity MUST be
 * expressed in the factor's unit; multiplying mismatched units silently
 * produces numbers that are wrong by orders of magnitude (g vs kg = 1000×).
 *
 * Policy: convertible units are converted (and the conversion recorded);
 * unconvertible pairs are EXCLUDED from the calculation and surfaced as a
 * loud warning — never silently multiplied through.
 *
 * Pure module: no DB, fully unit-testable.
 */

export type Family = 'mass' | 'energy' | 'volume' | 'transport' | 'time' | 'area' | 'count';

/** canonical spelling + family + factor to the family's base unit
 * (base: kg, kWh, m3, tkm, h, m2, units) */
const UNITS: Record<string, { canonical: string; family: Family; toBase: number }> = {
  // mass → kg
  kg:   { canonical: 'kg',  family: 'mass', toBase: 1 },
  kilogram:  { canonical: 'kg', family: 'mass', toBase: 1 },
  kilograms: { canonical: 'kg', family: 'mass', toBase: 1 },
  g:    { canonical: 'g',   family: 'mass', toBase: 0.001 },
  gram: { canonical: 'g',   family: 'mass', toBase: 0.001 },
  grams:{ canonical: 'g',   family: 'mass', toBase: 0.001 },
  mg:   { canonical: 'mg',  family: 'mass', toBase: 1e-6 },
  t:    { canonical: 't',   family: 'mass', toBase: 1000 },
  tonne:{ canonical: 't',   family: 'mass', toBase: 1000 },
  tonnes:{ canonical: 't',  family: 'mass', toBase: 1000 },
  lb:   { canonical: 'lb',  family: 'mass', toBase: 0.45359237 },
  lbs:  { canonical: 'lb',  family: 'mass', toBase: 0.45359237 },
  oz:   { canonical: 'oz',  family: 'mass', toBase: 0.028349523125 },
  // US short ton (2,000 lb). Bare 'ton'/'tons' is deliberately NOT mapped: the
  // legacy flow editor (components/environmental-flows.tsx) stores 'ton' to
  // mean a METRIC ton, while US sources (EPA WARM, EIA) mean a short ton. An
  // ambiguous unit is excluded with a warning rather than guessed.
  'short ton':  { canonical: 'short ton', family: 'mass', toBase: 907.18474 },
  'short tons': { canonical: 'short ton', family: 'mass', toBase: 907.18474 },
  st:           { canonical: 'short ton', family: 'mass', toBase: 907.18474 },
  // energy → kWh
  kwh:  { canonical: 'kWh', family: 'energy', toBase: 1 },
  wh:   { canonical: 'Wh',  family: 'energy', toBase: 0.001 },
  mwh:  { canonical: 'MWh', family: 'energy', toBase: 1000 },
  mj:   { canonical: 'MJ',  family: 'energy', toBase: 1 / 3.6 },
  gj:   { canonical: 'GJ',  family: 'energy', toBase: 1000 / 3.6 },
  kj:   { canonical: 'kJ',  family: 'energy', toBase: 1 / 3600 },
  btu:  { canonical: 'Btu', family: 'energy', toBase: 0.000293071 },
  mmbtu:{ canonical: 'MMBtu', family: 'energy', toBase: 293.071 },
  therm:{ canonical: 'therm', family: 'energy', toBase: 29.3071 },
  // volume → m3
  m3:   { canonical: 'm3',  family: 'volume', toBase: 1 },
  'm³': { canonical: 'm3',  family: 'volume', toBase: 1 },
  l:    { canonical: 'L',   family: 'volume', toBase: 0.001 },
  liter:{ canonical: 'L',   family: 'volume', toBase: 0.001 },
  litre:{ canonical: 'L',   family: 'volume', toBase: 0.001 },
  ml:   { canonical: 'mL',  family: 'volume', toBase: 1e-6 },
  'm^3':{ canonical: 'm3',  family: 'volume', toBase: 1 },
  gal:  { canonical: 'gal', family: 'volume', toBase: 0.003785411784 },
  tgal: { canonical: 'Tgal', family: 'volume', toBase: 3.785411784 },
  // Natural-gas volumes in cubic feet (1 ft3 = 0.3048^3 m3 = 0.028316846592 m3).
  // US gas-industry prefixes: c = hundred, M = thousand, MM = million.
  // Geometric conversion only: scf and the m3 basis of the Natural Gas factor
  // are both standard-condition volumes (see CALCULATIONS.md, E7 note).
  ft3:  { canonical: 'ft3',   family: 'volume', toBase: 0.028316846592 },
  'ft³':{ canonical: 'ft3',   family: 'volume', toBase: 0.028316846592 },
  cf:   { canonical: 'ft3',   family: 'volume', toBase: 0.028316846592 },
  scf:  { canonical: 'scf',   family: 'volume', toBase: 0.028316846592 },
  ccf:  { canonical: 'ccf',   family: 'volume', toBase: 2.8316846592 },
  mcf:  { canonical: 'Mcf',   family: 'volume', toBase: 28.316846592 },
  mscf: { canonical: 'Mscf',  family: 'volume', toBase: 28.316846592 },
  mmcf: { canonical: 'MMcf',  family: 'volume', toBase: 28316.846592 },
  mmscf:{ canonical: 'MMscf', family: 'volume', toBase: 28316.846592 },
  // transport work → tkm
  tkm:  { canonical: 'tkm', family: 'transport', toBase: 1 },
  'tonne-km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  'tonne*km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  'tonne·km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  't-km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  't*km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  't·km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  'kg*km': { canonical: 'kg*km', family: 'transport', toBase: 0.001 },
  'kg-km': { canonical: 'kg*km', family: 'transport', toBase: 0.001 },
  'kg·km': { canonical: 'kg*km', family: 'transport', toBase: 0.001 },
  // time → h
  h:    { canonical: 'h',   family: 'time', toBase: 1 },
  hr:   { canonical: 'h',   family: 'time', toBase: 1 },
  hour: { canonical: 'h',   family: 'time', toBase: 1 },
  min:  { canonical: 'min', family: 'time', toBase: 1 / 60 },
  s:    { canonical: 's',   family: 'time', toBase: 1 / 3600 },
  // area → m2
  m2:   { canonical: 'm2',  family: 'area', toBase: 1 },
  'm²': { canonical: 'm2',  family: 'area', toBase: 1 },
  'm^2':{ canonical: 'm2',  family: 'area', toBase: 1 },
  ft2:  { canonical: 'ft2', family: 'area', toBase: 0.09290304 },
  'ft²':{ canonical: 'ft2', family: 'area', toBase: 0.09290304 },
  // count (no physical conversion: one of anything is one unit). 'p' (the
  // ecoinvent/openLCA piece) is left out: a lone letter is too easy to misread,
  // and identical units never need the table anyway.
  unit: { canonical: 'units', family: 'count', toBase: 1 },
  units:{ canonical: 'units', family: 'count', toBase: 1 },
  pcs:  { canonical: 'units', family: 'count', toBase: 1 },
  piece:{ canonical: 'units', family: 'count', toBase: 1 },
  pieces:{ canonical: 'units', family: 'count', toBase: 1 },
  ea:   { canonical: 'units', family: 'count', toBase: 1 },
  each: { canonical: 'units', family: 'count', toBase: 1 },
  item: { canonical: 'units', family: 'count', toBase: 1 },
  items:{ canonical: 'units', family: 'count', toBase: 1 },
};

/** Lookup key: trimmed, lower-cased, inner whitespace collapsed to one space. */
function unitKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lookup(raw: string | null | undefined) {
  if (!raw) return undefined;
  return UNITS[unitKey(raw)];
}

/** The unit's family (mass, energy, volume, transport, time, area, count), or null if unknown. */
export function unitFamily(raw: string | null | undefined): Family | null {
  return lookup(raw)?.family ?? null;
}

export function normalizeUnit(raw: string | null | undefined): string | null {
  return lookup(raw)?.canonical ?? null;
}

export interface Conversion {
  quantity: number;
  fromUnit: string;
  toUnit: string;
  factor: number;
  note: string; // human-readable, e.g. "1 MMBtu = 293.071 kWh"
}

/**
 * Convert a quantity between units of the same family.
 * Returns null when the units are unknown or belong to different families —
 * the caller must treat that as "do not multiply", not as identity.
 */
export function convertQuantity(
  quantity: number,
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): Conversion | null {
  if (!fromRaw || !toRaw) return null;
  const from = lookup(fromRaw);
  const to = lookup(toRaw);
  if (!from || !to) return null;
  if (from.family !== to.family) return null;
  const factor = from.toBase / to.toBase;
  return {
    quantity: quantity * factor,
    fromUnit: from.canonical,
    toUnit: to.canonical,
    factor,
    note:
      factor === 1
        ? `${from.canonical} = ${to.canonical}`
        : `1 ${from.canonical} = ${factor} ${to.canonical}`,
  };
}

/** Units the flow editor should offer for a substance, given its default unit. */
export function compatibleUnits(defaultUnit: string | null | undefined): string[] {
  const target = lookup(defaultUnit);
  if (!target) return [];
  const seen = new Set<string>();
  for (const def of Object.values(UNITS)) {
    if (def.family === target.family) seen.add(def.canonical);
  }
  return Array.from(seen);
}
