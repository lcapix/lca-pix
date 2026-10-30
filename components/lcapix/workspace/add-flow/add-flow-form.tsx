'use client'

// The open add-flow form in the step panel: the substance, the transport leg
// when the substance is one, then direction, quantity and unit, and Save flow
// or Cancel. State and rules live in useAddFlowForm.

import { compatibleUnits } from '@/lib/units'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import type { Substance } from '@/lib/case-editor/flow-types'
import type { AddFlowForm as AddFlowState, AddSubstanceForm as AddSubstanceState } from '@/lib/case-editor/use-add-flow-form'
import { HelpTip } from '../help-tip'
import { SubstancePicker } from './substance-picker'

export function AddFlowForm({
  componentId,
  substances,
  form,
  substanceForm,
  initialTemplateId = null,
  onLibraryAdded,
}: {
  componentId: string
  substances: Substance[]
  form: AddFlowState
  substanceForm: AddSubstanceState
  /** Open the process library already on this process (set when a step is created from one). */
  initialTemplateId?: number | null
  onLibraryAdded: () => void
}) {
  const { substanceId, selectedSubstance, dir, setDir, qty, setQty, unit, setUnit, isTransportLeg, legInUse, legInvalid, saving, saveFlow, resetForm } = form
  return (
    <div className="ds-card af-form" role="group" aria-label="Add a flow">
      <SubstancePicker
        componentId={componentId}
        substances={substances}
        form={form}
        substanceForm={substanceForm}
        initialTemplateId={initialTemplateId}
        onLibraryAdded={onLibraryAdded}
      />

      {isTransportLeg && <TransportLeg form={form} />}

      <div className="af-grid3">
        <label>
          <span className="ds-label">
            Direction
            <HelpTip label="Input or output?">{ISO_HELP.flowDirection}</HelpTip>
          </span>
          <select className="ds-input af-full" aria-label="Direction" value={dir} onChange={(e) => setDir(e.target.value as 'input' | 'output')}>
            <option value="input">Input</option>
            <option value="output">Output</option>
          </select>
        </label>
        <label>
          <span className="ds-label">
            Quantity
            <HelpTip label="How much should I enter?">{ISO_HELP.flowQuantity}</HelpTip>
          </span>
          <input
            className="ds-input af-full"
            aria-label="Quantity"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            // While the leg is used, quantity IS mass x distance (TKM-2):
            // a hand-typed tkm would disagree with the stored leg.
            readOnly={legInUse}
            title={legInUse ? 'Worked out from the mass and distance above' : undefined}
            placeholder="0.0"
          />
        </label>
        <label>
          <span className="ds-label">
            Unit
            <HelpTip label="Which units work?">{ISO_HELP.flowUnit}</HelpTip>
          </span>
          <input className="ds-input af-full" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" list="af-units" />
          <datalist id="af-units">
            {(selectedSubstance ? compatibleUnits(selectedSubstance.unit) : []).map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="af-actions">
        <button type="button" className="ds-btn ds-btn--primary ds-btn--small" disabled={!substanceId || !qty || saving || legInvalid} onClick={saveFlow}>
          {saving ? 'Saving…' : 'Save flow'}
        </button>
        <button type="button" className="ds-btn ds-btn--small" onClick={resetForm}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Mass (t) × distance (km) gives tonne-km; the quantity follows (E18). */
function TransportLeg({ form: { legMassT, legKm, legTkm, legInvalid, setLeg } }: { form: AddFlowState }) {
  return (
    <div className="af-leg">
      <p className="ds-label" style={{ margin: 0 }}>
        Transport leg: enter mass and distance, we compute tonne-km
      </p>
      <div className="af-leg-grid">
        <label>
          <span className="af-small">Mass (tonnes)</span>
          <input className="ds-input af-full" type="number" min={0} value={legMassT} onChange={(e) => setLeg(e.target.value, legKm)} placeholder="e.g. 1.2" />
        </label>
        <label>
          <span className="af-small">Distance (km)</span>
          <input className="ds-input af-full" type="number" min={0} value={legKm} onChange={(e) => setLeg(legMassT, e.target.value)} placeholder="e.g. 450" />
        </label>
        <span className="ds-mono af-tkm">= {legTkm != null ? legTkm.toLocaleString() : '–'} tkm</span>
      </div>
      {legInvalid && (
        <p role="alert" className="af-error">
          Mass and distance must both be above 0.
        </p>
      )}
    </div>
  )
}
