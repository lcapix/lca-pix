// Number inputs typed as text (EDIT-5): "12." and "0." can be typed on the
// way to "12.5", a blank means unknown, and anything else is not a number.

/** Inspector fields typed as text and parsed as numbers. */
export type NumberFieldKey =
  | 'mass'
  | 'laborCost'
  | 'energyCost'
  | 'materialCost'
  | 'transportationCost'
  | 'equipmentCost'
  | 'overheadCost'

/** What was typed, and the value it last sent to the form. */
export type NumberDraft = { raw: string; sent: number | undefined }

/**
 * '' → unknown (undefined); a plain decimal ≥ 0 → that number; anything else
 * is not a number. "12." and "0." parse (to 12 and 0) so they can be typed.
 */
export function parseNumberDraft(raw: string): { ok: true; value: number | undefined } | { ok: false } {
  const t = raw.trim()
  if (t === '') return { ok: true, value: undefined }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false }
  const n = Number(t)
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false }
}

/** The inline message for a typed value, or null when it can be saved. */
export function numberDraftError(key: NumberFieldKey, raw: string): string | null {
  const p = parseNumberDraft(raw)
  if (!p.ok) return 'Not a number of 0 or more.'
  if (key === 'mass' && !(p.value !== undefined && p.value > 0)) {
    return 'Quantity must be above 0: it is how many units your data describe.'
  }
  return null
}
