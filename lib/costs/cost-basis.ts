/**
 * What a step cost is made of (migrate-035, E14): a driver times a rate, the
 * rate's name, region and source. Pure rules shared by the costs route, the
 * auto-costs pass, the run snapshot and the case copy.
 *
 * Source kinds:
 *   reference  the app's dated reference table (REFERENCE_VINTAGE)
 *   live       a public API answered (BLS, EIA)
 *   entered    a person typed the rate or the amount
 * Only the server writes reference and live, after looking the rate up itself.
 */

import { z } from 'zod'

export const COST_BASIS_KINDS = [
  'labor',
  'energy',
  'material',
  'transportation',
  'equipment',
  'overhead',
] as const
export type CostBasisKind = (typeof COST_BASIS_KINDS)[number]

export type CostSourceKind = 'reference' | 'live' | 'entered'

/** The component column each kind's amount lives in. */
export const COST_COLUMN: Record<CostBasisKind, string> = {
  labor: 'labor_cost',
  energy: 'energy_cost',
  material: 'material_cost',
  transportation: 'transportation_cost',
  equipment: 'equipment_cost',
  overhead: 'overhead_cost',
}

/**
 * The kinds a direct edit of the step's columns leaves unexplained: their
 * amount changed, or (labor) the hours or occupation behind it did. An editor
 * that sends every column on save, unchanged, drops nothing.
 */
export function changedCostKinds(
  before: Record<string, unknown> | null | undefined,
  values: Array<[string, unknown]>,
): CostBasisKind[] {
  const differs = (col: string, next: unknown) => {
    const prev = before?.[col]
    if (col === 'labor_occupation') return String(prev ?? '') !== String(next ?? '')
    const a = prev === null || prev === undefined || prev === '' ? null : Number(prev)
    const b = next === null || next === undefined || next === '' ? null : Number(next)
    if (a === null || b === null) return a !== b
    return Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  }
  const changed = new Set(values.filter(([c, v]) => differs(c, v)).map(([c]) => c))
  return COST_BASIS_KINDS.filter(
    (k) =>
      changed.has(COST_COLUMN[k]) ||
      (k === 'labor' && (changed.has('labor_hours') || changed.has('labor_occupation'))),
  )
}

/** One part of an amount built from several drivers. */
export interface CostLine {
  label: string
  quantity: number
  unit: string
  rate: number
  rate_unit: string
  source_kind: CostSourceKind
  source_name: string | null
  vintage: string | null
}

/** A stored basis row, as the API and the snapshot carry it. */
export interface CostBasis {
  kind: CostBasisKind
  amount: number | null
  driver_quantity: number | null
  driver_unit: string | null
  rate: number | null
  rate_unit: string | null
  rate_label: string | null
  rate_code: string | null
  region: string | null
  source_kind: CostSourceKind
  source_name: string | null
  vintage: string | null
  lines: CostLine[] | null
}

/** Largest driver or rate the route accepts: far above any real one. */
export const COST_BASIS_MAX = 1e9

const finite = z
  .number()
  .finite()
  .min(0)
  .max(COST_BASIS_MAX)
const short = (max: number) => z.string().trim().min(1).max(max)

/** PUT body, mode "lookup": the server finds the rate (labor or energy). */
export const LookupInput = z
  .object({
    kind: z.enum(['labor', 'energy']),
    mode: z.literal('lookup'),
    driver_quantity: finite,
    /** Labor: a BLS OEWS code (51-4121). Energy: electricity or natural_gas. */
    rate_code: short(20),
    /** 'US' or a state code. */
    region: z.string().regex(/^[A-Z]{2}$/),
    /** Energy only: the unit the driver is in (kWh, m3, MMBtu). Labor is hours. */
    driver_unit: short(20).optional(),
    /**
     * 'reference': the dated reference rate the list shows, no live call
     * (E14: "Welders/cutters · US · Reference 2026-06"). Unset: live first.
     */
    prefer: z.literal('reference').optional(),
  })
  .strict()

/** PUT body, mode "entered": a person's own rate (driver x rate), or an amount alone. */
export const EnteredInput = z
  .object({
    kind: z.enum(COST_BASIS_KINDS),
    mode: z.literal('entered'),
    driver_quantity: finite.optional(),
    driver_unit: short(20).optional(),
    rate: finite.optional(),
    rate_unit: short(30).optional(),
    rate_label: short(120).optional(),
    /** The amount itself, when there is no driver x rate. */
    amount: finite.optional(),
    source_name: short(120).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const byRate = v.driver_quantity !== undefined && v.rate !== undefined
    if (!byRate && v.amount === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'give driver_quantity and rate, or an amount', path: ['amount'] })
    }
    if (byRate && v.amount !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'give driver_quantity and rate, or an amount, not both', path: ['amount'] })
    }
    if ((v.driver_quantity === undefined) !== (v.rate === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'driver_quantity and rate go together', path: ['rate'] })
    }
  })

export const CostBasisInput = z.union([LookupInput, EnteredInput])
export type CostBasisInput = z.infer<typeof CostBasisInput>

/**
 * The amount a driver and rate make, to 6 decimals. The component cost
 * columns store cents (DECIMAL(15,2)), so 0.015 h x $25.83/h = 0.38745 is
 * saved as $0.39; the basis keeps the driver and rate exact.
 */
export function costAmount(driverQuantity: number, rate: number): number {
  return Math.round(driverQuantity * rate * 1e6) / 1e6
}

/** "2025-05-01" or "2026-06-01" → "2025-05" / "2026-06"; a year stays a year. */
export function vintageOf(effectiveDate: string | null | undefined): string | null {
  const s = String(effectiveDate ?? '').trim()
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(s)
  if (!m) return null
  return m[2] ? `${m[1]}-${m[2]}` : m[1]
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** A database row (with the step's amount beside it) as a CostBasis. */
export function toCostBasis(row: Record<string, any>, amount: unknown): CostBasis {
  let lines: CostLine[] | null = null
  if (row.cost_lines != null && row.cost_lines !== '') {
    try {
      const parsed = typeof row.cost_lines === 'string' ? JSON.parse(row.cost_lines) : row.cost_lines
      lines = Array.isArray(parsed) ? parsed : null
    } catch {
      lines = null
    }
  }
  return {
    kind: row.cost_kind,
    amount: num(amount),
    driver_quantity: num(row.driver_quantity),
    driver_unit: row.driver_unit ?? null,
    rate: num(row.rate),
    rate_unit: row.rate_unit ?? null,
    rate_label: row.rate_label ?? null,
    rate_code: row.rate_code ?? null,
    region: row.region ?? null,
    source_kind: row.source_kind,
    source_name: row.source_name ?? null,
    vintage: row.vintage ?? null,
    lines,
  }
}

/** The basis rows of a step's cost kinds, keyed for the snapshot (amount from the step row). */
export function stepCostBasis(component: Record<string, any>, rows: Array<Record<string, any>>): CostBasis[] {
  return rows
    .filter((r) => Number(r.component_id) === Number(component.component_id))
    .map((r) => toCostBasis(r, component[COST_COLUMN[r.cost_kind as CostBasisKind]]))
    .sort((a, b) => COST_BASIS_KINDS.indexOf(a.kind) - COST_BASIS_KINDS.indexOf(b.kind))
}

/** A stored `cost_lines` value with every quantity times `factor`, as JSON text (null stays null). */
export function scaleCostLines(raw: unknown, factor: number): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  let lines: unknown
  try {
    lines = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
  if (!Array.isArray(lines)) return null
  return JSON.stringify(
    lines.map((l: any) => ({ ...l, quantity: Number.isFinite(Number(l?.quantity)) ? Number(l.quantity) * factor : l?.quantity })),
  )
}

/** The tag word the design shows for a source kind (specs/look.md section 7). */
export function sourceTag(kind: CostSourceKind): 'Reference' | 'Entered by hand' | null {
  if (kind === 'reference') return 'Reference'
  if (kind === 'entered') return 'Entered by hand'
  return null // live shows its source name, e.g. "BLS OEWS 2025 · live"
}
