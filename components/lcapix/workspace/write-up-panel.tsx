'use client'

// The Write-up panel beside the tree (E06, behaviour spec "Write-up tab"): the
// answer with its note against the Base case, Interpretation, Assumptions and
// Limits (saved to the case with an explicit Save, printed in the report), the
// hand-in, and Export the report as PDF, PowerPoint or CSV for a run the
// student picks (the latest by default).
//
// Nothing here saves on its own. Leaving the tab or the page with unsaved
// changes asks first: Save, Discard or keep editing.

import { runLabel } from '@/lib/results/full-results-view'
import { perUnit } from '@/lib/workspace/per-unit'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, ConfirmDialog, Flag, SavedLine, Segmented } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { LMS_NAME } from '@/lib/lms-name'
import { co2Unit } from '@/lib/ui/format'
import { headlineNumber } from '@/lib/results/number-view'
import { downloadRunExport, safeRunDate } from '@/lib/results/results-view'
import { whyNoChange } from '@/lib/project/comparison-banner'
import { deltaChip, runClimate } from '@/lib/workspace/results-view'
import { useCaseRuns, type WorkspaceRun } from '@/lib/workspace/use-runs'
import type { WorkspaceCase } from '@/lib/workspace/use-workspace'
import { FloatingPanel } from './floating-panel'
import { ExerciseSlot } from './exercise-card'

const MAX = 20000 // the case route's cap
type Format = 'pdf' | 'pptx' | 'csv'

/** What leaving the panel would take with it: anything typed or ticked and not saved. */
const LEAVING = 'a[href], [role="tab"], [role="menuitemradio"], [role="menuitem"]'

export function WriteUpPanel({
  kase,
  run,
  against,
  readOnly,
  onSaved,
}: {
  kase: WorkspaceCase
  run: WorkspaceRun | null
  against: { label: string; run_id: number; total: number; method?: string | null; region?: string | null } | null
  readOnly: boolean
  /** The case changed (write-up or hand-in): reload it. */
  onSaved: () => void
}) {
  const [, setGuided] = useGuidedMode()
  const [interpretation, setInterpretation] = useState(kase.interpretation ?? '')
  const [assumptions, setAssumptions] = useState(kase.assumptions ?? '')
  const [limitations, setLimitations] = useState(kase.limitations ?? '')
  const [finalDraft, setFinalDraft] = useState(kase.is_final)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [format, setFormat] = useState<Format>('pdf')
  useEffect(() => setInterpretation(kase.interpretation ?? ''), [kase.interpretation])
  useEffect(() => setAssumptions(kase.assumptions ?? ''), [kase.assumptions])
  useEffect(() => setLimitations(kase.limitations ?? ''), [kase.limitations])
  useEffect(() => setFinalDraft(kase.is_final), [kase.is_final])

  // G1: the report is on a run the student picks; the latest by default.
  const { completed } = useCaseRuns(kase.case_id, null)
  const [reportRunId, setReportRunId] = useState<number | null>(null)
  const reportRun = completed.find((r) => r.run_id === reportRunId) ?? completed[0] ?? run

  const climate = run ? runClimate(run) : null
  const unit = perUnit(kase)
  // A5: the same rule as Compare (whyNoNumber): no change across methods, regions or a stale run.
  const why =
    run && against
      ? whyNoChange(
          { name: kase.case_name, method: run.calculation_method, region: run.regionCode ?? 'Global' },
          { name: against.label || 'the Base case', method: against.method, region: against.region ?? 'Global' },
        )
      : null
  const chip = climate && against && !why ? deltaChip(climate.value, against) : null

  const textDirty =
    interpretation !== (kase.interpretation ?? '') ||
    assumptions !== (kase.assumptions ?? '') ||
    limitations !== (kase.limitations ?? '')
  const inAssignment = !!kase.assignment_id
  // The hand-in is a student's: someone who can change the case but does not run the project.
  const student = kase.my_role === 'editor'
  const tickShown = !inAssignment && (student || kase.is_final)
  const tickDirty = tickShown && student && !readOnly && finalDraft !== kase.is_final
  const dirty = !readOnly && (textDirty || tickDirty)
  const tooLong = interpretation.length > MAX || assumptions.length > MAX || limitations.length > MAX

  const put = async (body: Record<string, unknown>, what: string, line: string): Promise<boolean> => {
    setBusy(what)
    setError(null)
    try {
      const res = await apiRequest(`/api/cases/${kase.case_id}`, { method: 'PUT', body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
      setSaved(line)
      onSaved()
      return true
    } catch (e: any) {
      setError(`Not saved: ${e?.message ?? 'the request failed'}`)
      return false
    } finally {
      setBusy(null)
    }
  }

  const saveText = () => put({ interpretation, assumptions, limitations }, 'text', 'Saved · the write-up')
  const justSavedText = !textDirty && saved === 'Saved · the write-up'
  const saveTick = () =>
    put({ is_final: finalDraft }, 'final', finalDraft ? 'Saved · ticked as your hand-in' : 'Saved · no longer your hand-in')
  /** Everything not saved yet, text first. False when a save failed (the error says why). */
  const saveAll = async (): Promise<boolean> => {
    if (textDirty && !(await saveText())) return false
    if (tickDirty && !(await saveTick())) return false
    return true
  }
  const discard = useCallback(() => {
    setInterpretation(kase.interpretation ?? '')
    setAssumptions(kase.assumptions ?? '')
    setLimitations(kase.limitations ?? '')
    setFinalDraft(kase.is_final)
  }, [kase])

  // Leaving with unsaved changes asks first: a tab, a link or a case in the
  // switcher is held, and replayed after Save or Discard. Closing or
  // reloading the page asks through the browser.
  const [leaving, setLeaving] = useState<HTMLElement | null>(null)
  const replaying = useRef(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || replaying.current) return
      const el = (e.target as HTMLElement | null)?.closest?.(LEAVING) as HTMLElement | null
      if (!el || el.closest('.ds-dialog')) return
      if (el.getAttribute('role') === 'tab' && el.getAttribute('aria-selected') === 'true') return
      if (el.tagName === 'A' && (el.getAttribute('target') === '_blank' || el.hasAttribute('download'))) return
      e.preventDefault()
      e.stopPropagation()
      setLeaving(el)
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])
  const go = (el: HTMLElement) => {
    setLeaving(null)
    replaying.current = true
    try {
      el.click()
    } finally {
      replaying.current = false
    }
  }

  const exportReport = async () => {
    if (!reportRun) return
    setBusy('export')
    setError(null)
    try {
      await downloadRunExport(reportRun.run_id, format, kase.case_name)
      setSaved(`Exported · ${format === 'pptx' ? 'PowerPoint' : format.toUpperCase()} of ${runLabel(reportRun)}`)
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

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
  ) => (
    <label style={{ display: 'grid', gap: 6 }}>
      <strong style={{ fontSize: 15 }}>{label}</strong>
      {readOnly ? (
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{value.trim() || 'Not written yet.'}</p>
      ) : (
        <textarea className="ws-textarea" value={value} maxLength={MAX + 1} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
      )}
    </label>
  )

  return (
    <FloatingPanel
      tab="Write-up"
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
            Say what your result means, name your assumptions and the limits of the study. The report puts this next to your numbers.
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
        {climate && run ? (
          <>
            <div className="ws-answer">
              <span style={{ fontSize: 44, fontWeight: 600, lineHeight: 1 }}>{headlineNumber(climate.value, climate.name, kase.case_type)}</span>
              <span className="ds-mono" style={{ fontSize: 14 }}>
                {co2Unit(climate.unit)} per {unit}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>
              {runLabel(run)} · {run.calculation_method} · {run.regionCode ?? 'Global'}
            </p>
            {chip && (
              <span className="ws-pill" style={{ cursor: 'default', marginTop: 10 }}>
                {chip}
              </span>
            )}
            {why && against && (
              <p className="wu-nochange" style={{ margin: '10px 0 0', fontSize: 13 }}>
                No change against the {against.label || 'Base case'}: {why.replace(/\.$/, '')}.
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>Not run yet. The report needs a run; the write-up can start now.</p>
        )}
      </div>

      <div className="ws-panel-section" style={{ display: 'grid', gap: 14 }}>
        {field('Interpretation', interpretation, setInterpretation, 'What does the result mean? Which step drives it, and why?')}
        {field('Assumptions', assumptions, setAssumptions, 'What did the model assume? Which amounts are estimates, which factors are averages?')}
        {field('Limits', limitations, setLimitations, 'What can this study not say? What is left out, and what would change the answer?')}
        {!readOnly && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="dark"
              disabled={!textDirty || tooLong}
              disabledReason={tooLong ? `Keep each under ${MAX.toLocaleString()} characters` : textDirty || justSavedText ? undefined : 'Nothing to save yet'}
              busy={busy === 'text'}
              onClick={() => void saveText()}
            >
              Save the write-up
            </Button>
            {textDirty && <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>Not saved yet</span>}
            {/* The confirmation sits beside the button it answers, in view (B4). */}
            {justSavedText && <SavedLine>{saved}</SavedLine>}
          </span>
        )}
      </div>

      {inAssignment && !kase.read_only && (
        // One hand-in, on the Assignments page: it freezes a copy for the instructor.
        <div className="ws-panel-section">
          <strong style={{ fontSize: 15 }}>Next: hand it in</strong>
          <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--ds-text-2)' }}>
            Save your write-up, then hand in on the Assignments page. Your instructor gets a frozen copy of this case and its run.
          </p>
          <Link className="ds-btn" href={`/project/${kase.project_id}/assignments`}>
            Hand in on the Assignments page
          </Link>
        </div>
      )}

      {tickShown && (
        <div className="ws-panel-section">
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: student && !readOnly ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              className="ws-check"
              checked={finalDraft}
              disabled={!student || readOnly || busy === 'final'}
              onChange={(e) => setFinalDraft(e.target.checked)}
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
          {tickDirty && (
            <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <Button variant="dark" size="small" busy={busy === 'final'} onClick={() => void saveTick()}>
                Save the hand-in
              </Button>
              <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>Not saved yet</span>
            </span>
          )}
        </div>
      )}

      <div className="ws-panel-section" style={{ display: 'grid', gap: 10 }}>
        {completed.length > 0 && reportRun && (
          <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
            <strong>Run to report</strong>
            <select
              className="ds-input"
              value={String(reportRun.run_id)}
              onChange={(e) => setReportRunId(Number(e.target.value) || null)}
            >
              {completed.map((r, i) => (
                <option key={r.run_id} value={r.run_id}>
                  {runLabel(r)} · {r.calculation_method} · {r.regionCode ?? 'Global'} · {safeRunDate(r.run_date)}
                  {i === 0 ? ' (latest)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            disabled={!reportRun}
            disabledReason={reportRun ? undefined : 'Run this case first'}
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
        </span>
        {textDirty && !readOnly && (
          <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>The report prints the write-up as last saved.</span>
        )}
      </div>
      {((saved && !justSavedText) || error) && (
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

      <ConfirmDialog
        open={!!leaving}
        title="Save the write-up first?"
        consequence="You have changes in the write-up that are not saved. Save them, or discard them and go on."
        confirmLabel="Save"
        danger={false}
        busy={busy === 'text' || busy === 'final'}
        secondary={{
          label: 'Discard',
          onClick: () => {
            const el = leaving
            discard()
            dirtyRef.current = false
            if (el) go(el)
          },
        }}
        onConfirm={async () => {
          const el = leaving
          if (!(await saveAll())) {
            setLeaving(null)
            return
          }
          dirtyRef.current = false
          if (el) go(el)
        }}
        onCancel={() => setLeaving(null)}
      />
    </FloatingPanel>
  )
}
