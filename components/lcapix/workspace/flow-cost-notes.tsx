'use client'

// The step's cost from its flows (E14), where the flows are: "Material cost
// from these flows: $0.76" with Save, and "No price for Argon: add its cost",
// which opens that cost. Nothing changes until Save is pressed. When a cost is
// stored already, the flows' number never replaces it in one click (E5): both
// numbers show, you pick one, and only Save stores the flows' number. Then the
// costs route works the number out and the whole page reloads (the tree's
// cost chips, the panels, Results' Out of date).

import { useId, useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { announceComponentsChanged } from '@/lib/case-editor/use-flows'
import { money } from '@/lib/ui/format'
import { COST_KIND_LABEL } from '@/lib/workspace/cost-text'
import { noPriceText, offerText, type FlowCostKind, type FlowCostNote } from '@/lib/workspace/flow-cost-text'
import { useUnsavedEdit } from '@/lib/workspace/unsaved'
import { putCost } from '@/lib/workspace/use-step-costs'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'

/** Store the flows' number for one kind; resolves to the saved line, or throws the server's words. */
export async function applyFlowsCost(step: Pick<WorkspaceStep, 'id' | 'name'>, kind: FlowCostKind, amount?: number | null): Promise<string> {
  const err = await putCost(step.id, { kind, mode: 'flows' })
  if (err) throw new Error(err)
  announceComponentsChanged()
  return `Saved · ${COST_KIND_LABEL[kind].toLowerCase()} from the flows on ${step.name}${amount != null ? `: ${money(amount)}` : ''}`
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

/**
 * The flows' number with Save. With a cost stored already, a choice between
 * the two first ("Keep $85.00" picked), and Save only stores the flows' number
 * once it is picked (E5).
 */
export function FlowsCostChoice({
  step,
  kind,
  offer,
  stored,
  currency = 'USD',
  text,
  onSaved,
}: {
  step: Pick<WorkspaceStep, 'id' | 'name'>
  kind: FlowCostKind
  offer: number
  stored: number | null
  currency?: string
  /** The line that explains the offer ("Material cost from these flows: $4.83 (now $85.00)"). */
  text: string
  onSaved: (line: string) => void
}) {
  const name = useId()
  const [pick, setPick] = useState<'keep' | 'flows'>(stored === null ? 'flows' : 'keep')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = COST_KIND_LABEL[kind].toLowerCase()
  const save = async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      onSaved(await applyFlowsCost(step, kind, offer))
      return true
    } catch (e: any) {
      setError(e?.message ?? 'Not saved.')
      return false
    } finally {
      setBusy(false)
    }
  }
  // Picking the flows' number over a stored cost is a change waiting for Save.
  useUnsavedEdit(`flows-cost-${step.id}-${kind}`, stored !== null && pick === 'flows', {
    label: `the ${label} cost on ${step.name}`,
    save,
    discard: () => setPick('keep'),
  })
  return (
    <div className="ws-flowcost-offer" role="group" aria-label={`The ${label} cost from these flows`}>
      <span>{text}</span>
      {stored !== null ? (
        <span className="ws-choice-pick" role="radiogroup" aria-label={`Which ${label} cost to keep`}>
          <label>
            <input type="radio" name={name} checked={pick === 'keep'} onChange={() => setPick('keep')} />
            Keep {money(stored, currency)} (what is stored)
          </label>
          <label>
            <input type="radio" name={name} checked={pick === 'flows'} onChange={() => setPick('flows')} />
            Use {money(offer, currency)} from these flows
          </label>
        </span>
      ) : null}
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button
          size="small"
          variant="dark"
          onClick={() => void save()}
          busy={busy}
          disabled={pick !== 'flows'}
          aria-label={`Save the ${label} cost from these flows`}
        >
          Save {money(offer, currency)}
        </Button>
        {stored !== null && pick === 'keep' && <span className="ws-draft-note">Nothing changes unless you pick the flows&apos; number.</span>}
      </span>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
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
  const unpriced = note.noPrice.length ? noPriceText(note.noPrice) : null
  return (
    <div className="ws-flowcost-row">
      {note.offer !== null && (
        <FlowsCostChoice step={step} kind={note.kind} offer={note.offer} stored={note.stored} currency={currency} text={offerText(note, currency)} onSaved={onSaved} />
      )}
      {unpriced &&
        (onAddCost ? (
          <button type="button" className="ds-link ws-flowcost-noprice" onClick={() => onAddCost(note.kind)}>
            {unpriced} →
          </button>
        ) : (
          <span className="ws-flowcost-noprice">{unpriced}</span>
        ))}
    </div>
  )
}
