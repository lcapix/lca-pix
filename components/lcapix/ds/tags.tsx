import type { ReactNode } from 'react'
import { FLAG_WORD, FLOW_STATUS_WORD, SOURCE_WORD, type FlagKind, type FlowStatus, type SourceKind } from '@/lib/ui/words'

/** A factor's, rate's or value's source: one of the five words, never colour alone. */
export function SourceTag({ kind }: { kind: SourceKind }) {
  return <span className={`ds-tag ds-tag--${kind}`}>{SOURCE_WORD[kind]}</span>
}

/** A source name with its tag 2px below (look.md section 7). */
export function SourceLine({ name, kind }: { name: ReactNode; kind: SourceKind }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 13, color: 'var(--ds-text)' }}>{name}</span>
      <span>
        <SourceTag kind={kind} />
      </span>
    </span>
  )
}

const STATUS_CLASS: Record<FlowStatus, string> = {
  counted: 'counted',
  no_factor: 'no-factor',
  needs_amount: 'needs',
  left_out: 'left-out',
}

/** A flow's status, in the design's four words. */
export function FlowStatusPill({ status }: { status: FlowStatus }) {
  return <span className={`ds-status ds-status--${STATUS_CLASS[status]}`}>{FLOW_STATUS_WORD[status]}</span>
}

/** "Saved" / "Unsaved" chip beside a title (look.md section 3). */
export function SaveChip({ saved }: { saved: boolean }) {
  return (
    <span className={`ds-status ds-status--${saved ? 'saved' : 'unsaved'}`}>
      <span className="ds-status-dot" aria-hidden />
      {saved ? 'Saved' : 'Unsaved'}
    </span>
  )
}

/** COMING SOON, IN DEVELOPMENT, BETA, SAMPLE. */
export function Flag({ kind }: { kind: FlagKind }) {
  return <span className={`ds-flag ds-flag--${kind}`}>{FLAG_WORD[kind]}</span>
}

/** The one Coming soon line a screen may carry: the flag and one plain line. */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <p className="ds-soon-line" style={{ margin: 0 }}>
      <Flag kind="soon" />
      <span>{children}</span>
    </p>
  )
}

/** A mono count pill (sidebar, tabs). */
export function CountPill({ n, plain, label }: { n: number; plain?: boolean; label?: string }) {
  return (
    <span className={`ds-count${plain ? ' ds-count--plain' : ''}`} aria-label={label}>
      {n}
    </span>
  )
}
