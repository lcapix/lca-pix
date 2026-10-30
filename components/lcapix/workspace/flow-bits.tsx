'use client'

// The pieces a flow row shares between the step panel (E03) and the Inventory
// table (E04): saving an amount, the row's arithmetic and source words, "Use
// my own number", and going back to the library factor.

import { useState } from 'react'
import { Button, Callout } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { announceComponentsChanged } from '@/lib/case-editor/use-flows'
import { amountBox, co2Unit, fixed, result3 } from '@/lib/ui/format'
import type { InventoryRow } from '@/lib/workspace/inventory'

/**
 * Save a flow's amount as typed: empty clears it ("Needs an amount"), else a
 * number of 0 or more. Nothing is sent when it did not change.
 */
export async function saveFlowAmount(
  row: Pick<InventoryRow, 'flow_id' | 'amount'> & { unit?: string },
  typed: string,
  /** The amount this tab last knew (3.10); a 409 hands back the amount now, which a second save sends. */
  known: number | null = row.amount,
): Promise<{ saved: boolean; amount: number | null; error: string | null; current?: number | null }> {
  const trimmed = typed.trim()
  const next = trimmed === '' ? null : Number(trimmed)
  if (next !== null && (!Number.isFinite(next) || next < 0)) {
    return { saved: false, amount: row.amount, error: 'Enter an amount of 0 or more, or leave it empty for now.' }
  }
  if (next === known) return { saved: false, amount: next, error: null }
  // The box shows a rounded amount (at most 4 decimals): text left as shown is
  // no change, never a save of the rounded number (0.00015 would become 0.0002).
  if (trimmed === amountBox(known)) return { saved: false, amount: known, error: null }
  const res = await apiRequest(`/api/flows/${row.flow_id}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity: next, expected_quantity: known, ...(row.unit ? { expected_unit: row.unit } : {}) }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    if (res.status === 409 && d?.current) {
      const now = d.current.quantity == null ? 'no amount' : `${d.current.quantity} ${d.current.unit ?? row.unit ?? ''}`.trim()
      return {
        saved: false,
        amount: row.amount,
        current: d.current.quantity ?? null,
        error: `This flow changed in another tab or by someone else: it is now ${now}. Save again to replace it.`,
      }
    }
    return { saved: false, amount: row.amount, error: d?.error ?? `The amount was not saved (${res.status}).` }
  }
  announceComponentsChanged()
  return { saved: true, amount: next, error: null }
}

/** Save a flow's unit (the left-out fix: "Pick kg or g"). */
export async function saveFlowUnit(row: Pick<InventoryRow, 'flow_id' | 'amount' | 'unit'>, unit: string): Promise<string | null> {
  // The amount and unit this tab loaded go with it (3.10): a unit picked in a
  // stale tab must not relabel an amount someone else changed.
  const res = await apiRequest(`/api/flows/${row.flow_id}`, {
    method: 'PUT',
    body: JSON.stringify({ unit, expected_quantity: row.amount, ...(row.unit ? { expected_unit: row.unit } : {}) }),
  })
  if (res.ok) {
    announceComponentsChanged()
    return null
  }
  const d = await res.json().catch(() => ({}))
  if (res.status === 409 && d?.current) {
    const now = d.current.quantity == null ? 'no amount' : `${d.current.quantity} ${d.current.unit ?? ''}`.trim()
    return `This flow changed in another tab or by someone else: it is now ${now}. Reload to see it, then pick the unit again.`
  }
  return d?.error ?? `The unit was not saved (${res.status}).`
}

/** Save other fields on a flow (substance, direction). */
export async function saveFlowFields(flowId: number, body: Record<string, unknown>): Promise<string | null> {
  const res = await apiRequest(`/api/flows/${flowId}`, { method: 'PUT', body: JSON.stringify(body) })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return d?.error ?? `The flow was not saved (${res.status}).`
  }
  announceComponentsChanged()
  return null
}

export async function deleteFlow(flowId: number): Promise<string | null> {
  const res = await apiRequest(`/api/flows/${flowId}`, { method: 'DELETE' })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    return d?.error ?? `The flow was not deleted (${res.status}).`
  }
  announceComponentsChanged()
  return null
}

/** "0.80 × 1.900 = 1.520 kg CO₂-eq"; no factor: "0.02 × – = 0 kg CO₂-eq". */
export function rowSum(row: InventoryRow): string {
  if (row.status === 'needs_amount') return 'Needs an amount'
  if (row.status === 'left_out') return `Left out, unit can't convert. Pick ${row.substance_unit === 'kg' ? 'kg or g' : row.substance_unit ?? 'a unit'}.`
  const a = amountBox(row.amount)
  if (!row.climate) return `${a} × – = 0 kg CO₂-eq`
  return `${a} × ${fixed(row.climate.factor, 3)} = ${result3(row.climate.impact)} ${co2Unit(row.climate.unit)}`
}

/** The source as a person reads it: the hand-entered prefix dropped, the name kept short. */
export function sourceText(source: string | null | undefined): string {
  const s = String(source ?? '').replace(/^Entered by hand:\s*/i, '')
  const cut = s.split(/[(;]/)[0].trim()
  return cut.length > 60 ? `${cut.slice(0, 57)}…` : cut || 'no source recorded'
}

export function OwnFactorForm({ row, onDone }: { row: InventoryRow; onDone: (savedLine: string | null) => void }) {
  const [value, setValue] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const v = Number(value)
    if (!Number.isFinite(v) || value.trim() === '') return setError('Enter the number, for example 2.1.')
    if (!source.trim()) return setError('Say where the number comes from.')
    setBusy(true)
    const res = await apiRequest(`/api/flows/${row.flow_id}/factor`, {
      method: 'PUT',
      body: JSON.stringify({ category_id: row.climate!.category_id, factor_value: v, source: source.trim() }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d?.error ?? `Not saved (${res.status}).`)
    announceComponentsChanged()
    onDone(`Saved · your own number for ${row.substance}`)
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Your number ({co2Unit(row.climate?.unit)} per {row.unit})
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="ds-label" style={{ marginBottom: 0 }}>
        Where it comes from
        <input className="ds-input" style={{ width: '100%', marginTop: 4 }} value={source} maxLength={255} placeholder="e.g. the supplier's EPD, 2024" onChange={(e) => setSource(e.target.value)} />
      </label>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <span style={{ display: 'flex', gap: 8 }}>
        <Button variant="dark" onClick={submit} busy={busy}>
          Use this number
        </Button>
        <Button size="small" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </span>
    </div>
  )
}

export function BackToLibrary({ row, onSaved }: { row: InventoryRow; onSaved: (line: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Callout tone="info" lead="Entered by hand.">
      This row uses your own number.{' '}
      <button
        type="button"
        className="ds-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const res = await apiRequest(`/api/flows/${row.flow_id}/factor?category_id=${row.climate!.category_id}`, { method: 'DELETE' })
          setBusy(false)
          if (res.ok) {
            announceComponentsChanged()
            onSaved(`Saved · ${row.substance} uses the library factor again`)
          }
        }}
      >
        Use the library factor again
      </button>
    </Callout>
  )
}
