'use client'

// Placement — re-parent any non-product node anywhere in the tree, or make it
// independent. Products are always roots, so this is not shown for them.

import { Icon } from '@/components/lcapix/icon'
import type { InspectorEditFormData, ParentOption } from '@/lib/case-editor/types'
import { InspectorSection } from './inspector-section'

export function PlacementSection({
  editFormData,
  onChange,
  parentOptions,
}: {
  editFormData?: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
  parentOptions: ParentOption[]
}) {
  return (
    <InspectorSection title="Placement" defaultOpen={true}>
      <label
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 600,
        }}
      >
        Parent
      </label>
      <div style={{ position: 'relative', marginTop: 6 }}>
        <select
          className="input"
          style={{ appearance: 'none', paddingRight: 32, width: '100%' }}
          value={editFormData?.parentId ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ parentId: v || undefined })
          }}
        >
          <option value="" disabled>
            Choose a parent…
          </option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={14}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
        Every step needs a parent: any higher-level step (levels may be
        skipped, e.g. an operation straight under the product). Then Save.
      </p>
    </InspectorSection>
  )
}
