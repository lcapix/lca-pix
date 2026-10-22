'use client'

// Analytics page header: back button, project title, case-count subtitle and
// the PDF export button.

import { ArrowLeft } from 'lucide-react'
import { Icon } from '@/components/lcapix'
import { analyticsSubtitle } from '@/lib/analytics/derive'

export function AnalyticsHeader({
  projectName,
  caseCount,
  onBack,
  onExportPDF,
}: {
  projectName: string
  /** Number of assessed cases shown. */
  caseCount: number
  onBack: () => void
  onExportPDF: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
      }}
    >
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onBack()}
        aria-label="Back to project"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <div style={{ flex: 1 }}>
        <h1
          className="display"
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {projectName || 'Project Analytics'}
        </h1>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            marginTop: 4,
          }}
        >
          {analyticsSubtitle(caseCount)}
        </div>
      </div>
      <button
        className="btn btn-secondary btn-sm"
        onClick={onExportPDF}
      >
        <Icon name="download" size={14} /> PDF Export
      </button>
    </div>
  )
}
