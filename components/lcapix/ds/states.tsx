'use client'

import type { ReactNode } from 'react'
import { Button } from './button'

/** Failure (rules.md): the cause, how to fix it, and Try again. Inline, never a toast. */
export function ErrorCard({
  title,
  cause,
  fix,
  onRetry,
  retrying,
}: {
  title: string
  cause?: ReactNode
  fix?: ReactNode
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="ds-error-card" role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ds-error-title">{title}</div>
        {cause && <div className="ds-error-body">{cause}</div>}
        {fix && <div className="ds-error-body">{fix}</div>}
      </div>
      {onRetry && (
        <Button size="small" onClick={onRetry} busy={retrying}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** Empty (rules.md): one line of what is missing, one action. */
export function EmptyState({ line, action }: { line: ReactNode; action?: ReactNode }) {
  return (
    <div className="ds-empty">
      <p className="ds-empty-line">{line}</p>
      {action}
    </div>
  )
}

/**
 * Saved (rules.md): confirmed on the line where it happened, with an optional
 * Undo. role="status" so a screen reader hears it.
 */
export function SavedLine({ children, onUndo }: { children: ReactNode; onUndo?: () => void }) {
  return (
    <span className="ds-saved-line" role="status">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
      {onUndo && (
        <button type="button" className="ds-link ds-undo" onClick={onUndo}>
          Undo
        </button>
      )}
    </span>
  )
}

/** A callout with a bold lead-in and an optional dark action (look.md section 8). */
export function Callout({
  lead,
  children,
  action,
  tone = 'warn',
}: {
  lead?: string
  children: ReactNode
  action?: ReactNode
  tone?: 'warn' | 'info'
}) {
  return (
    <div className={`ds-callout${tone === 'info' ? ' ds-callout--info' : ''}`}>
      <span style={{ flex: 1, minWidth: 180 }}>
        {lead && <strong>{lead} </strong>}
        {children}
      </span>
      {action}
    </div>
  )
}
