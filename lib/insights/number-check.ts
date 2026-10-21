/**
 * The number check for AI narration (design spec, "Generative AI", rule 1):
 * LCAPIX computes every number; the model only phrases. Before a reply is
 * shown, every number in it must match a number in the facts the model was
 * given, at the precision the reply writes it. "1.72" matches 1.7195 and
 * "89%" matches 89.4%, but "about 90%" for 89.4% does not: a rounded-off or
 * invented number drops the whole reply, and the computed insight is shown
 * instead.
 *
 * Numbers match by kind as well as value: a percentage ("89%", "89 percent")
 * only against percentages, money ("$1.75") only against money, and a plain
 * quantity only against plain quantities, so a $1.75 cost can never vouch for
 * "1.8 kg".
 *
 * Not counted as claims: digits inside identifiers (CO2, CH4, PM2.5, AR5,
 * "Step3"), and whole numbers up to 10 (counts and ordinals: "3 steps",
 * "the 2 largest"). Signs are ignored, so "a credit of 0.4" matches -0.4.
 */

export type NumberKind = 'percent' | 'money' | 'plain'

export interface NumberToken {
  /** As written, e.g. "1,538.4". */
  raw: string
  /** The absolute value. */
  value: number
  /** Digits after the decimal point, as written. */
  decimals: number
  kind: NumberKind
}

// A number not glued to a letter, digit, underscore or dot on its left (so the
// 2 in "CO2" and the 5 in "PM2.5" are skipped) or a letter on its right.
const NUMBER = /(?<![A-Za-z0-9_.])-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![A-Za-z0-9_])/g

/** Every number written in `text`. */
export function numbersIn(text: string): NumberToken[] {
  const out: NumberToken[] = []
  for (const m of text.matchAll(NUMBER)) {
    const raw = m[0]
    const plain = raw.replace(/,/g, '').replace(/^-/, '')
    const value = Number(plain)
    if (!Number.isFinite(value)) continue
    const dot = plain.indexOf('.')
    const at = m.index ?? 0
    const before = text.slice(Math.max(0, at - 2), at)
    const after = text.slice(at + raw.length, at + raw.length + 8)
    const kind: NumberKind = /^\s?(%|percent\b)/i.test(after) ? 'percent' : /[$€£]\s?$/.test(before) ? 'money' : 'plain'
    out.push({ raw, value, decimals: dot === -1 ? 0 : plain.length - dot - 1, kind })
  }
  return out
}

/** True when `fact`, rounded to `decimals` places, reads as `value`. */
function matches(value: number, decimals: number, fact: number): boolean {
  const f = Math.abs(fact)
  const scale = 10 ** decimals
  return Math.abs(Math.round(f * scale) - Math.round(value * scale)) === 0
}

export interface NumberCheck {
  ok: boolean
  /** The numbers in the reply that no fact supports, as written. */
  unmatched: string[]
}

/** Check every number in `reply` against the numbers in `facts`. */
export function checkNarrationNumbers(reply: string, facts: string): NumberCheck {
  const known = numbersIn(facts)
  const unmatched: string[] = []
  for (const t of numbersIn(reply)) {
    if (t.kind === 'plain' && t.decimals === 0 && t.value <= 10) continue // a count or an ordinal
    if (!known.some((f) => f.kind === t.kind && matches(t.value, t.decimals, f.value))) unmatched.push(t.raw)
  }
  return { ok: unmatched.length === 0, unmatched }
}
