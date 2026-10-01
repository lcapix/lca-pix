'use client'

// Costs. A roll-up node shows only the Σ of everything below it. A process
// step gets Suggest (from its flows), the labor and machine-energy
// calculators, and the six activity-based cost fields.

import { HelpTip } from '@/components/lcapix/help-tip'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import type { NumberFieldKey } from '@/lib/case-editor/number-draft'
import type { InspectorEditFormData, InspectorFlow } from '@/lib/case-editor/types'
import type { NumberDrafts } from '@/lib/case-editor/use-number-drafts'
import { InlineError } from './inline-error'
import { InlineSuggestStrip } from './inline-suggest-strip'
import { InspectorSection } from './inspector-section'
import { LaborBreakdown } from './labor-breakdown'
import { MachineEnergy } from './machine-energy'

const COST_FIELDS: Array<[keyof InspectorEditFormData, string]> = [
  ['laborCost', 'Labor'],
  ['energyCost', 'Energy'],
  ['materialCost', 'Material'],
  ['transportationCost', 'Transport'],
  ['equipmentCost', 'Equipment'],
  ['overheadCost', 'Overhead'],
]

// Hover definitions for the cost fields (activity-based costing): what belongs
// in each bucket, so a student can fill them without a textbook.
const COST_HELP: Record<string, string> = {
  laborCost:
    'Wages for the people doing this step: hours × hourly rate. The calculator above works it out from hours and a BLS wage.',
  energyCost:
    'What you pay for the electricity, gas or fuel this step uses: kWh × price, or m³ × price.',
  materialCost: 'Purchase cost of the materials this step consumes.',
  transportationCost:
    'Freight to bring materials or parts to this step: usually distance × weight × a freight rate.',
  equipmentCost:
    'Machine cost for this step: depreciation, maintenance and tooling, often machine hours × a machine-hour rate.',
  overheadCost:
    'Shared costs assigned to this step (supervision, building, unmetered utilities), spread by a rule such as labor hours.',
}

export function CostsSection({
  node,
  controlled,
  hasChildren,
  rolled,
  editFormData,
  onChange,
  onApplyCosts,
  suggestFlows,
  drafts: { numberValue, numberError, onNumberChange },
}: {
  node: FlatCaseNode
  controlled: boolean
  hasChildren: boolean
  rolled: { cost: number; flows: number } | null
  editFormData?: InspectorEditFormData
  onChange?: (patch: Partial<InspectorEditFormData>) => void
  onApplyCosts?: (patch: Partial<InspectorEditFormData>) => void
  /** The step's flows as the flows editor last loaded them. */
  suggestFlows: InspectorFlow[]
  drafts: NumberDrafts
}) {
  return (
    <InspectorSection title="Costs">
      {hasChildren && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            padding: '4px 0',
            lineHeight: 1.5,
          }}
        >
          <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Σ ${Math.round(rolled?.cost ?? 0).toLocaleString()}
          </span>{' '}
          is the total of every cost below this node. Costs are entered on the process steps
          below it.
          <HelpTip label="Why can't I edit costs here?">
            Activity-based costing charges each cost to the activity that incurs it: labor and
            machine time to the operation, materials to the step that consumes them. A parent
            node is the sum of its activities, so it has no cost of its own to edit.
          </HelpTip>
        </div>
      )}
      {controlled && !hasChildren && (
        <InlineSuggestStrip
          key={`suggest-${node.id}`}
          componentType={(node?.type as string) ?? ''}
          nodeName={(node?.label as string) ?? ''}
          flows={suggestFlows}
          laborHours={editFormData!.laborHours}
          onApply={(s) => {
            const patch = {
              laborCost: s.labor ?? editFormData!.laborCost,
              energyCost: s.energy ?? editFormData!.energyCost,
              materialCost: s.material ?? editFormData!.materialCost,
              transportationCost: s.transportation ?? editFormData!.transportationCost,
            }
            onChange!(patch)
            // Persist immediately so applied costs are saved without hunting
            // for the Save button.
            onApplyCosts?.(patch)
          }}
        />
      )}
      {controlled && !hasChildren && (
        <LaborBreakdown
          key={(node?.id as string) ?? 'none'}
          node={node}
          editFormData={editFormData!}
          onChange={onChange!}
        />
      )}
      {controlled && !hasChildren && node.id && node.id !== '__root__' && (
        <MachineEnergy
          key={`machine-${node.id as string}`}
          componentId={node.id as string}
          laborHours={editFormData!.laborHours}
          onChange={onChange!}
        />
      )}
      {/* A roll-up node has no costs of its own: only the Σ line above. */}
      {!hasChildren && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {COST_FIELDS.map(([key, label]) => (
          <div key={key as string}>
            <label className="label" style={{ fontSize: 11 }}>
              {label}
              <HelpTip label={`What goes in ${label.toLowerCase()}?`}>
                {COST_HELP[key as string]}
              </HelpTip>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 8,
                  color: 'var(--text-tertiary)',
                  fontSize: 13,
                }}
              >
                $
              </span>
              <input
                className="input mono"
                style={{ height: 30, fontSize: 12, paddingLeft: 22 }}
                inputMode="decimal"
                aria-label={`${label} cost`}
                aria-invalid={!!numberError(key as NumberFieldKey)}
                value={controlled ? numberValue(key as NumberFieldKey) : ''}
                onChange={(e) => onNumberChange(key as NumberFieldKey, e.target.value)}
                readOnly={!controlled}
              />
            </div>
            <InlineError msg={numberError(key as NumberFieldKey)} />
          </div>
        ))}
      </div>
      )}
    </InspectorSection>
  )
}
