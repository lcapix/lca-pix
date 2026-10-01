'use client'

// ISO 14044 4.3.4 allocation for a node that also makes other products. The
// share is stored 0..1 and shown as a percent; environmental results only.
// System expansion (crediting avoided products) is not offered yet.

import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import {
  allocationMethodPatch,
  allocationSharePatch,
  allocationView,
  type AllocationChoice,
} from '@/lib/case-editor/cost-calculators'
import type { InspectorEditFormData } from '@/lib/case-editor/types'
import { InspectorSection } from './inspector-section'

/** The Allocation section: open by default when the node already has a split. */
export function AllocationSection({
  editFormData,
  onChange,
  hasChildren,
}: {
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
  hasChildren: boolean
}) {
  return (
    <InspectorSection
      title="Allocation"
      defaultOpen={(editFormData.allocationMethod ?? 'none') !== 'none'}
    >
      <AllocationEditor editFormData={editFormData} onChange={onChange} hasChildren={hasChildren} />
    </InspectorSection>
  )
}

const ALLOCATION_METHODS: Array<{ id: 'none' | 'physical' | 'economic'; label: string }> = [
  { id: 'none', label: 'None (only this product)' },
  { id: 'physical', label: 'Physical (e.g. by mass)' },
  { id: 'economic', label: 'Economic (by value)' },
]

/** Method, share to this product, and the basis note. */
export function AllocationEditor({
  editFormData,
  onChange,
  hasChildren,
}: {
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
  hasChildren: boolean
}) {
  const { method, share, pctValue } = allocationView(editFormData)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {method === 'none'
          ? 'Counted in full.'
          : `${pctValue === '' ? '?' : pctValue}% of this ${
              hasChildren ? 'part of the system' : 'process'
            } is assigned to the product.`}
        <HelpTip label="What is allocation?" width={320}>
          {ISO_HELP.allocation}
          {hasChildren ? ' Set on a parent, the share applies to every process under it.' : ''}
        </HelpTip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label className="label" style={{ fontSize: 11 }}>
            Method
          </label>
          <select
            className="input"
            style={{ height: 30, fontSize: 12 }}
            value={method}
            onChange={(e) => {
              const m = e.target.value as AllocationChoice
              onChange(allocationMethodPatch(m, share))
            }}
          >
            {ALLOCATION_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" style={{ fontSize: 11 }}>
            Share to this product
          </label>
          <div style={{ position: 'relative' }}>
            <input
              className="input mono"
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              disabled={method === 'none'}
              value={pctValue}
              onChange={(e) => {
                const patch = allocationSharePatch(e.target.value)
                if (patch) onChange(patch)
              }}
              style={{ height: 30, fontSize: 12, paddingRight: 24 }}
            />
            <span
              style={{
                position: 'absolute',
                right: 10,
                top: 7,
                color: 'var(--text-tertiary)',
                fontSize: 12,
              }}
            >
              %
            </span>
          </div>
        </div>
      </div>
      {method !== 'none' && (
        <div>
          <label className="label" style={{ fontSize: 11 }}>
            Basis
          </label>
          <input
            className="input"
            style={{ height: 30, fontSize: 12 }}
            placeholder="e.g. by mass: 80 kg of 100 kg output"
            value={editFormData.allocationNote ?? ''}
            onChange={(e) => onChange({ allocationNote: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
