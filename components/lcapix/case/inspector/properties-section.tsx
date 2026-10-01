'use client'

// Properties: the product's quantity (the case's data basis) and unit, then
// name and description. Read-only placeholders when not controlled.

import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import type { InspectorEditFormData } from '@/lib/case-editor/types'
import type { NumberDrafts } from '@/lib/case-editor/use-number-drafts'
import { InlineError } from './inline-error'
import { InspectorSection } from './inspector-section'

export function PropertiesSection({
  node,
  controlled,
  editFormData,
  onChange,
  drafts: { numberValue, numberError, onNumberChange },
}: {
  node: FlatCaseNode
  controlled: boolean
  editFormData?: InspectorEditFormData
  onChange?: (patch: Partial<InspectorEditFormData>) => void
  drafts: NumberDrafts
}) {
  return (
    <InspectorSection title="Properties" defaultOpen={true}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Quantity belongs to the product only: it is the case's data basis
            (how many units the entered data describe) and changing it rescales
            the case. On a step it meant nothing — the engine reads the step's
            flows, not a count on the node — so a number typed there was
            decoration. A step that runs twice per unit doubles its own hours,
            energy and materials, which is where ERP routings and openLCA unit
            processes carry repetition too. */}
        {node.type === 'Product' && (
          <>
            <div>
              <label className="label">
                Quantity
                <HelpTip label="What is this quantity?">{ISO_HELP.dataBasis}</HelpTip>
              </label>
              <input
                className="input"
                style={{ height: 32, fontSize: 13 }}
                inputMode="decimal"
                aria-label="Product quantity"
                aria-invalid={!!numberError('mass')}
                value={controlled ? numberValue('mass') : '1'}
                onChange={(e) => onNumberChange('mass', e.target.value)}
                readOnly={!controlled}
              />
              <InlineError msg={numberError('mass')} />
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                className="input"
                style={{ height: 32, fontSize: 13 }}
                value={controlled ? editFormData!.massUnit ?? '' : 'unit'}
                onChange={(e) => controlled && onChange!({ massUnit: e.target.value })}
                readOnly={!controlled}
              />
            </div>
          </>
        )}
        <div style={{ gridColumn: '1/3' }}>
          <label className="label">Name</label>
          <input
            className="input"
            style={{ height: 32, fontSize: 13 }}
            value={controlled ? editFormData!.processName ?? '' : node.label}
            onChange={(e) => controlled && onChange!({ processName: e.target.value })}
            readOnly={!controlled}
          />
        </div>
        <div style={{ gridColumn: '1/3' }}>
          <label className="label">Description</label>
          <textarea
            className="input"
            style={{ height: 60, padding: 8, fontSize: 12, resize: 'vertical' }}
            value={controlled ? editFormData!.processDescription ?? '' : ''}
            onChange={(e) =>
              controlled && onChange!({ processDescription: e.target.value })
            }
            readOnly={!controlled}
            placeholder="Describe this component"
          />
        </div>
      </div>
    </InspectorSection>
  )
}
