'use client'

// Add a step: parent, a tier below that parent (skipping a level is allowed),
// and a name. Nothing is created until Add the step is pressed; Enter in the
// name box adds nothing (B2).

import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { TIER_LABEL, TIERS, type Tier } from '@/lib/workspace/tier-layout'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'

export function tiersBelow(parent: Tier): Tier[] {
  const i = TIERS.indexOf(parent)
  return TIERS.slice(i + 1)
}

export function AddStepForm({
  open,
  steps,
  defaultParentId,
  busy,
  error,
  onCancel,
  onAdd,
}: {
  open: boolean
  steps: WorkspaceStep[]
  defaultParentId: number | null
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onAdd: (input: { parentId: number; tier: Tier; name: string }) => void
}) {
  const titleId = useId()
  const [parentId, setParentId] = useState<number | null>(defaultParentId)
  const parent = steps.find((s) => s.id === parentId) ?? null
  const choices = parent ? tiersBelow(parent.tier) : []
  const [tier, setTier] = useState<Tier | null>(choices[0] ?? null)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    const id = defaultParentId ?? steps[0]?.id ?? null
    const p = steps.find((s) => s.id === id) ?? null
    const next = p ? tiersBelow(p.tier) : []
    setParentId(id)
    setTier(next[0] ?? null)
    setName('')
  }, [open, defaultParentId, steps])

  if (!open) return null
  const canAdd = parentId != null && tier != null && name.trim().length > 0 && !busy
  return (
    <div className="ds-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ds-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="ds-dialog-title">
          Add a step
        </h2>
        <label style={{ display: 'block', margin: '12px 0' }}>
          <span className="ds-section-label">Parent</span>
          <select
            className="ds-input"
            aria-label="Parent"
            value={parentId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              const p = steps.find((s) => s.id === id)
              const next = p ? tiersBelow(p.tier) : []
              setParentId(id)
              setTier(next[0] ?? null)
            }}
            style={{ width: '100%', marginTop: 6 }}
          >
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label="Tier" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {choices.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tier === t}
              className={tier === t ? 'ds-btn ds-btn--dark ds-btn--small' : 'ds-btn ds-btn--small'}
              onClick={() => setTier(t)}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
          {choices.length === 0 && <span>This step is already the lowest tier.</span>}
        </div>
        <label style={{ display: 'block', margin: '12px 0' }}>
          <span className="ds-section-label">Name</span>
          <input
            className="ds-input"
            aria-label="Name"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            style={{ width: '100%', marginTop: 6 }}
          />
        </label>
        {error && (
          <p role="alert" className="ds-dialog-body" style={{ color: 'var(--ds-error)' }}>
            {error}
          </p>
        )}
        <div className="ds-dialog-actions">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            busy={busy}
            disabled={!canAdd}
            onClick={() => {
              if (canAdd && parentId != null && tier) onAdd({ parentId, tier, name: name.trim() })
            }}
          >
            Add the step
          </Button>
        </div>
      </div>
    </div>
  )
}
