'use client'

// The step's own words and its allocation, in the step panel (E23, E24): a
// description (an import's provenance stays on the end, unseen), and ISO 14044
// 4.3.4 allocation for a step that also makes other products: the method, the
// share that stays with this product, and the basis a reviewer reads.

import { useEffect, useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { allocationSharePatch, allocationView, type AllocationChoice } from '@/lib/case-editor/cost-calculators'
import { joinSource } from '@/lib/workspace/step-text'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'
import { HelpTip } from './help-tip'

const METHODS: Array<{ value: AllocationChoice; label: string }> = [
  { value: 'none', label: 'Not shared: all of it is this product' },
  { value: 'physical', label: 'Shared by a physical basis (mass, volume)' },
  { value: 'economic', label: 'Shared by economic value' },
]

export function StepDetails({
  step,
  busy,
  saveFields,
  onSaved,
}: {
  step: WorkspaceStep
  busy: boolean
  saveFields: (id: number, fields: Record<string, unknown>) => Promise<boolean>
  onSaved: (line: string) => void
}) {
  const [description, setDescription] = useState(step.description ?? '')
  const view = allocationView({ allocationMethod: step.allocationMethod as any, allocationFactor: step.allocationFactor ?? undefined })
  const [method, setMethod] = useState<AllocationChoice>(view.method)
  const [pct, setPct] = useState(view.method === 'none' ? '' : String(view.pctValue))
  const [note, setNote] = useState(step.allocationNote ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    const v = allocationView({ allocationMethod: step.allocationMethod as any, allocationFactor: step.allocationFactor ?? undefined })
    setDescription(step.description ?? '')
    setMethod(v.method)
    setPct(v.method === 'none' ? '' : String(v.pctValue))
    setNote(step.allocationNote ?? '')
    setProblem(null)
  }, [step.id, step.description, step.allocationMethod, step.allocationFactor, step.allocationNote])

  const saveAllocation = async () => {
    if (method === 'none') {
      if (await saveFields(step.id, { allocation_method: 'none', allocation_factor: 1, allocation_note: note.trim() || null }))
        onSaved(`Saved · ${step.name} counts in full`)
      return
    }
    const patch = allocationSharePatch(pct.trim())
    const share = patch?.allocationFactor
    if (share == null) return setProblem('Enter the share that belongs to this product, as a percent above 0 and up to 100.')
    if (!note.trim()) return setProblem('Write the basis, for example "by mass: 80 kg of 100 kg output", so a reviewer can check it.')
    setProblem(null)
    if (await saveFields(step.id, { allocation_method: method, allocation_factor: share, allocation_note: note.trim() }))
      onSaved(`Saved · ${step.name} keeps ${Math.round(share * 1000) / 10}%`)
  }

  return (
    <>
      <label>
        <span className="ds-section-label">Description</span>
        <span style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
          <textarea
            className="ds-input"
            aria-label="Step description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happens here, the machine, what you assumed"
            style={{ flex: 1, resize: 'vertical' }}
          />
          <Button
            onClick={async () => {
              if (await saveFields(step.id, { description: joinSource(description, step.source) })) onSaved(`Saved · ${step.name}`)
            }}
            busy={busy}
          >
            Save
          </Button>
        </span>
      </label>

      <div role="group" aria-label="Allocation">
        <span className="ds-section-label">
          Allocation
          <HelpTip label="What is allocation?">{ISO_HELP.allocation}</HelpTip>
        </span>
        <select
          className="ds-input"
          aria-label="Allocation method"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as AllocationChoice)
            setProblem(null)
          }}
          style={{ width: '100%', marginTop: 6 }}
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {method !== 'none' && (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="ds-input"
                aria-label="Share that belongs to this product, in percent"
                inputMode="decimal"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="80"
                style={{ width: 96 }}
              />
              <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>% stays with this product</span>
            </span>
            <input
              className="ds-input"
              aria-label="Allocation basis"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="by mass: 80 kg of 100 kg output"
            />
          </span>
        )}
        {problem && (
          <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ds-error)' }}>
            {problem}
          </p>
        )}
        <span style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <Button onClick={saveAllocation} busy={busy}>
            Save allocation
          </Button>
        </span>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ds-text-3)' }}>It changes environmental results from the next run; costs stay as entered.</p>
      </div>
    </>
  )
}
