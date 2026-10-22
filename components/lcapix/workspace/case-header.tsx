'use client'

// The case header (behaviour spec "Inside a case", E03, E03c): the case name,
// its facts line, a warning line when flows are left out, the Case switcher,
// and the one primary: Run Assessment, or Make my own copy on the read-only
// sample. While a run is going: "Running… N s".

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { makeOwnCopy } from '@/lib/workspace/make-copy'
import { Button, ErrorCard } from '@/components/lcapix/ds'
import { ACCESS_WORD } from '@/lib/ui/words'
import type { WorkspaceCase, WorkspaceInventory } from '@/lib/workspace/use-workspace'
import { amount as fmtAmount } from '@/lib/ui/format'

export function caseFacts(k: WorkspaceCase, inv: WorkspaceInventory | null, noSteps = false): string {
  const kind =
    k.case_type === 'base'
      ? 'Base case'
      : k.copied_from
        ? `Copy of the ${k.copied_from.case_name}`
        : 'Comparative case'
  // The case's reference flow; without one, the study's functional unit ("1 bike frame").
  const unit = k.reference_flow_unit
    ? `${fmtAmount(k.reference_flow ?? 1)} ${k.reference_flow_unit}`
    : k.project_functional_unit?.trim() || `${fmtAmount(k.reference_flow ?? 1)} unit`
  const scope = inv ? `${inv.method} · ${inv.region}` : k.project_lcia_method ?? ''
  const run = inv?.latest_run ? `Run #${inv.latest_run.run_id}` : noSteps ? 'no steps yet' : 'not run yet'
  return [kind, unit, scope, run, k.read_only ? 'Sample, read-only' : null].filter(Boolean).join(' · ')
}

/** "2 flows have no amount. They are left out of a run." / "1 flow is left out: its unit can't convert." */
export function warnLine(counts: WorkspaceInventory['counts'] | null | undefined): string | null {
  if (!counts) return null
  const parts: string[] = []
  if (counts.needs_amount) {
    parts.push(
      counts.needs_amount === 1
        ? '1 flow has no amount.'
        : `${counts.needs_amount} flows have no amount.`,
    )
  }
  if (counts.left_out) {
    parts.push(counts.left_out === 1 ? "1 flow's unit can't convert." : `${counts.left_out} flows' units can't convert.`)
  }
  if (!parts.length) return null
  const n = counts.needs_amount + counts.left_out
  return `${parts.join(' ')} ${n === 1 ? 'It is' : 'They are'} left out of a run.`
}

export function CaseHeader({
  kase,
  inventory,
  siblings,
  readOnly,
  canRun,
  ownName,
  onRun,
  running,
  runSeconds,
  runError,
  quiet = false,
  runReason = 'Add a counted flow first',
  noSteps = false,
}: {
  kase: WorkspaceCase
  inventory: WorkspaceInventory | null
  siblings: Array<{ case_id: number; case_name: string; case_type: string }>
  readOnly: boolean
  canRun: boolean
  /** The person's name, for "Elena Rivera's case". */
  ownName: string | null
  onRun: () => void
  running: boolean
  runSeconds: number
  runError: string | null
  /** Results and Write-up hold the screen's primary: the run button steps back. */
  quiet?: boolean
  /** Why Run is off ("Add a step first" on an empty case). */
  runReason?: string
  noSteps?: boolean
}) {
  const router = useRouter()
  const warn = warnLine(inventory?.counts)
  const [copying, setCopying] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const makeCopy = async () => {
    setCopying(true)
    setCopyError(null)
    try {
      const id = await makeOwnCopy(kase.case_id, ownName)
      router.push(`/project/${kase.project_id}/case/${id}`)
    } catch (e: any) {
      setCopyError(e?.message ?? 'the copy failed')
      setCopying(false)
    }
  }

  return (
    <>
      <header className="ws-header">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="ds-title">{kase.case_name}</h1>
          <div className="ws-facts">{caseFacts(kase, inventory, noSteps)}</div>
          {warn && (
            <div className="ws-warnline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 4 2.5 20h19z" strokeLinejoin="round" />
                <path d="M12 10v4.5M12 17.5v.5" strokeLinecap="round" />
              </svg>
              {warn}
            </div>
          )}
        </div>
        <CaseSwitcher kase={kase} siblings={siblings} />
        {/* A copy is a new case: it needs Can change, so someone who can only read is told so instead. */}
        {kase.read_only && kase.project_role !== 'viewer' ? (
          <Button variant="primary" onClick={makeCopy} busy={copying}>
            Make my own copy
          </Button>
        ) : readOnly ? (
          <span className="ds-status ds-status--no-factor">{ACCESS_WORD.viewer}</span>
        ) : running ? (
          <span className="ws-running" role="status" aria-live="polite">
            <span className="ds-spinner" aria-hidden />
            Running… <span className="ds-mono">{runSeconds} s</span>
          </span>
        ) : (
          <Button
            variant={quiet ? 'secondary' : 'primary'}
            onClick={onRun}
            disabled={!canRun}
            disabledReason={canRun ? undefined : runReason}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
            }
          >
            Run Assessment
          </Button>
        )}
      </header>
      {(runError || copyError) && (
        <div style={{ padding: '12px 24px 0' }}>
          <ErrorCard
            title={runError ? 'The run did not finish' : 'The copy was not made'}
            cause={runError ?? copyError}
            fix={runError ? 'Nothing was saved from it. Check the flows, then run again.' : undefined}
            onRetry={runError ? onRun : makeCopy}
          />
        </div>
      )}
    </>
  )
}

/** "Case ▾": the project's cases; search above 8; changing case keeps the tab. */
function CaseSwitcher({
  kase,
  siblings,
}: {
  kase: WorkspaceCase
  siblings: Array<{ case_id: number; case_name: string; case_type: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const list = siblings.filter((s) => !q || s.case_name.toLowerCase().includes(q.toLowerCase()))
  const go = (id: number) => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    setOpen(false)
    router.push(`/project/${kase.project_id}/case/${id}${tab ? `?tab=${tab}` : ''}`)
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="ws-switch-btn ds-focusable" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span style={{ color: 'var(--ds-text-2)' }}>Case</span>
        <span className="name">{kase.case_name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="ws-menu" role="menu" style={{ right: 0, top: 46, width: 300 }}>
          {siblings.length > 8 && (
            <input
              className="ds-input"
              style={{ width: '100%', marginBottom: 6 }}
              placeholder="Find a case"
              aria-label="Find a case"
              value={q}
              autoFocus
              onChange={(e) => setQ(e.target.value)}
            />
          )}
          {list.map((s) => (
            <button
              key={s.case_id}
              type="button"
              role="menuitemradio"
              aria-checked={s.case_id === kase.case_id}
              onClick={() => go(s.case_id)}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.case_name}</span>
              {s.case_type === 'base' && <span className="ds-option-meta">Base</span>}
            </button>
          ))}
          {!list.length && <p style={{ fontSize: 13, color: 'var(--ds-text-3)', margin: '8px 12px' }}>No case matches.</p>}
        </div>
      )}
    </div>
  )
}
