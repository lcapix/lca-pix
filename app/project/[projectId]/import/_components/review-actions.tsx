'use client'

import { applyButtonLabel } from '@/lib/import/display'

/** Apply (blocked while lines lack a step) and Start over. */
export function ReviewActions({
  applying,
  appending,
  unplacedCount,
  onApply,
  onStartOver,
}: {
  applying: boolean
  appending: boolean
  unplacedCount: number
  onApply: () => void
  onStartOver: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={applying || unplacedCount > 0}
        title={unplacedCount > 0 ? `${unplacedCount} line(s) still need a step` : undefined}
        onClick={onApply}
      >
        {applyButtonLabel(applying, appending)}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onStartOver()}
      >
        Start over
      </button>
    </div>
  )
}
