'use client'

// The add form's substance field: search the whole library, with the climate
// factor, unit, source and method coverage on every match; switch between
// versions of a material; or, when it is not there, add one by hand or use
// the process library (E17). The chosen substance's source shows before the
// flow is saved.

import { substanceSource } from '@/lib/substance-source'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import type { Substance } from '@/lib/case-editor/flow-types'
import type { AddFlowForm, AddSubstanceForm as AddSubstanceState } from '@/lib/case-editor/use-add-flow-form'
import { HelpTip } from '../help-tip'
import { AddSubstanceForm } from './add-substance-form'
import { ProcessLibrary } from './process-library'

export function SubstancePicker({
  componentId,
  substances,
  form: { search, searchFor, substanceId, selectedSubstance, matches, versionsOfSelected, pickSubstance, libraryOpen, setLibraryOpen },
  substanceForm,
  initialTemplateId = null,
  onLibraryAdded,
}: {
  componentId: string
  substances: Substance[]
  form: AddFlowForm
  substanceForm: AddSubstanceState
  initialTemplateId?: number | null
  /** The process library added flows: reload and announce. */
  onLibraryAdded: () => void
}) {
  const { addingSubstance, openAddSubstance } = substanceForm
  return (
    <div className="af-picker">
      <label>
        <span className="ds-label">
          Substance
          <HelpTip label="What is a substance?">{ISO_HELP.flowSubstance}</HelpTip>
        </span>
        <input
          className="ds-input af-full"
          placeholder="Search substances…"
          value={selectedSubstance ? selectedSubstance.substance_name : search}
          onChange={(e) => searchFor(e.target.value)}
        />
      </label>

      {!substanceId && (
        <div className="af-options" aria-label="Matching substances" role="group">
          {matches.length === 0 ? (
            <p className="af-muted">{substances.length === 0 ? 'The substance library is empty.' : 'No match.'}</p>
          ) : (
            matches.map((s) => (
              <button key={s.substance_id} type="button" className="af-option" onClick={() => pickSubstance(s)}>
                <span className="af-option-name">
                  {s.variant_of ? '↳ ' : ''}
                  {s.substance_name}
                  {s.variant_label && <span className="ds-tag">{s.variant_label}</span>}
                  <Coverage s={s} />
                  {s.category ? <span className="af-muted"> · {s.category}</span> : null}
                </span>
                <span className="ds-mono af-option-meta">
                  {s.climate_factor != null ? `${s.climate_factor} ${s.climate_unit ?? ''}`.trim() : 'no climate factor'}
                  {' · '}
                  {s.unit ?? 'unit not set'}
                  {' · '}
                  {substanceSource(s).label}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {substanceId && versionsOfSelected.length > 0 && (
        <div className="af-versions">
          <span>Versions of this material:</span>
          {versionsOfSelected.map((v) => (
            <button
              key={v.substance_id}
              type="button"
              className="ds-btn ds-btn--small"
              title={`Switch to ${v.substance_name}${v.variant_label ? ` (${v.variant_label})` : ''}`}
              onClick={() => pickSubstance(v)}
            >
              {v.variant_label || v.substance_name}
            </button>
          ))}
        </div>
      )}

      {!substanceId && !addingSubstance && !libraryOpen && (
        <div className="af-links">
          <button type="button" className="ds-link" onClick={() => openAddSubstance(search)}>
            Not in the list? Add a substance
          </button>
          <button
            type="button"
            className="ds-link"
            onClick={() => setLibraryOpen(true)}
            title="Pick the kind of process this step is: the library lists what it consumes and in which unit"
          >
            Don&apos;t know what to add? Use the process library
          </button>
        </div>
      )}

      {libraryOpen && (
        <ProcessLibrary componentId={componentId} initialTemplateId={initialTemplateId} onAdded={onLibraryAdded} onClose={() => setLibraryOpen(false)} />
      )}
      {addingSubstance && <AddSubstanceForm form={substanceForm} />}

      {selectedSubstance && (
        <p className="ds-mono af-source">
          Source: {substanceSource(selectedSubstance).label}
          <Coverage s={selectedSubstance} />
        </p>
      )}
    </div>
  )
}

/** Which methods have factors for it; a substance with none says so before it is used (it would add zero). */
function Coverage({ s }: { s: { methods_with_factors?: string; factor_count?: number } }) {
  const methods = (s.methods_with_factors || '').split('|').filter(Boolean)
  const has = (s.factor_count ?? 0) > 0 && methods.length > 0
  return (
    <span
      className={has ? 'ds-tag ds-tag--reference' : 'ds-tag af-tag-none'}
      title={has ? `Impact factors available: ${methods.join(', ')}` : 'No impact factors: flows of this substance count as zero in every category'}
    >
      {has ? methods.map((m) => m.split(' ')[0]).join(' · ') : 'no impact factors'}
    </span>
  )
}
