/**
 * The rules behind editing a flow in the step panel and the Inventory (A1,
 * A2, E1): a unit change converts the amount and never relabels it, an own
 * factor follows the unit it is stated per, and the words a person reads for
 * a factor and its basis. Pure, so every rule is tested without a browser.
 *
 * Shared by the editors (the amount box follows a unit change before Save)
 * and the flow route (a unit sent alone converts the stored amount).
 */

import { convertQuantity, sameUnit } from '@/lib/units'

/** A number kept to 12 significant digits: 0.035 × 1000 reads 35, not 35.00000000000001. */
export function tidy(x: number): number {
  return Number(x.toPrecision(12))
}

export type UnitChange =
  | { ok: true; amount: number | null; note: string | null }
  | { ok: false; reason: string }

/**
 * What a flow's amount becomes when its unit changes: the same quantity in
 * the new unit (0.035 kg is 35 g). No amount yet stays no amount. Units that
 * measure different things (kg and kWh) cannot be converted, and the reason
 * says what to do instead.
 */
export function convertForUnitChange(amount: number | null, from: string, to: string): UnitChange {
  if (!to.trim()) return { ok: false, reason: 'Pick a unit.' }
  if (sameUnit(from, to)) return { ok: true, amount, note: null }
  if (amount === null) return { ok: true, amount: null, note: null }
  const c = convertQuantity(amount, from, to)
  if (!c) {
    return {
      ok: false,
      reason: `${from} and ${to} measure different things, so ${amount} ${from} cannot be turned into ${to}. Type the amount in ${to} too, then Save.`,
    }
  }
  const next = tidy(c.quantity)
  return { ok: true, amount: next, note: `${amount} ${from} = ${next} ${to}` }
}

/**
 * An own factor stated per `perUnit`, restated per `toUnit` for the same
 * physical factor: 8.5 kg CO2-eq per g is 8,500 per kg. Null when the units
 * do not convert.
 */
export function convertOwnFactor(value: number, perUnit: string, toUnit: string): number | null {
  if (sameUnit(perUnit, toUnit)) return value
  const one = convertQuantity(1, toUnit, perUnit)
  if (!one) return null
  return tidy(value * one.quantity)
}

/** A factor as a person reads it: 8.6, 0.0123, 1,520 (four significant digits, no padding zeros). */
export function factorText(x: number | string | null | undefined): string {
  if (x === null || x === undefined || x === '') return '–'
  const n = Number(x)
  if (!Number.isFinite(n)) return '–'
  if (n === 0) return '0'
  const short = Number(n.toPrecision(4))
  if (Math.abs(short) < 1e-4) return short.toExponential(2)
  const [int, dec] = String(short).split('.')
  if (int.includes('e')) return String(short)
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? `.${dec}` : ''}`
}

/**
 * The unit a factor is stated per, read from the engine's conversion note
 * ("1 g = 0.001 kg" means the factor is per kg); without a note the amount
 * was already in the factor's unit.
 */
export function basisUnitOf(flowUnit: string, conversion: string | null | undefined): string {
  const note = String(conversion ?? '').trim()
  const scaled = /^1 .+? = [-+\d.eE]+ (.+)$/.exec(note)
  if (scaled) return scaled[1].trim()
  const same = /^.+? = (.+)$/.exec(note)
  if (same) return same[1].trim()
  return flowUnit
}

/** "kg CO2 eq" and "g" → "kg CO₂-eq per g": the factor's unit in words. */
export function perUnitText(resultUnit: string | null | undefined, basis: string): string {
  const r = String(resultUnit ?? 'kg CO2 eq').replace(/CO2(\s*eq)?/i, 'CO₂-eq').replace(/CO₂-eq\.?/, 'CO₂-eq')
  return `${r} per ${basis}`
}

/** True when an amount box holds something other than the amount it was given. */
export function amountChanged(typed: string, shown: string): boolean {
  return typed.trim() !== shown.trim()
}

/** The amount typed, read as a number of 0 or more; '' is no amount (null); anything else is a problem. */
export function readAmount(typed: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const t = typed.trim()
  if (t === '') return { ok: true, value: null }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'Enter an amount of 0 or more, or leave it empty for now.' }
  return { ok: true, value: n }
}

/** "In" for an input, "Out" for an output, as the Saved line says what was stored. */
export function directionWord(d: string | null | undefined): string {
  return d === 'output' ? 'an output (Out)' : 'an input (In)'
}
