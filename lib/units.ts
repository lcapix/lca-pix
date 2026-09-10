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

type Family = 'mass' | 'energy' | 'volume' | 'transport' | 'time' | 'area' | 'count';

/** canonical spelling + family + factor to the family's base unit
 * (base: kg, kWh, m3, tkm, h, m2, units) */
const UNITS: Record<string, { canonical: string; family: Family; toBase: number }> = {
  // mass → kg
  kg:   { canonical: 'kg',  family: 'mass', toBase: 1 },
  g:    { canonical: 'g',   family: 'mass', toBase: 0.001 },
  mg:   { canonical: 'mg',  family: 'mass', toBase: 1e-6 },
  t:    { canonical: 't',   family: 'mass', toBase: 1000 },
  tonne:{ canonical: 't',   family: 'mass', toBase: 1000 },
  lb:   { canonical: 'lb',  family: 'mass', toBase: 0.45359237 },
  lbs:  { canonical: 'lb',  family: 'mass', toBase: 0.45359237 },
  oz:   { canonical: 'oz',  family: 'mass', toBase: 0.028349523125 },
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
  gal:  { canonical: 'gal', family: 'volume', toBase: 0.003785411784 },
  tgal: { canonical: 'Tgal', family: 'volume', toBase: 3.785411784 },
  // transport work → tkm
  tkm:  { canonical: 'tkm', family: 'transport', toBase: 1 },
  // time → h
  h:    { canonical: 'h',   family: 'time', toBase: 1 },
  hr:   { canonical: 'h',   family: 'time', toBase: 1 },
  hour: { canonical: 'h',   family: 'time', toBase: 1 },
  min:  { canonical: 'min', family: 'time', toBase: 1 / 60 },
  s:    { canonical: 's',   family: 'time', toBase: 1 / 3600 },
  // area → m2
  m2:   { canonical: 'm2',  family: 'area', toBase: 1 },
  'm²': { canonical: 'm2',  family: 'area', toBase: 1 },
  ft2:  { canonical: 'ft2', family: 'area', toBase: 0.09290304 },
  'ft²':{ canonical: 'ft2', family: 'area', toBase: 0.09290304 },
  // count-ish (no physical conversion; equal units only)
  unit: { canonical: 'units', family: 'count', toBase: 1 },
  units:{ canonical: 'units', family: 'count', toBase: 1 },
  pcs:  { canonical: 'units', family: 'count', toBase: 1 },
  piece:{ canonical: 'units', family: 'count', toBase: 1 },
};

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return UNITS[key]?.canonical ?? null;
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
  const from = UNITS[fromRaw.trim().toLowerCase()];
  const to = UNITS[toRaw.trim().toLowerCase()];
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
  const target = defaultUnit ? UNITS[defaultUnit.trim().toLowerCase()] : undefined;
  if (!target) return [];
  const seen = new Set<string>();
  for (const def of Object.values(UNITS)) {
    if (def.family === target.family) seen.add(def.canonical);
  }
  return Array.from(seen);
}
