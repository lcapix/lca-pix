'use client'

// The Write-up panel beside the tree (E06, behaviour spec "Write-up tab"): the
// answer with its note against the Base case, Interpretation and Assumptions
// (saved to the case, printed in the report), "This is my hand-in" for a
// student (it does not lock the case), and Export the report as PDF,
// PowerPoint or CSV.

import { perUnit } from '@/lib/workspace/per-unit'
import { useEffect, useState } from 'react'
import { Button, Flag, SavedLine, Segmented } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { LMS_NAME } from '@/lib/ui-flags'
import { answer, caseTotal, co2Unit } from '@/lib/ui/format'
import { downloadRunExport } from '@/lib/results/results-view'
import { deltaChip, runClimate } from '@/lib/workspace/results-view'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'
import type { WorkspaceCase } from '@/lib/workspace/use-workspace'
import { FloatingPanel } from './floating-panel'
import { ExerciseSlot } from './exercise-card'

const MAX = 20000 // the case route's cap
type Format = 'pdf' | 'pptx' | 'csv'

export function WriteUpPanel({
  kase,
  run,
  against,
  readOnly,
  onSaved,
}: {
  kase: WorkspaceCase
  run: WorkspaceRun | null
  against: { label: string; run_id: number; total: number } | null
  readOnly: boolean
  /** The case changed (write-up or hand-in): reload it. */
  onSaved: () => void
}) {
  const [, setGuided] = useGuidedMode()
  const [interpretation, setInterpretation] = useState(kase.interpretation ?? '')
  const [assumptions, setAssumptions] = useState(kase.assumptions ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [format, setFormat] = useState<Format>('pdf')
  useEffect(() => setInterpretation(kase.interpretation ?? ''), [kase.interpretation])
  useEffect(() => setAssumptions(kase.assumptions ?? ''), [kase.assumptions])

  const climate = run ? runClimate(run) : null
  const unit = perUnit(kase)
  const chip = climate && against ? deltaChip(climate.value, against) : null
  const dirty = interpretation !== (kase.interpretation ?? '') || assumptions !== (kase.assumptions ?? '')
  const tooLong = interpretation.length > MAX || assumptions.length > MAX
  // The hand-in is a student's: someone who can change the case but does not run the project.
  const student = kase.my_role === 'editor'

  const put = async (body: Record<string, unknown>, what: string, line: string) => {
    setBusy(what)
    setError(null)
    try {
      const res = await apiRequest(`/api/cases/${kase.case_id}`, { method: 'PUT', body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
      setSaved(line)
      onSaved()
    } catch (e: any) {
      setError(`Not saved: ${e?.message ?? 'the request failed'}`)
    } finally {
      setBusy(null)
    }
  }

  const exportReport = async () => {
    if (!run) return
    setBusy('export')
    setError(null)
    try {
      await downloadRunExport(run.run_id, format, kase.case_name)
      setSaved(`Exported · ${format === 'pptx' ? 'PowerPoint' : format.toUpperCase()} of Run #${run.run_id}`)
    } catch (e: any) {
      setError(`The report was not exported: ${e?.message ?? 'the request failed'}`)
    } finally {
      setBusy(null)
    }
  }

  const tickedAt = kase.finalized_at ? new Date(kase.finalized_at) : null
  const tickedText =
    tickedAt && !Number.isNaN(tickedAt.getTime())
      ? tickedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()
      : null

  return (
    <FloatingPanel
      label={`Write-up, ${kase.case_name}`}
      title={
        <>
          <span style={{ color: 'var(--ds-text-3)' }}>Write-up · </span>
          <strong>{kase.case_name}</strong>
        </>
      }
    >
      <ExerciseSlot
        fallback={
        <div className="ws-guide">
          <span style={{ flex: 1 }}>
            <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
              Guided mode · Write it up
            </span>
            <br />
            Say what your result means, then name your assumptions. The report puts this next to your numbers.
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <Flag kind="beta" />
            <button type="button" className="ds-link" onClick={() => setGuided(false)}>
              Turn off
            </button>
          </span>
        </div>
        }
      />

      <div className="ws-panel-section">
        {climate ? (
          <>
            <div className="ws-answer">
              <span style={{ fontSize: 44, fontWeight: 600, lineHeight: 1 }}>{answer(climate.value, kase.case_type)}</span>
              <span className="ds-mono" style={{ fontSize: 14 }}>
                {co2Unit(climate.unit)} per {unit}
              </span>
            </div>
            {chip && (
              <span className="ws-pill" style={{ cursor: 'default', marginTop: 10 }}>
                {chip}
              </span>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>Not run yet. The report needs a run; the write-up can start now.</p>
        )}
      </div>

      <div className="ws-panel-section" style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <strong style={{ fontSize: 15 }}>Interpretation</strong>
          {readOnly ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{interpretation.trim() || 'Not written yet.'}</p>
          ) : (
            <textarea
              className="ws-textarea"
              value={interpretation}
              maxLength={MAX + 1}
              placeholder="What does the result mean? Which step drives it, and why?"
              onChange={(e) => setInterpretation(e.target.value)}
            />
          )}
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <strong style={{ fontSize: 15 }}>Assumptions</strong>
          {readOnly ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{assumptions.trim() || 'Not written yet.'}</p>
          ) : (
            <textarea
              className="ws-textarea"
              value={assumptions}
              maxLength={MAX + 1}
              placeholder="What did the model assume or leave out? Which factors are averages?"
              onChange={(e) => setAssumptions(e.target.value)}
            />
          )}
        </label>
        {!readOnly && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="dark"
              disabled={!dirty || tooLong}
              disabledReason={tooLong ? `Keep each under ${MAX.toLocaleString()} characters` : undefined}
              busy={busy === 'text'}
              onClick={() => put({ interpretation, assumptions }, 'text', 'Saved · the write-up')}
            >
              Save the write-up
            </Button>
            {dirty && <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>Not saved yet</span>}
          </span>
        )}
      </div>

      {(student || kase.is_final) && (
        <div className="ws-panel-section">
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: student && !readOnly ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              className="ws-check"
              checked={kase.is_final}
              disabled={!student || readOnly || busy === 'final'}
              onChange={(e) =>
                put({ is_final: e.target.checked }, 'final', e.target.checked ? 'Saved · ticked as your hand-in' : 'Saved · no longer your hand-in')
              }
            />
            <span>
              <strong style={{ fontSize: 15 }}>{student ? 'This is my hand-in' : 'Ticked as the hand-in'}</strong>
              {kase.is_final && tickedText && (
                <span className="ds-mono" style={{ marginLeft: 8, fontSize: 13, color: 'var(--ds-green)' }}>
                  ✓ Ticked · {tickedText}
                </span>
              )}
              {student && (
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ds-text-2)', marginTop: 4 }}>
                  Tells your instructor which case to look at. It doesn&apos;t lock your case
                  {LMS_NAME ? `, and grades stay in ${LMS_NAME}.` : '.'}
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      <div className="ws-panel-section" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="primary"
          disabled={!run}
          disabledReason={run ? undefined : 'Run this case first'}
          busy={busy === 'export'}
          onClick={exportReport}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          Export the report
        </Button>
        <Segmented
          label="Report format"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'pdf', label: 'PDF' },
            { value: 'pptx', label: 'PowerPoint' },
            { value: 'csv', label: 'CSV' },
          ]}
        />
      </div>
      {(saved || error) && (
        <div style={{ padding: '0 18px 14px' }}>
          {error ? (
            <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
              {error}
            </span>
          ) : (
            <SavedLine>{saved}</SavedLine>
          )}
        </div>
      )}
    </FloatingPanel>
  )
}
