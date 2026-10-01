'use client'

// Shown in the case tree pane when the active case has no components: clone
// from the base case (comparatives) or open the editor.

import { Icon } from '@/components/lcapix'

export function EmptyCaseOverlay({
  isComp,
  hasBase,
  baseName,
  onOpenEditor,
  onCloneFromBase,
}: {
  isComp: boolean
  hasBase: boolean
  baseName?: string
  onOpenEditor: () => void
  onCloneFromBase: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'oklch(from var(--brand-primary) l c h / 0.12)',
          color: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="layers" size={22} />
      </div>
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {isComp
            ? 'This scenario is empty'
            : 'No components in this case yet'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          {isComp && hasBase
            ? `Start by cloning ${baseName ?? 'the base case'} and edit the parts you want to change — or build from scratch.`
            : 'Open the editor to add a product, machines, subprocesses, and elemental tasks.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {isComp && hasBase && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onCloneFromBase}
          >
            <Icon name="layers" size={13} /> Clone from base
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onOpenEditor}
        >
          <Icon name="plus" size={13} />{' '}
          {isComp && hasBase ? 'Start blank' : 'Open editor'}
        </button>
      </div>
    </div>
  )
}
