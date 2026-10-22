'use client'

// Direction, quantity and unit for a new flow. While a transport leg is in
// use the quantity IS mass × distance, so it is read-only.

import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { compatibleUnits } from '@/lib/units'
import type { Substance } from '@/lib/case-editor/flow-types'

export function FlowQuantityFields({
  dir,
  setDir,
  qty,
  setQty,
  unit,
  setUnit,
  legInUse,
  selectedSubstance,
}: {
  dir: 'input' | 'output'
  setDir: (dir: 'input' | 'output') => void
  qty: string
  setQty: (qty: string) => void
  unit: string
  setUnit: (unit: string) => void
  legInUse: boolean
  selectedSubstance: Substance | undefined
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      <div>
        <label className="label" style={{ fontSize: 11 }}>
          Direction
          <HelpTip label="Input or output?">{ISO_HELP.flowDirection}</HelpTip>
        </label>
        <select
          className="input"
          value={dir}
          onChange={(e) => setDir(e.target.value as 'input' | 'output')}
        >
          <option value="input">Input</option>
          <option value="output">Output</option>
        </select>
      </div>
      <div>
        <label className="label" style={{ fontSize: 11 }}>
          Quantity
          <HelpTip label="How much should I enter?">{ISO_HELP.flowQuantity}</HelpTip>
        </label>
        <input
          className="input"
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          // While the leg is used, quantity IS mass x distance (TKM-2):
          // a hand-typed tkm would disagree with the stored leg.
          readOnly={legInUse}
          title={legInUse ? 'Worked out from the mass and distance above' : undefined}
          placeholder="0.0"
        />
      </div>
      <div>
        <label className="label" style={{ fontSize: 11 }}>
          Unit
          <HelpTip label="Which units work?">{ISO_HELP.flowUnit}</HelpTip>
        </label>
        <input
          className="input"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="kg"
          list="lcapix-flow-units"
        />
        <datalist id="lcapix-flow-units">
          {(selectedSubstance ? compatibleUnits(selectedSubstance.unit) : []).map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
    </div>
  )
}
