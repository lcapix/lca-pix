'use client'

// Add a substance the library does not have (name, input or emission, unit,
// method, impact category, factor and its source), then use it.

import { METHODS } from '@/lib/project/study-options'
import type { AddSubstanceForm as AddSubstanceState } from '@/lib/case-editor/use-add-flow-form'
import { HelpTip } from '../help-tip'

export function AddSubstanceForm({
  form: { newSub, setNewSub, subError, subBusy, impactCategories, submitSubstance, cancelAddSubstance },
}: {
  form: AddSubstanceState
}) {
  return (
    <div className="ds-card af-sub" role="group" aria-label="Add a substance">
      <p className="ds-label" style={{ margin: 0 }}>
        Add a substance
        <HelpTip label="When should I add one?">
          Add a material, fuel or emission the library does not have, rather than picking something close and modelling
          the wrong thing. It is yours alone, and its factor counts as unverified data until you replace the source with
          a published one.
        </HelpTip>
      </p>
      <label>
        <span className="af-small">Name</span>
        <input className="ds-input af-full" placeholder="Name, e.g. Cork, expanded" value={newSub.name} onChange={(e) => setNewSub({ ...newSub, name: e.target.value })} />
      </label>
      <div className="af-grid2">
        <label>
          <span className="af-small">What is it?</span>
          <select className="ds-input af-full" value={newSub.kind} onChange={(e) => setNewSub({ ...newSub, kind: e.target.value as 'input' | 'emission' })}>
            <option value="input">Something you buy or use</option>
            <option value="emission">Something released</option>
          </select>
        </label>
        <label>
          <span className="af-small">Measured in</span>
          <input className="ds-input af-full" placeholder="kg, kWh, MJ, m3, tkm" value={newSub.unit} onChange={(e) => setNewSub({ ...newSub, unit: e.target.value })} />
        </label>
      </div>
      <div className="af-grid2">
        <label>
          <span className="af-small">Method</span>
          <select className="ds-input af-full" value={newSub.method} onChange={(e) => setNewSub({ ...newSub, method: e.target.value })}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="af-small">Impact category</span>
          <select className="ds-input af-full" value={newSub.impactCategory} onChange={(e) => setNewSub({ ...newSub, impactCategory: e.target.value })}>
            {(impactCategories.length ? impactCategories.map((c) => c.category_name) : ['Global Warming']).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="af-small">Factor, per {newSub.unit || 'unit'}</span>
        <input className="ds-input af-full" type="number" step="any" placeholder="e.g. 1.6" value={newSub.factorValue} onChange={(e) => setNewSub({ ...newSub, factorValue: e.target.value })} />
      </label>
      <label>
        <span className="af-small">Where it comes from</span>
        <input className="ds-input af-full" placeholder="e.g. Amorim ICB EPD 2023, cradle-to-gate" value={newSub.source} onChange={(e) => setNewSub({ ...newSub, source: e.target.value })} />
      </label>
      {subError && (
        <p role="alert" className="af-error">
          {subError}
        </p>
      )}
      <div className="af-actions">
        <button type="button" className="ds-btn ds-btn--primary ds-btn--small" disabled={subBusy} onClick={submitSubstance}>
          {subBusy ? 'Adding…' : 'Add and use it'}
        </button>
        <button type="button" className="ds-btn ds-btn--small" onClick={cancelAddSubstance}>
          Cancel
        </button>
      </div>
    </div>
  )
}
