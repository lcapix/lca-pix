'use client'

// The add form's substance field: search the catalog (with impact-factor
// coverage and source on every match), switch between versions of a
// material, or — when it is not there — add one by hand or use the process
// library. Shows the chosen substance's source before the flow is saved.

import { Icon } from '@/components/lcapix/icon'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { ProcessLibrary } from '@/components/lcapix/case/process-library'
import { substanceSource } from '@/lib/substance-source'
import type { Substance } from '@/lib/case-editor/flow-types'
import type { AddFlowForm, AddSubstanceForm as AddSubstanceState } from '@/lib/case-editor/use-add-flow-form'
import { AddSubstanceForm } from './add-substance-form'
import { FactorCoverageBadge } from './factor-coverage-badge'

export function SubstancePicker({
  componentId,
  substances,
  form: { search, searchFor, substanceId, selectedSubstance, matches, versionsOfSelected, pickSubstance, libraryOpen, setLibraryOpen },
  substanceForm,
  onLibraryAdded,
}: {
  componentId: string
  substances: Substance[]
  form: AddFlowForm
  substanceForm: AddSubstanceState
  /** The process library added flows: reload and announce. */
  onLibraryAdded: () => void
}) {
  const { addingSubstance, openAddSubstance } = substanceForm
  return (
    <div>
      <label className="label" style={{ fontSize: 11 }}>
        Substance
        <HelpTip label="What is a substance?">{ISO_HELP.flowSubstance}</HelpTip>
      </label>
      <input
        className="input"
        placeholder="Search substances…"
        value={selectedSubstance ? selectedSubstance.substance_name : search}
        onChange={(e) => searchFor(e.target.value)}
      />
      {!substanceId && (
        <div
          style={{
            marginTop: 4,
            border: matches.length ? '1px solid var(--border-subtle)' : 'none',
            borderRadius: 6,
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          {matches.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 8px' }}>
              {substances.length === 0
                ? 'No substances in catalog. Import a factor pack from Integrations → openLCA.'
                : 'No match.'}
            </div>
          ) : (
            matches.map((s) => (
              <button
                key={s.substance_id}
                type="button"
                onClick={() => pickSubstance(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  fontSize: 12,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                  {s.variant_of ? '↳ ' : ''}
                  {s.substance_name}
                  <FactorCoverageBadge s={s} />
                  {s.variant_label && (
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: '1px 5px',
                        borderRadius: 999,
                        background: 'color-mix(in oklab, var(--brand-primary) 12%, transparent)',
                        color: 'var(--brand-primary)',
                      }}
                    >
                      {s.variant_label}
                    </span>
                  )}
                </span>
                {s.category ? (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}> · {s.category}</span>
                ) : null}
                <span
                  className="mono"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 2,
                    fontSize: 9.5,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <Icon name="database" size={9} />
                  {substanceSource(s).label}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      {substanceId && versionsOfSelected.length > 0 && (
        <div
          style={{
            marginTop: 6,
            padding: '6px 8px',
            borderRadius: 6,
            background: 'color-mix(in oklab, var(--brand-primary) 6%, transparent)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ marginRight: 6 }}>Versions of this material:</span>
          {versionsOfSelected.map((v) => (
            <button
              key={v.substance_id}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '1px 6px', fontSize: 11 }}
              title={`Switch to ${v.substance_name}${v.variant_label ? ` (${v.variant_label})` : ''}`}
              onClick={() => pickSubstance(v)}
            >
              {v.variant_label || v.substance_name}
            </button>
          ))}
        </div>
      )}
      {!substanceId && !addingSubstance && !libraryOpen && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 6, padding: '2px 0', fontSize: 11.5 }}
            onClick={() => openAddSubstance(search)}
          >
            Not in the list? Add a substance
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 6, padding: '2px 0', fontSize: 11.5 }}
            onClick={() => setLibraryOpen(true)}
            title="Pick the kind of process this step is: the library lists what it consumes and in which unit"
          >
            Don't know what to add? Use the process library
          </button>
        </div>
      )}
      {libraryOpen && (
        <ProcessLibrary
          componentId={componentId}
          onAdded={onLibraryAdded}
          onClose={() => setLibraryOpen(false)}
        />
      )}
      {addingSubstance && <AddSubstanceForm form={substanceForm} />}
      {/* Source database for the chosen substance — answers
          "what database is this coming from?" before the flow is saved. */}
      {selectedSubstance && (
        <div
          className="mono"
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10,
            color: 'var(--text-secondary)',
            background: 'var(--surface-overlay)',
            padding: '4px 8px',
            borderRadius: 5,
          }}
        >
          <Icon name="database" size={11} />
          Source: {substanceSource(selectedSubstance).label}
          <FactorCoverageBadge s={selectedSubstance} />
        </div>
      )}
    </div>
  )
}
