'use client'

// The Write-up panel beside the tree (E06, behaviour spec "Write-up tab"): the
// answer with its note against the Base case, Interpretation and Assumptions
// (saved to the case, printed in the report), and Export the report as PDF,
// PowerPoint or CSV.

import { perUnit } from '@/lib/workspace/per-unit'
import { useEffect, useState } from 'react'
import { Button, SavedLine, Segmented } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { answer, caseTotal, co2Unit } from '@/lib/ui/format'
import { downloadRunExport } from '@/lib/results/results-view'
import { deltaChip, runClimate } from '@/lib/workspace/results-view'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'
import type { WorkspaceCase } from '@/lib/workspace/use-workspace'
import { FloatingPanel } from './floating-panel'

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
  /** The write-up changed: reload the case. */
  onSaved: () => void
}) {
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
