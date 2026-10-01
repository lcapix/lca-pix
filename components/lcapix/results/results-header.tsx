'use client'

// Results header: case name and latest run, the method and region pickers
// (they only set the next run), exports, Magic Insights and Re-run.

import { Icon } from '@/components/lcapix'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { safeRunDate, type AssessmentResult } from '@/lib/results/results-view'

export interface ResultsHeaderProps {
  currentCase: { name?: string }
  mostRecentAssessment: AssessmentResult | null
  assessmentsError: string | null
  method: string
  region: string
  setPickedMethod: (method: string) => void
  setPickedRegion: (region: string) => void
  exporting: null | 'pdf' | 'pptx' | 'csv'
  handleExport: (format: 'pdf' | 'pptx' | 'csv') => void
  magicPulse: boolean
  setMagicPulse: (on: boolean) => void
  setMagicOpen: (open: boolean) => void
  handleRunAssessment: () => void
  isRunningAssessment: boolean
}

export function ResultsHeader({
  currentCase,
  mostRecentAssessment,
  assessmentsError,
  method,
  region,
  setPickedMethod,
  setPickedRegion,
  exporting,
  handleExport,
  magicPulse,
  setMagicPulse,
  setMagicOpen,
  handleRunAssessment,
  isRunningAssessment,
}: ResultsHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 280 }}>
        <h1
          className="display"
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {currentCase.name || 'Assessment Results'}
        </h1>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            marginTop: 4,
          }}
        >
          {mostRecentAssessment ? (
            <>
              <span
                className="mono"
                style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'var(--surface-overlay)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'var(--brand-primary)',
                  marginRight: 8,
                }}
              >
                LATEST RUN
              </span>
              Run #{mostRecentAssessment.run_id} ·{' '}
              {safeRunDate(mostRecentAssessment.run_date)}
            </>
          ) : assessmentsError ? (
            <span style={{ color: 'var(--signal-warn, #b45309)' }}>
              Could not load this case&apos;s assessments ({assessmentsError}). Reload the page to try
              again.
            </span>
          ) : (
            'No assessments yet — run one to see results.'
          )}
        </div>
      </div>

      {/* Method selector */}
      <label
        className="chip"
        style={{
          padding: 0,
          background: 'var(--surface-overlay)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            paddingLeft: 10,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-tertiary)',
          }}
        >
          <Icon name="layers" size={12} />
        </span>
        <select
          value={method}
          onChange={(e) => setPickedMethod(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          <option value="CML 2001">CML 2001</option>
          <option value="ReCiPe Midpoint (H)">ReCiPe Midpoint (H)</option>
          <option value="TRACI 2.1">TRACI 2.1</option>
        </select>
        <HelpTip label="What is an impact-assessment method?">
          The method is the set of characterization factors that turns each input and
          output into impact scores. CML 2001 (Leiden University) is common in Europe;
          TRACI 2.1 is the US EPA method; ReCiPe Midpoint (H) uses the default
          &quot;hierarchist&quot; perspective. Results from different methods cannot be
          added or compared, so keep one method for every case you compare.
        </HelpTip>
      </label>

      {/* Region selector */}
      <label
        className="chip"
        style={{
          padding: 0,
          background: 'var(--surface-overlay)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            paddingLeft: 10,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-tertiary)',
          }}
        >
          <Icon name="globe" size={12} />
        </span>
        <select
          value={region}
          onChange={(e) => setPickedRegion(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          <option value="US Grid">US Grid</option>
          <option value="EU Average">EU Average</option>
          <option value="Global">Global</option>
        </select>
        <HelpTip label="What does the region change?">{ISO_HELP.region}</HelpTip>
      </label>

      <button
        className="btn btn-secondary btn-sm"
        onClick={() => handleExport('pdf')}
        disabled={exporting !== null}
        title="Download a PDF report of the latest run"
      >
        <Icon name="download" size={14} />{' '}
        {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
      </button>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => handleExport('pptx')}
        disabled={exporting !== null}
        title="Download a PowerPoint deck of the latest run"
      >
        <Icon name="download" size={14} />{' '}
        {exporting === 'pptx' ? 'Exporting…' : 'Export PPT'}
      </button>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => handleExport('csv')}
        disabled={exporting !== null}
        title="Every flow of this run as a spreadsheet row: amount, factor, its source and the impact"
      >
        {exporting === 'csv' ? 'Exporting…' : 'Export rows (CSV)'}
      </button>
      <button
        type="button"
        className={`btn btn-secondary btn-sm ${magicPulse ? 'bell-pulse' : ''}`}
        onClick={() => {
          setMagicPulse(false)
          setMagicOpen(true)
        }}
        style={{
          background:
            'linear-gradient(135deg, oklch(from var(--brand-primary) l c h / 0.12), oklch(from var(--chart-2, var(--brand-primary)) l c h / 0.12))',
          color: 'var(--brand-primary)',
          borderColor: 'var(--brand-primary)',
        }}
        title="AI summary of this assessment"
      >
        <Icon name="sparkle" size={14} /> Magic Insights
      </button>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleRunAssessment}
        disabled={isRunningAssessment}
      >
        <Icon name="run" size={14} />{' '}
        {mostRecentAssessment ? 'Re-run' : 'Run new'}
      </button>
    </div>
  )
}
