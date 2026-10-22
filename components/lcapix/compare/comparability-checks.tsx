'use client'

// The four comparability checks as tiles (E09, E09b): a verdict tile, then
// method, region, functional unit and run currency, each passing or failing
// with what to do. A failing check names the cases to run again, as links.

import Link from 'next/link'
import type { Comparability } from '@/lib/compare/comparability'

export function ComparabilityChecks({
  result,
  projectId,
  caseName,
}: {
  result: Comparability
  projectId: string
  caseName: (caseId: string) => string
}) {
  const verdict = result.fair
    ? { title: 'Fair to compare', sub: 'All four checks pass' }
    : { title: 'Not comparable yet', sub: `${result.failed} of 4 checks fail` }
  return (
    <section
      aria-label="Comparability checks"
      className="card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        marginBottom: 16,
        padding: 0,
        overflow: 'hidden',
        borderColor: result.fair ? undefined : 'var(--signal-error)',
      }}
    >
      <div style={{ padding: '12px 16px', background: result.fair ? 'var(--surface-raised)' : 'color-mix(in oklab, var(--signal-error) 8%, var(--surface-raised))' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: result.fair ? 'var(--text-primary)' : 'var(--signal-error)' }}>{verdict.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{verdict.sub}</div>
      </div>
      {result.checks.map((c) => (
        <div
          key={c.key}
          style={{
            padding: '12px 16px',
            borderLeft: '1px solid var(--border-subtle)',
            background: c.ok ? undefined : 'color-mix(in oklab, var(--signal-error) 6%, transparent)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 13, fontWeight: 600, color: c.ok ? 'var(--text-primary)' : 'var(--signal-error)' }}>
            <span aria-hidden>{c.ok ? '✓' : '✕'}</span>
            <span>{c.label}</span>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {c.ok ? ' (passes)' : ' (fails)'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.detail}</div>
          {!c.ok && c.caseIds.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {c.caseIds.map((id) => (
                <Link key={id} href={`/project/${projectId}/case/${id}/results`} style={{ fontSize: 12, fontWeight: 600 }}>
                  Open {caseName(id)}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

/** In place of a panel that would compare numbers that are not comparable. */
export function NotComparableNotice({ what }: { what: string }) {
  return (
    <div className="card" role="status" style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{what} shows once every check passes</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Fix the checks above, run the cases again, and the comparison appears here.
      </div>
    </div>
  )
}
