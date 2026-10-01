'use client'

// Add a substance the catalog does not have (name, input or emission, unit,
// method, impact category, factor and its source), then use it.

import { HelpTip } from '@/components/lcapix/help-tip'
import type { AddSubstanceForm as AddSubstanceState } from '@/lib/case-editor/use-add-flow-form'

export function AddSubstanceForm({
  form: { newSub, setNewSub, subError, subBusy, impactCategories, submitSubstance, cancelAddSubstance },
}: {
  form: AddSubstanceState
}) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        border: '1px solid color-mix(in oklab, var(--brand-primary) 35%, transparent)',
        background: 'var(--surface-base)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div className="label" style={{ fontSize: 11 }}>
        Add a substance
        <HelpTip label="When should I add one?">
          Add a material, fuel or emission the catalog does not have, rather than picking
          something close and modelling the wrong thing. It is yours alone, and its factor
          counts as unverified data until you replace the source with a published one.
        </HelpTip>
      </div>
      <input
        className="input"
        placeholder="Name, e.g. Cork, expanded"
        value={newSub.name}
        onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
          What is it?
          <select
            className="input"
            value={newSub.kind}
            onChange={(e) => setNewSub({ ...newSub, kind: e.target.value as 'input' | 'emission' })}
            style={{ marginTop: 2 }}
          >
            <option value="input">Something you buy or use</option>
            <option value="emission">Something released</option>
          </select>
        </label>
        <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
          Measured in
          <input
            className="input"
            placeholder="kg, kWh, MJ, m3, tkm"
            value={newSub.unit}
            onChange={(e) => setNewSub({ ...newSub, unit: e.target.value })}
            style={{ marginTop: 2 }}
          />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
          Method
          <select
            className="input"
            value={newSub.method}
            onChange={(e) => setNewSub({ ...newSub, method: e.target.value })}
            style={{ marginTop: 2 }}
          >
            {['TRACI 2.1', 'CML 2001', 'ReCiPe Midpoint (H)'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
          Impact category
          <select
            className="input"
            value={newSub.impactCategory}
            onChange={(e) => setNewSub({ ...newSub, impactCategory: e.target.value })}
            style={{ marginTop: 2 }}
          >
            {(impactCategories.length
              ? impactCategories.map((c) => c.category_name)
              : ['Global Warming']
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
        Factor, per {newSub.unit || 'unit'}
        <input
          className="input"
          type="number"
          step="any"
          placeholder="e.g. 1.6"
          value={newSub.factorValue}
          onChange={(e) => setNewSub({ ...newSub, factorValue: e.target.value })}
          style={{ marginTop: 2 }}
        />
      </label>
      <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
        Where it comes from
        <input
          className="input"
          placeholder="e.g. Amorim ICB EPD 2023, cradle-to-gate"
          value={newSub.source}
          onChange={(e) => setNewSub({ ...newSub, source: e.target.value })}
          style={{ marginTop: 2 }}
        />
      </label>
      {subError && (
        <div role="alert" style={{ fontSize: 11.5, color: '#b45309', lineHeight: 1.45 }}>
          {subError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={subBusy}
          onClick={submitSubstance}
        >
          {subBusy ? 'Adding…' : 'Add and use it'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={cancelAddSubstance}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
