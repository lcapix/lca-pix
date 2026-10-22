'use client'

// Cases (E07 pipeline, E07b table): the project's cases. Yours first, each
// with its latest answer (a copy with its change against the Base case); then
// the class's (or the members'), on a board of four columns (Not run yet,
// Run, Written, Ticked as hand-in) or as a table sorted by how far along each
// one is. Each card says what is missing next. Nothing here grades: it says
// what exists. Search finds a person or a case.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, ErrorCard, Segmented } from '@/components/lcapix/ds'
import { useShellData } from '@/lib/shell/use-shell'
import { initialsOf } from '@/lib/home/projects'
import { LMS_NAME } from '@/lib/ui-flags'
import { whenWords } from '@/lib/home/last-case'
import { useProjectCases } from '@/lib/project/use-project-cases'
import {
  answerOf,
  byStage,
  CARD_TAG,
  casesHeader,
  changeVsBase,
  matchesSearch,
  noCaseYet,
  PIPELINE_LABEL,
  segmentsFilled,
  splitCases,
  STAGES,
  type ProgressCase,
} from '@/lib/project/cases-view'

const PER_COLUMN = 2
const TABLE_ROWS = 8
const DOT: Record<string, string> = { not_run: 'ring', run: '#2F7BC0', written: '#8F5B00', handed_in: '#006A44' }

export function CasesPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const userId = profile?.id ?? -1
  const word = profile?.useCase === 'teaching' ? 'student' : 'member'
  const { data, error, reload } = useProjectCases(projectId)
  const [view, setView] = useState<'pipeline' | 'table'>('pipeline')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [allRows, setAllRows] = useState(false)

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
  const missing = noCaseYet(data.members, data.cases)
  const plural = `${word[0].toUpperCase()}${word.slice(1)}s`
  const caseHref = (c: ProgressCase) => `/project/${projectId}/case/${c.case_id}`

  return (
    <div className="np pc">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{data.project.project_name}</p>
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            Cases{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              {casesHeader({ all: data.cases.length, mine: split.mine.length, others: split.others.length }, word, scope)}
            </span>
          </h1>
        </div>
        <label className="pc-search">
          <span className="ds-sr-only">Find a {word} or case</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} placeholder={`Find a ${word} or case`} onChange={(e) => setQ(e.target.value)} />
        </label>
        {split.others.length > 0 && (
          <Segmented
            label="Show the cases as"
            value={view}
            onChange={setView}
            options={[
              { value: 'pipeline', label: 'Pipeline' },
              { value: 'table', label: 'Table' },
            ]}
          />
        )}
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
            {mine.map((c) => {
              const answer = answerOf(c)
              const change = c.case_type !== 'base' ? changeVsBase(c, base) : null
              return (
                <Link key={c.case_id} href={caseHref(c)} className="pc-mine-card ds-focusable">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 18 }}>{c.case_name}</strong>
                    <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
                      {[c.description || (c.case_type === 'base' ? 'The base case' : 'A what-if'), c.latest_run ? `Run #${c.latest_run.run_id}` : 'not run yet'].join(' · ')}
                    </span>
                  </span>
                  {change && change !== 'Same' && <span className="pc-change">{change}</span>}
                  <span className="ds-mono" style={{ fontSize: 28, fontWeight: 600 }}>
                    {answer ?? '–'}
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="np-sub" style={{ margin: '8px 0 0' }}>
            None yet. <Link className="ds-link" href={`/project/${projectId}/case/new`}>+ New case</Link>
          </p>
        )}
      </section>

      {split.others.length > 0 && (
        <section aria-labelledby="others-h" style={{ marginTop: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 id="others-h" className="ds-section-label" style={{ flex: 1 }}>
              {plural}&apos; cases · {split.others.length}
            </h2>
            <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
              What exists in each {word}&apos;s work. No reminders go out{LMS_NAME ? `, and grades stay in ${LMS_NAME}` : ''}.
            </span>
          </div>

          {view === 'pipeline' ? (
            <div className="pc-board">
              {STAGES.map((stage) => {
                const col = others.filter((c) => c.stage === stage)
                const shown = open[stage] ? col : col.slice(0, PER_COLUMN)
                return (
                  <section key={stage} className="pc-col" aria-label={`${PIPELINE_LABEL[stage]}, ${col.length}`}>
                    <h3 className="pc-col-head">
                      <span className="pc-dot" data-ring={DOT[stage] === 'ring' || undefined} style={DOT[stage] === 'ring' ? undefined : { background: DOT[stage] }} aria-hidden />
                      <span style={{ flex: 1 }}>{PIPELINE_LABEL[stage]}</span>
                      <span className="ds-count">{col.length}</span>
                    </h3>
                    {shown.map((c) => (
                      <CaseCard key={c.case_id} c={c} href={caseHref(c)} />
                    ))}
                    {col.length > PER_COLUMN && (
                      <button type="button" className="pc-more" aria-expanded={!!open[stage]} onClick={() => setOpen((o) => ({ ...o, [stage]: !o[stage] }))}>
                        {open[stage] ? 'Show fewer' : `Show ${col.length - PER_COLUMN} more`}
                      </button>
                    )}
                    {stage === 'not_run' && missing > 0 && (
                      <p className="pc-missing">
                        {missing} {missing === 1 ? 'person has' : 'people have'} no case yet ·{' '}
                        <Link className="ds-link" href={`/project/${projectId}/people`}>
                          See People
                        </Link>
                      </p>
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th scope="col">{word[0].toUpperCase() + word.slice(1)}</th>
                    <th scope="col">Case</th>
                    <th scope="col" aria-sort="descending">
                      Stage ↓
                    </th>
                    <th scope="col">Run</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Answer
                    </th>
                    <th scope="col">Hand-in</th>
                  </tr>
                </thead>
                <tbody>
                  {[...others]
                    .sort(byStage)
                    .slice(0, allRows ? undefined : TABLE_ROWS)
                    .map((c) => (
                      <tr key={c.case_id}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <span className="pc-avatar" aria-hidden>
                              {initialsOf(c.author ?? '?')}
                            </span>
                            <strong>{c.author ?? 'Someone'}</strong>
                          </span>
                        </td>
                        <td>
                          <Link className="ds-link" href={caseHref(c)} style={{ color: 'var(--ds-text)' }}>
                            {c.case_name}
                          </Link>
                        </td>
                        <td>
                          <span className="pc-stage">
                            <span className="pc-dot" data-ring={DOT[c.stage] === 'ring' || undefined} style={DOT[c.stage] === 'ring' ? undefined : { background: DOT[c.stage] }} aria-hidden />
                            {PIPELINE_LABEL[c.stage]}
                          </span>
                        </td>
                        <td className="ds-mono">{c.latest_run ? `#${c.latest_run.run_id}` : <span style={{ color: 'var(--ds-text-2)' }}>No run</span>}</td>
                        <td className="ds-mono" style={{ textAlign: 'right' }}>
                          {answerOf(c) ?? <span style={{ color: 'var(--ds-text-2)' }}>None yet</span>}
                        </td>
                        <td>{c.stage === 'handed_in' ? <span style={{ color: 'var(--ds-green)', fontWeight: 600 }}>✓ Ticked</span> : 'Not ticked'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="pc-table-foot">
                <span>
                  Showing {Math.min(others.length, allRows ? others.length : TABLE_ROWS)} of {others.length}
                </span>
                {missing > 0 && (
                  <span>
                    {missing} {missing === 1 ? 'person has' : 'people have'} no case yet ·{' '}
                    <Link className="ds-link" href={`/project/${projectId}/people`}>
                      See People
                    </Link>
                  </span>
                )}
                <span style={{ flex: 1 }} />
                {others.length > TABLE_ROWS && (
                  <Button size="small" onClick={() => setAllRows((v) => !v)}>
                    {allRows ? 'Show fewer' : `Show all ${others.length}`}
                  </Button>
                )}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function CaseCard({ c, href }: { c: ProgressCase; href: string }) {
  const tag = CARD_TAG[c.stage]
  const answer = answerOf(c)
  const filled = segmentsFilled(c.stage)
  return (
    <Link href={href} className="pc-card ds-focusable">
      <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span className="pc-avatar" aria-hidden>
          {initialsOf(c.author ?? '?')}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 16 }}>{c.author ?? 'Someone'}</strong>
          <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
            {c.case_name} · {c.latest_run ? <span className="ds-mono">Run #{c.latest_run.run_id}</span> : c.created_at ? `copied ${whenWords(c.created_at)}` : 'not run yet'}
          </span>
        </span>
        {answer && (
          <span className="ds-mono" style={{ fontWeight: 600 }}>
            {answer}
          </span>
        )}
      </span>
      <span className="pc-segs" aria-label={`${filled} of 4 stages reached`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} data-on={i < filled || undefined} />
        ))}
      </span>
      <span className={`pc-tag pc-tag--${tag.tone}`}>{tag.text}</span>
    </Link>
  )
}
