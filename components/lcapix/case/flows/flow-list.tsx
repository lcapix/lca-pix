'use client'

// The step's flows: loading, a failed load (with Try again), none yet, or
// the list of rows.

import type { FlowRow } from '@/lib/case-editor/flow-types'
import { FlowRowItem, type FlowRowItemProps } from './flow-row'

export function FlowList({
  loading,
  loadError,
  flows,
  onRetry,
  ...rowProps
}: {
  loading: boolean
  loadError: string | null
  flows: FlowRow[]
  onRetry: () => void
} & Omit<FlowRowItemProps, 'f' | 'i'>) {
  return loading ? (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
      Loading flows…
    </div>
  ) : loadError ? (
    <div role="alert" style={{ fontSize: 12, color: 'var(--signal-error)', padding: '4px 0' }}>
      {loadError}{' '}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ padding: '0 4px', fontSize: 12 }}
        onClick={() => onRetry()}
      >
        Try again
      </button>
    </div>
  ) : flows.length === 0 ? (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
      No flows yet. Add the substances this step consumes or emits.
    </div>
  ) : (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
      {flows.map((f, i) => (
        <FlowRowItem key={f.flow_id} f={f} i={i} {...rowProps} />
      ))}
    </div>
  )
}
