/**
 * Sizes of the columns the API writes client values into.
 *
 * Read from information_schema of the fully migrated schema (lcapix_bugs38,
 * baseline + every migration, 2026-09-30); tests/db/field-limits.test.ts checks
 * every entry against each fresh test database, so a migration that resizes a
 * column fails that test until this file follows.
 *
 * MySQL runs in strict mode: a value longer than its column, or a number
 * outside a DECIMAL's range, is refused and the route used to answer 500. The
 * routes check against these limits first and answer 400 naming the field.
 *
 *   - VARCHAR(n) holds n characters (utf8mb4: code points, so an emoji is one);
 *   - TEXT holds 65,535 bytes, whatever the character count;
 *   - DECIMAL(p, s) holds up to 10^(p-s) - 10^-s.
 */

export type ColumnLimit =
  | { kind: 'chars'; max: number }
  | { kind: 'bytes'; max: number }
  | { kind: 'decimal'; precision: number; scale: number };

const varchar = (max: number) => ({ kind: 'chars', max }) as const;
const TEXT = { kind: 'bytes', max: 65_535 } as const;
const decimal = (precision: number, scale: number) => ({ kind: 'decimal', precision, scale }) as const;

export const COLUMN_LIMITS = {
  project: {
    project_name: varchar(100),
    description: TEXT,
    goal_statement: TEXT,
    functional_unit: varchar(255),
    boundary_notes: TEXT,
    lcia_method: varchar(64),
    region_code: varchar(32),
  },
  case_table: {
    case_name: varchar(100),
    description: TEXT,
    region_code: varchar(20),
    reference_flow: decimal(15, 6),
    reference_flow_unit: varchar(50),
    modeled_output: decimal(15, 6),
    interpretation: TEXT,
    assumptions: TEXT,
  },
  component: {
    component_name: varchar(200),
    quantity: decimal(15, 6),
    unit: varchar(50),
    description: TEXT,
    process_type: varchar(100),
    driver_category: varchar(100),
    driver_type: varchar(100),
    labor_occupation: varchar(10),
    labor_hours: decimal(10, 4),
    opex: decimal(15, 2),
    capex: decimal(15, 2),
    labor_cost: decimal(15, 2),
    energy_cost: decimal(15, 2),
    transportation_cost: decimal(15, 2),
    material_cost: decimal(15, 2),
    equipment_cost: decimal(15, 2),
    overhead_cost: decimal(15, 2),
    currency: varchar(3),
    allocation_factor: decimal(8, 6),
    allocation_note: varchar(500),
    life_cycle_stage: varchar(32),
  },
  flows: {
    unit: varchar(50),
    driver_description: TEXT,
    transport_distance_km: decimal(18, 3),
    transport_mode: varchar(40),
  },
  account: {
    username: varchar(50),
    full_name: varchar(120),
    company: varchar(160),
    role: varchar(120),
    use_case: varchar(60),
    country: varchar(80),
    email: varchar(100),
  },
} as const satisfies Record<string, Record<string, ColumnLimit>>;

export type TextLimit = Extract<ColumnLimit, { kind: 'chars' | 'bytes' }>;
export type DecimalLimit = Extract<ColumnLimit, { kind: 'decimal' }>;

/** The largest value a DECIMAL(p, s) column holds, e.g. DECIMAL(15,2) -> 9,999,999,999,999.99. */
export function decimalMax(limit: DecimalLimit): number {
  return Number(`${'9'.repeat(limit.precision - limit.scale)}.${'9'.repeat(limit.scale)}`);
}

/** Characters as MySQL counts them (code points, not UTF-16 units). */
export function charLength(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Why `value` does not fit the column, or null when it does. Only strings are
 * measured: absent, null and non-string values are for the route's own type
 * checks (a number or boolean is always far shorter than any column here).
 */
export function lengthError(label: string, value: unknown, limit: TextLimit): string | null {
  if (typeof value !== 'string') return null;
  if (limit.kind === 'chars') {
    return charLength(value) > limit.max ? `${label} must be at most ${limit.max} characters` : null;
  }
  return byteLength(value) > limit.max ? `${label} is too long (at most ${limit.max} bytes)` : null;
}

/** The first of several [label, value, limit] checks that fails, or null. */
export function firstLengthError(checks: Array<[string, unknown, TextLimit]>): string | null {
  for (const [label, value, limit] of checks) {
    const error = lengthError(label, value, limit);
    if (error) return error;
  }
  return null;
}

/**
 * Cut `s` to fit a column (for text the server composes, such as a numbered
 * copy name, never for text the user typed: that gets a 400 instead).
 */
export function fitToColumn(s: string, limit: TextLimit): string {
  if (limit.kind === 'chars') return charLength(s) <= limit.max ? s : Array.from(s).slice(0, limit.max).join('');
  if (byteLength(s) <= limit.max) return s;
  let out = '';
  let bytes = 0;
  for (const ch of s) {
    const b = byteLength(ch);
    if (bytes + b > limit.max) break;
    out += ch;
    bytes += b;
  }
  return out;
}
