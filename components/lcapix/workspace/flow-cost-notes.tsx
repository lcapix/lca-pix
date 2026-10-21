'use client'

// The step's cost from its flows (E14), where the flows are: "Material cost
// from these flows: $0.76 (now $0.50) · Use it", and "No price for Argon: add
// its cost", which opens that cost. Nothing changes until Use it is pressed;
// then the costs route works the number out and the whole page reloads (the
// tree's cost chips, the panels, Results' Out of date).

import { useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { announceComponentsChanged } from '@/lib/case-editor/use-flows'
import { COST_KIND_LABEL } from '@/lib/workspace/cost-text'
import { noPriceText, offerText, type FlowCostKind, type FlowCostNote } from '@/lib/workspace/flow-cost-text'
import { putCost } from '@/lib/workspace/use-step-costs'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'

/** Store the flows' number for one kind; resolves to the saved line, or throws the server's words. */
export async function applyFlowsCost(step: Pick<WorkspaceStep, 'id' | 'name'>, kind: FlowCostKind): Promise<string> {
  const err = await putCost(step.id, { kind, mode: 'flows' })
  if (err) throw new Error(err)
  announceComponentsChanged()
  return `Saved · ${COST_KIND_LABEL[kind].toLowerCase()} from the flows on ${step.name}`
}

export function FlowCostNotes({
  step,
  notes,
  currency,
  onSaved,
  onAddCost,
}: {
  step: Pick<WorkspaceStep, 'id' | 'name'>
  notes: FlowCostNote[]
  currency: string
  onSaved: (line: string) => void
  /** Opens that kind's cost to add a price by hand; without it the line only names the flows. */
  onAddCost?: (kind: FlowCostKind) => void
}) {
  if (!notes.length) return null
  return (
    <div className="ws-flowcost" role="group" aria-label="Cost from these flows">
      {notes.map((n) => (
        <NoteRow key={n.kind} step={step} note={n} currency={currency} onSaved={onSaved} onAddCost={onAddCost} />
      ))}
    </div>
  )
}

function NoteRow({
  step,
  note,
  currency,
  onSaved,
  onAddCost,
}: {
  step: Pick<WorkspaceStep, 'id' | 'name'>
  note: FlowCostNote
  currency: string
  onSaved: (line: string) => void
  onAddCost?: (kind: FlowCostKind) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const use = async () => {
    setBusy(true)
    setError(null)
    try {
      onSaved(await applyFlowsCost(step, note.kind))
    } catch (e: any) {
      setError(e?.message ?? 'Not saved.')
    } finally {
      setBusy(false)
    }
  }
  const unpriced = note.noPrice.length ? noPriceText(note.noPrice) : null
  return (
    <div className="ws-flowcost-row">
      {note.offer !== null && (
        <span className="ws-flowcost-offer">
          <span>{offerText(note, currency)}</span>
          <Button size="small" onClick={use} busy={busy} aria-label={`Use the ${COST_KIND_LABEL[note.kind].toLowerCase()} cost from these flows`}>
            Use it
          </Button>
        </span>
      )}
      {unpriced &&
        (onAddCost ? (
          <button type="button" className="ds-link ws-flowcost-noprice" onClick={() => onAddCost(note.kind)}>
            {unpriced} →
          </button>
        ) : (
          <span className="ws-flowcost-noprice">{unpriced}</span>
        ))}
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
    </div>
  )
}
