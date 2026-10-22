'use client'

// Cases (E07): the project's cases. Yours first, then everyone else's, each
// with its latest answer (a copy with its change against the Base case).
// Search finds a person or a case.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ErrorCard } from '@/components/lcapix/ds'
import { useShellData } from '@/lib/shell/use-shell'
import { useProjectCases } from '@/lib/project/use-project-cases'
import { answerOf, casesHeader, changeVsBase, matchesSearch, splitCases, type CaseSummary } from '@/lib/project/cases-view'

export function CasesPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const userId = profile?.id ?? -1
  const { data, error, reload } = useProjectCases(projectId)
  const [q, setQ] = useState('')

  const split = useMemo(() => (data ? splitCases(data.cases, userId) : { mine: [], others: [] }), [data, userId])
  if (error) {
    return (
      <div className="np">
        <ErrorCard title="The cases did not load" cause={error} onRetry={reload} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the cases…
      </div>
    )
  }

  const scope = [data.project.lcia_method, data.project.region_code].filter(Boolean).join(' · ') || null
  const base = data.cases.find((c) => c.case_type === 'base')
  const others = split.others.filter((c) => matchesSearch(c, q))
  const mine = split.mine.filter((c) => matchesSearch(c, q))
  const caseHref = (c: CaseSummary) => `/project/${projectId}/case/${c.case_id}`

  return (
    <div className="np pc">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{data.project.project_name}</p>
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            Cases{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              {casesHeader({ all: data.cases.length, mine: split.mine.length, others: split.others.length }, scope)}
            </span>
          </h1>
        </div>
        <label className="pc-search">
          <span className="ds-sr-only">Find a person or case</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} placeholder="Find a person or case" onChange={(e) => setQ(e.target.value)} />
        </label>
        <Link href={`/project/${projectId}/case/new`} className="ds-btn ds-btn--primary">
          + New case
        </Link>
      </header>

      <section aria-labelledby="mine-h">
        <h2 id="mine-h" className="ds-section-label">
          Your cases · {mine.length}
        </h2>
        {mine.length ? (
          <div className="pc-mine">
            {mine.map((c) => (
              <CaseRow key={c.case_id} c={c} base={base} href={caseHref(c)} />
            ))}
          </div>
        ) : (
          <p className="np-sub" style={{ margin: '8px 0 0' }}>
            None yet. <Link className="ds-link" href={`/project/${projectId}/case/new`}>+ New case</Link>
          </p>
        )}
      </section>

      {split.others.length > 0 && (
        <section aria-labelledby="others-h" style={{ marginTop: 26 }}>
          <h2 id="others-h" className="ds-section-label">
            Other members&apos; cases · {split.others.length}
          </h2>
          {others.length ? (
            <div className="pc-mine">
              {others.map((c) => (
                <CaseRow key={c.case_id} c={c} base={base} href={caseHref(c)} by={c.author ?? 'Someone'} />
              ))}
            </div>
          ) : (
            <p className="np-sub" style={{ margin: '8px 0 0' }}>
              Nothing here matches “{q.trim()}”.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function CaseRow({ c, base, href, by }: { c: CaseSummary; base: CaseSummary | undefined; href: string; by?: string }) {
  const answer = answerOf(c)
  const change = c.case_type !== 'base' ? changeVsBase(c, base) : null
  const line = [by, c.description || (c.case_type === 'base' ? 'The base case' : 'A what-if'), c.latest_run ? `Run #${c.latest_run.run_id}` : 'not run yet']
    .filter(Boolean)
    .join(' · ')
  return (
    <Link href={href} className="pc-mine-card ds-focusable">
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 18 }}>{c.case_name}</strong>
        <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>{line}</span>
      </span>
      {change && change !== 'Same' && <span className="pc-change">{change}</span>}
      <span className="ds-mono" style={{ fontSize: 28, fontWeight: 600 }}>
        {answer ?? '–'}
      </span>
    </Link>
  )
}
