'use client'

// Save and Back on Check what we read (F2.3, F2.6): "Save 5 steps to a new
// case" / "Save 3 lines to Base case", blocked with its reason while a line
// still needs a step or the case's own steps are still being read.

import { Button } from '@/components/lcapix/ds'

export function ReviewActions({
  applying,
  saveLabel,
  blockedReason,
  onApply,
  onBack,
}: {
  applying: boolean
  saveLabel: string
  blockedReason: string | null
  onApply: () => void
  onBack: () => void
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'flex-start' }}>
      <Button onClick={onBack}>Back</Button>
      <Button variant="primary" onClick={onApply} busy={applying} disabled={!!blockedReason} disabledReason={blockedReason ?? undefined}>
        ✓ {saveLabel}
      </Button>
    </span>
  )
}
