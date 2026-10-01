'use client'

// Machine energy = hours × kW × load, on a process step. The kWh can be added
// as an Electricity input flow; its energy and machine-hour costs can fill
// the cost fields (saved with Save).

import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { ENERGY_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates'
import { useMachineEnergy } from '@/lib/case-editor/use-machine-energy'
import type { InspectorEditFormData } from '@/lib/case-editor/types'

export function MachineEnergy({
  componentId,
  laborHours,
  onChange,
}: {
  componentId: string
  laborHours?: number
  onChange: (patch: Partial<InspectorEditFormData>) => void
}) {
  const {
    hours,
    setHours,
    kw,
    setKw,
    loadPct,
    setLoadPct,
    price,
    setPrice,
    machineRate,
    setMachineRate,
    kwh,
    energyCost,
    equipmentCost,
    adding,
    addElectricityFlow,
  } = useMachineEnergy(componentId)

  const num = (value: string, set: (v: string) => void, label: string, placeholder: string) => (
    <div>
      <label className="label" style={{ fontSize: 10 }}>
        {label}
      </label>
      <input
        className="input mono"
        type="number"
        step="any"
        min={0}
        style={{ height: 28, fontSize: 12, width: 70 }}
        value={value}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onChange={(e) => set(e.target.value)}
        aria-label={label}
      />
    </div>
  )
  const op = (s: string) => (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>{s}</div>
  )

  return (
    <div
      style={{
        marginBottom: 10,
        padding: '8px 10px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
        Machine energy = hours × kW × load
        <HelpTip label="How is machine energy worked out?">{ISO_HELP.machineEnergy}</HelpTip>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {num(hours, setHours, 'Run hours', laborHours != null ? `${laborHours}` : 'h')}
        {op('×')}
        {num(kw, setKw, 'Power (kW)', 'kW')}
        {op('×')}
        {num(loadPct, setLoadPct, 'Load (%)', '%')}
        {op('=')}
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, paddingBottom: 6 }}>
          {kwh != null ? `${kwh} kWh` : '— kWh'}
        </div>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 6 }}
      >
        {num(price, setPrice, 'Price ($/kWh)', '$/kWh')}
        {op('→')}
        <div className="mono" style={{ fontSize: 12, paddingBottom: 6 }}>
          {energyCost != null ? `$${energyCost.toFixed(2)} energy` : '—'}
        </div>
        {num(machineRate, setMachineRate, 'Machine $/h', 'optional')}
        {op('→')}
        <div className="mono" style={{ fontSize: 12, paddingBottom: 6 }}>
          {equipmentCost != null ? `$${equipmentCost.toFixed(2)} machine` : '—'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 11 }}
          disabled={kwh == null || adding}
          onClick={addElectricityFlow}
        >
          {adding ? 'Adding…' : 'Add kWh as electricity input'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
          disabled={energyCost == null}
          onClick={() => energyCost != null && onChange({ energyCost })}
        >
          Use as energy cost
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
          disabled={equipmentCost == null}
          onClick={() => equipmentCost != null && onChange({ equipmentCost })}
        >
          Use as machine cost
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        Price: {ENERGY_RATES.electricity_industrial.label} (EIA reference, {REFERENCE_VINTAGE}); edit
        it to match your bill. Costs save with Save.
      </div>
    </div>
  )
}
