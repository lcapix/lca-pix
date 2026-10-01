'use client'

import type { AiStatus, Contributor } from '@/lib/insights/magic-insights'
import { renderWithCitations } from '@/components/lcapix/magic-insights/cited-text'

export interface InsightBodyProps {
  /** Remounts the text whenever the question changes. */
  bodyKey: string
  bodyText: string
  showCursor: boolean
  contributors: Contributor[]
  projectId: string
  caseId: string
  usingAI: boolean
  aiMode: boolean
  aiStatus: AiStatus
  aiModel: string
}

/** Streamed body with cited data chips, the typing cursor and the provenance line. */
export function InsightBody({
  bodyKey,
  bodyText,
  showCursor,
  contributors,
  projectId,
  caseId,
  usingAI,
  aiMode,
  aiStatus,
  aiModel,
}: InsightBodyProps) {
  return (
    <div style={{ padding: '20px 24px 8px' }}>
      <div
        key={bodyKey}
        style={{
          fontSize: 14,
          color: 'var(--text-primary)',
          lineHeight: 1.65,
        }}
      >
        {renderWithCitations(bodyText, contributors, { projectId, caseId })}
        {showCursor && (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 8,
              height: 14,
              marginLeft: 2,
              verticalAlign: '-2px',
              background: 'var(--brand-primary)',
              animation: 'fadeIn 600ms ease infinite alternate',
            }}
          />
        )}
      </div>
      {/* Honest provenance line: computed vs AI, and — crucially — that the
          numbers always come from the engine, never the model. */}
      <ProvenanceLine usingAI={usingAI} aiMode={aiMode} aiStatus={aiStatus} aiModel={aiModel} />
    </div>
  )
}

/** Says where the text came from: the engine, the AI narration, or why AI is off. */
export function ProvenanceLine({
  usingAI,
  aiMode,
  aiStatus,
  aiModel,
}: {
  usingAI: boolean
  aiMode: boolean
  aiStatus: AiStatus
  aiModel: string
}) {
  return (
    <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
      {usingAI ? (
        <>
          Narrated by <span className="mono">{aiModel || 'an open model'}</span> via Hugging
          Face, grounded on your computed figures — the model phrases the analysis, the
          numbers come from the engine.
        </>
      ) : aiMode && aiStatus === 'limited' ? (
        <span role="status">You&apos;ve used this hour&apos;s insights — showing the computed summary</span>
      ) : aiMode && aiStatus === 'fallback' ? (
        <>AI narration unavailable (no model key configured) — showing the computed insight.</>
      ) : (
        <>Computed deterministically from your assessment results. Not AI-generated.</>
      )}
    </div>
  )
}
