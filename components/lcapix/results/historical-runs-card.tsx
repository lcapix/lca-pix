'use client'

// Historical runs of this case for the active category: the RunTimeline chart,
// then every run as a row with Open, so an older run can be read (read-only)
// with the keyboard as well as the mouse.

import { RunTimeline, type RunTimelineRun } from '@/components/lcapix'
import { fmtSig } from '@/components/lcapix/formatters'

export interface RunListItem {
  run_id: number
  run_date: string
  calculation_method?: string | null
  regionCode?: string | null
  status?: string | null
  /** The active category's total for this run, when it has one. */
  value?: number | null
  unit?: string | null
}

export function HistoricalRunsCard({
  historyRuns,
  runs = [],
  shownRunId = null,
  onOpenRun,
  handleRunAssessment,
}: {
  historyRuns: RunTimelineRun[]
  /** Every run, newest first. */
  runs?: RunListItem[]
  /** The run the page is showing. */
  shownRunId?: number | null
  onOpenRun?: (runId: number) => void
  /** Omitted for a "Can read" member. */
  handleRunAssessment?: () => void
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Historical runs</h2>
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
          {runs.length || historyRuns.length} runs
        </span>
        <div style={{ flex: 1 }} />
        {handleRunAssessment && (
          <button
            type="button"
            className="chip"
            style={{ fontSize: 12, cursor: 'pointer', border: 'none' }}
            onClick={handleRunAssessment}
          >
            Run new
          </button>
        )}
      </div>
      <RunTimeline runs={historyRuns} />
      {runs.length > 0 && onOpenRun && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 13 }}>
          <caption style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>
            Open a run to read it as it was when it ran.
          </caption>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 12 }}>
              <th scope="col" style={{ padding: '6px 8px' }}>Run</th>
              <th scope="col" style={{ padding: '6px 8px' }}>Date</th>
              <th scope="col" style={{ padding: '6px 8px' }}>Method · region</th>
              <th scope="col" style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
              <th scope="col" style={{ padding: '6px 8px' }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const done = !r.status || r.status === 'completed'
              const shown = r.run_id === shownRunId
              const d = new Date(r.run_date)
              return (
                <tr key={r.run_id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)' }}>#{r.run_id}</td>
                  <td style={{ padding: '6px 8px' }}>{isNaN(d.getTime()) ? 'Recent' : d.toLocaleString('en-US')}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {[r.calculation_method, r.regionCode].filter(Boolean).join(' · ') || '–'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {done && typeof r.value === 'number' ? `${fmtSig(r.value)} ${r.unit ?? ''}` : done ? '–' : 'Did not finish'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    {shown ? (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Showing</span>
                    ) : done ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenRun(r.run_id)}
                        aria-label={`Open run ${r.run_id}`}
                      >
                        Open
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
