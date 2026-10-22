/**
 * Unit normalization and conversion — the ONE place a unit string is read.
 *
 * Characterization factors are stated per a unit (the factor label's
 * denominator, else the substance's unit: kg, kWh, m3, tkm, …). Flow
 * quantities arrive in whatever unit the user or an imported document used.
 * Before a factor is applied the quantity MUST be expressed in the factor's
 * unit; multiplying mismatched units silently produces numbers that are wrong
 * by orders of magnitude (g vs kg = 1000×).
 *
 * Policy: convertible units are converted (and the conversion recorded);
 * unconvertible or ambiguous units are EXCLUDED from the calculation and
 * surfaced as a loud warning — never silently multiplied through.
 *
 * Every caller reads units through the functions below: the engine
 * (toFactorBasis), the flow routes' save-time guard (convertQuantity), ingest
 * mapping (convertQuantity), the flow editor (compatibleUnits) and custom
 * substances (normalizeUnit). They share one normaliser, unitKey(), so a
 * spelling cannot be accepted in one place and read differently in another.
 * tests/lib/unit-agreement.test.ts holds the validator and the engine to that.
 *
 * Reading rules:
 *   - Unicode is NFKC-folded (m³ → m3, ｋｇ → kg), the multiplication dots
 *     · ⋅ ∙ • × become '*', an exponent caret before a digit is dropped
 *     (m^3 → m3), spaces around '*' and '-' are dropped and other whitespace
 *     (including no-break space) collapses to one space.
 *   - Letter case is ignored EXCEPT the SI m/M prefix, where case is the
 *     magnitude: mg (milligram) vs Mg (megagram), mL vs ML (megalitre),
 *     MWh vs mWh, MJ vs mJ, 10^9 apart. A spelling in the wrong case is
 *     rejected as ambiguous, not guessed.
 *   - Known-ambiguous spellings are rejected with a reason: 'ton'/'tons'
 *     (short or metric), 'mt' (metric ton or megatonne).
 *
 * Pure module: no DB, fully unit-testable.
 */

export type Family = 'mass' | 'energy' | 'volume' | 'transport' | 'time' | 'area' | 'count';

interface UnitDef {
  canonical: string;
  family: Family;
  toBase: number;
}

/** Normalised lower-case key → canonical spelling + family + factor to the
 * family's base unit (base: kg, kWh, m3, tkm, h, m2, units). Keys are ASCII:
 * Unicode and operator variants reach them through unitKey(). */
const UNITS: Record<string, UnitDef> = {
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
  // US short ton (2,000 lb). Bare 'ton'/'tons' is NOT mapped (see AMBIGUOUS).
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
  l:    { canonical: 'L',   family: 'volume', toBase: 0.001 },
  liter:{ canonical: 'L',   family: 'volume', toBase: 0.001 },
  litre:{ canonical: 'L',   family: 'volume', toBase: 0.001 },
  ml:   { canonical: 'mL',  family: 'volume', toBase: 1e-6 },
  gal:  { canonical: 'gal', family: 'volume', toBase: 0.003785411784 },
  tgal: { canonical: 'Tgal', family: 'volume', toBase: 3.785411784 },
  // Natural-gas volumes in cubic feet (1 ft3 = 0.3048^3 m3 = 0.028316846592 m3).
  // US gas-industry prefixes: c = hundred, M = thousand, MM = million.
  // Geometric conversion only: scf and the m3 basis of the Natural Gas factor
  // are both standard-condition volumes (see CALCULATIONS.md, E7 note).
  ft3:  { canonical: 'ft3',   family: 'volume', toBase: 0.028316846592 },
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
  't-km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  't*km': { canonical: 'tkm', family: 'transport', toBase: 1 },
  'kg*km': { canonical: 'kg*km', family: 'transport', toBase: 0.001 },
  'kg-km': { canonical: 'kg*km', family: 'transport', toBase: 0.001 },
  // time → h
  h:    { canonical: 'h',   family: 'time', toBase: 1 },
  hr:   { canonical: 'h',   family: 'time', toBase: 1 },
  hour: { canonical: 'h',   family: 'time', toBase: 1 },
  min:  { canonical: 'min', family: 'time', toBase: 1 / 60 },
  s:    { canonical: 's',   family: 'time', toBase: 1 / 3600 },
  // area → m2
  m2:   { canonical: 'm2',  family: 'area', toBase: 1 },
  ft2:  { canonical: 'ft2', family: 'area', toBase: 0.09290304 },
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

/** Every key of the unit table, for tests that sweep all spellings. */
export const UNIT_TABLE_KEYS: readonly string[] = Object.freeze(Object.keys(UNITS));

/** Keys whose leading m/M is an SI prefix: the letter must be in this case. */
const SI_PREFIX_CASE: Record<string, { letter: 'm' | 'M'; why: string }> = {
  mg:  { letter: 'm', why: "milligram is 'mg'; 'Mg' would be a megagram (1 t), 10^9 larger" },
  ml:  { letter: 'm', why: "millilitre is 'mL'; 'ML' would be a megalitre, 10^9 larger" },
  mwh: { letter: 'M', why: "megawatt-hour is 'MWh'; 'mWh' would be a milliwatt-hour, 10^9 smaller" },
  mj:  { letter: 'M', why: "megajoule is 'MJ'; 'mJ' would be a millijoule, 10^9 smaller" },
};

/** Spellings that name two different quantities in common use. Never guessed. */
const AMBIGUOUS: Record<string, string> = {
  ton: "a short ton or a metric ton? US sources (EPA WARM, EIA) mean 907.18474 kg, the legacy flow editor means 1000 kg; write 'short ton' or 't'",
  tons: "short tons or metric tons? US sources (EPA WARM, EIA) mean 907.18474 kg, the legacy flow editor means 1000 kg; write 'short tons' or 't'",
  mt: "a metric ton or a megatonne? write 't'",
};

/**
 * Case-preserving normal form: NFKC, multiplication dots → '*', '^' before a
 * digit dropped, no spaces around '*' or '-', whitespace collapsed.
 */
function caseKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[·⋅∙•×]/g, '*')
    .replace(/\^(?=\d)/g, '')
    .replace(/\s*([*-])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lookup key: the case-preserving normal form, lower-cased. */
function unitKey(raw: string): string {
  return caseKey(raw).toLowerCase();
}

/** The table entry for a spelling, or undefined when unknown or ambiguous. */
function lookup(raw: string | null | undefined): UnitDef | undefined {
  if (!raw) return undefined;
  const ck = caseKey(raw);
  const key = ck.toLowerCase();
  if (AMBIGUOUS[key]) return undefined;
  const def = UNITS[key];
  if (!def) return undefined;
  const prefix = SI_PREFIX_CASE[key];
  if (prefix && ck[0] !== prefix.letter) return undefined;
  return def;
}

/**
 * Why a unit spelling cannot be used, or null when it can.
 * 'ambiguous …' for spellings that name two things, 'unrecognized …' for
 * spellings the table does not hold.
 */
export function unitProblem(raw: string | null | undefined): string | null {
  if (!raw || !caseKey(raw)) return 'no unit';
  if (lookup(raw)) return null;
  const key = unitKey(raw);
  if (AMBIGUOUS[key]) return `ambiguous unit '${raw.trim()}': ${AMBIGUOUS[key]}`;
  if (SI_PREFIX_CASE[key]) return `ambiguous unit '${raw.trim()}': ${SI_PREFIX_CASE[key].why}`;
  return `unrecognized unit '${raw.trim()}'`;
}

/** The unit's family (mass, energy, volume, transport, time, area, count), or null if unknown. */
export function unitFamily(raw: string | null | undefined): Family | null {
  return lookup(raw)?.family ?? null;
}

export function normalizeUnit(raw: string | null | undefined): string | null {
  return lookup(raw)?.canonical ?? null;
}

/**
 * Two spellings name the same unit, whatever that unit is: equal after
 * normalisation, ignoring letter case EXCEPT a flipped m/M (a flipped
 * magnitude: 'mt' vs 'Mt', 'ML' vs 'ml'). Identical strings always match.
 */
export function sameUnit(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ca = caseKey(a);
  const cb = caseKey(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length !== cb.length || ca.toLowerCase() !== cb.toLowerCase()) return false;
  for (let i = 0; i < ca.length; i++) {
    if (ca[i] !== cb[i] && (ca[i] === 'm' || ca[i] === 'M')) return false;
  }
  return true;
}

export interface Conversion {
  quantity: number;
  fromUnit: string;
  toUnit: string;
  factor: number;
  note: string; // human-readable, e.g. "1 MMBtu = 293.071 kWh"
}

/**
 * Convert a quantity between units. The same unit (sameUnit) is the identity,
 * even for units the table does not hold. Otherwise both units must be known,
 * unambiguous and in one family. Returns null for everything else — the
 * caller must treat that as "do not multiply", not as identity.
 *
 * This is the check the flow routes run at save time and the check the engine
 * runs at calculation time: one function, one answer.
 */
export function convertQuantity(
  quantity: number,
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): Conversion | null {
  if (!fromRaw || !toRaw) return null;
  if (sameUnit(fromRaw, toRaw)) {
    const name = lookup(fromRaw)?.canonical ?? caseKey(fromRaw);
    return { quantity, fromUnit: name, toUnit: name, factor: 1, note: `${name} = ${name}` };
  }
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

/**
 * Split a factor unit label into its reference unit (numerator) and the unit
 * it is stated per (denominator): 'kg CO2 eq / MMBtu' → { 'kg CO2 eq', 'MMBtu' }.
 * A bare label ('kg CO2 eq') has no denominator; the factor is then per the
 * substance's own unit.
 */
export function splitFactorUnit(label: string | null | undefined): {
  numerator: string;
  denominator: string | null;
} {
  const s = (label ?? '').trim();
  const i = s.indexOf('/');
  if (i < 0) return { numerator: s, denominator: null };
  const denominator = s.slice(i + 1).trim();
  return { numerator: s.slice(0, i).trim(), denominator: denominator || null };
}

export type BasisResolution =
  | { ok: true; quantity: number; basisUnit: string; note?: string }
  | { ok: false; reason: string };

/**
 * Express a flow quantity in the unit its factor is stated per, or refuse.
 *
 * The factor's basis is its own denominator when the label has one
 * ('kg CO2 eq / MMBtu'), otherwise the substance's unit. A denominator whose
 * unit family differs from the substance's unit means the factor row was
 * written for a different kind of quantity (a per-kg lumber factor on an MMBtu
 * fuel): refused, never applied. The flow quantity then goes through
 * convertQuantity — the same check the flow routes run at save time — so the
 * same unit passes as-is, same-family units convert with a note, and anything
 * else (unknown or ambiguous unit, cross-family, no flow unit) is refused with
 * a reason. There is no raw-multiply fallback.
 */
export function toFactorBasis(
  quantity: number,
  flowUnit: string | null | undefined,
  substanceUnit: string | null | undefined,
  factorUnit: string | null | undefined,
): BasisResolution {
  const sub = substanceUnit?.trim() || null;
  const { denominator } = splitFactorUnit(factorUnit);

  let basis: string | null = sub;
  if (denominator) {
    if (!sub || sameUnit(denominator, sub)) {
      basis = sub ?? denominator;
    } else {
      const df = unitFamily(denominator);
      const sf = unitFamily(sub);
      if (df && sf && df === sf) {
        basis = denominator;
      } else {
        return {
          ok: false,
          reason: `factor is stated per '${denominator}' (${df ?? 'unknown unit'}) but the substance is measured in '${sub}' (${sf ?? 'unknown unit'}); the factor row needs fixing`,
        };
      }
    }
  }
  if (!basis) {
    return { ok: false, reason: 'neither the substance nor the factor states a unit' };
  }

  const flow = flowUnit?.trim() || null;
  if (!flow) {
    return { ok: false, reason: `no unit recorded on the flow (factor is per '${basis}')` };
  }
  const conv = convertQuantity(quantity, flow, basis);
  if (!conv) {
    const flowProblem = unitProblem(flow);
    const basisProblem = unitProblem(basis);
    let reason: string;
    if (flowProblem) reason = `${flowProblem} (factor is per '${basis}')`;
    else if (basisProblem) {
      reason = `unit '${flow}' cannot be converted to '${basis}': ${basisProblem} and the units differ`;
    } else {
      reason = `unit '${flow}' cannot be converted to factor unit '${basis}' (${unitFamily(flow)} vs ${unitFamily(basis)})`;
    }
    return { ok: false, reason };
  }
  const note = conv.factor === 1 && conv.fromUnit === conv.toUnit ? undefined : conv.note;
  return note
    ? { ok: true, quantity: conv.quantity, basisUnit: basis, note }
    : { ok: true, quantity: conv.quantity, basisUnit: basis };
}
