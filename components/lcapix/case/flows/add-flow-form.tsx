'use client'

// The open add-flow form: substance, the transport leg when the substance is
// one, direction / quantity / unit, then Save flow or Cancel.

import type { Substance } from '@/lib/case-editor/flow-types'
import type { AddFlowForm as AddFlowState, AddSubstanceForm as AddSubstanceState } from '@/lib/case-editor/use-add-flow-form'
import { FlowQuantityFields } from './flow-quantity-fields'
import { SubstancePicker } from './substance-picker'
import { TransportLegFields } from './transport-leg-fields'

export function AddFlowForm({
  componentId,
  substances,
  form,
  substanceForm,
  onLibraryAdded,
}: {
  componentId: string
  substances: Substance[]
  form: AddFlowState
  substanceForm: AddSubstanceState
  onLibraryAdded: () => void
}) {
  const {
    substanceId,
    selectedSubstance,
    dir,
    setDir,
    qty,
    setQty,
    unit,
    setUnit,
    isTransportLeg,
    legMassT,
    legKm,
    legTkm,
    legInUse,
    legInvalid,
    setLeg,
    saving,
    saveFlow,
    resetForm,
  } = form
  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        background: 'var(--surface-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Substance search/picker */}
      <SubstancePicker
        componentId={componentId}
        substances={substances}
        form={form}
        substanceForm={substanceForm}
        onLibraryAdded={onLibraryAdded}
      />

      {/* Transport-leg calculator: mass (t) × distance (km) → tonne-km. */}
      {isTransportLeg && (
        <TransportLegFields legMassT={legMassT} legKm={legKm} legTkm={legTkm} legInvalid={legInvalid} setLeg={setLeg} />
      )}

      {/* Direction + qty + unit */}
      <FlowQuantityFields
        dir={dir}
        setDir={setDir}
        qty={qty}
        setQty={setQty}
        unit={unit}
        setUnit={setUnit}
        legInUse={legInUse}
        selectedSubstance={selectedSubstance}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!substanceId || !qty || saving || legInvalid}
          onClick={saveFlow}
          style={{ fontSize: 11 }}
        >
          {saving ? 'Saving…' : 'Save flow'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={resetForm}
          style={{ fontSize: 11 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
