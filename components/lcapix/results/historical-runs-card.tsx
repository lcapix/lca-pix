'use client'

// Historical runs of this case for the active category, on the RunTimeline.

import { RunTimeline, type RunTimelineRun } from '@/components/lcapix'

export function HistoricalRunsCard({
  historyRuns,
  handleRunAssessment,
}: {
  historyRuns: RunTimelineRun[]
  handleRunAssessment: () => void
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>Historical runs</span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          {historyRuns.length} runs
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="chip"
          style={{ fontSize: 11, cursor: 'pointer', border: 'none' }}
          onClick={handleRunAssessment}
        >
          Run new
        </button>
      </div>
      <RunTimeline runs={historyRuns} />
    </div>
  )
}
