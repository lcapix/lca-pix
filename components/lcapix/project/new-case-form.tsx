'use client'

// New case (E18): one form. A what-if (recommended): copy a case and change
// one thing; the copy keeps every step, flow and step cost, and its runs stay
// with the original. Or a new base case: a tree of its own, started empty or
// from a file. The preview shows what is copied: the tree, its steps and
// flows. Nothing is computed until the new case is run.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, ErrorCard } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useShellData, useShellStore } from '@/lib/shell/use-shell'
import { useProjectCases } from '@/lib/project/use-project-cases'
import { casesHeader } from '@/lib/project/cases-view'
import { perNoun } from '@/lib/compare/compare-view'
import { layoutOnLanes, TIER_COLOURS, TIER_LABEL, type TierLayout } from '@/lib/workspace/tier-layout'

type Kind = 'whatif' | 'base'
type Start = 'empty' | 'file'

export function NewCaseForm() {
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const me = profile?.id ?? -1
  const word = profile?.useCase === 'teaching' ? 'student' : 'member'
  const { data, error, reload } = useProjectCases(projectId)
  const [kind, setKind] = useState<Kind>('whatif')
  const [start, setStart] = useState<Start>('empty')
  const [sourceId, setSourceId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [change, setChange] = useState('')
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Copy from: the asked-for case, else the base case; base cases first, then yours, then the rest.
  const sources = useMemo(() => {
    if (!data) return []
    const rank = (c: (typeof data.cases)[number]) => (c.case_type === 'base' ? 0 : c.created_by === me ? 1 : 2)
    return [...data.cases].sort((a, b) => rank(a) - rank(b) || a.case_id - b.case_id)
  }, [data, me])
  useEffect(() => {
    if (sourceId != null || !sources.length) return
    const asked = Number(search?.get('from'))
    setSourceId((sources.find((c) => c.case_id === asked) ?? sources[0]).case_id)
  }, [sources, sourceId, search])
  useEffect(() => {
    if (data && !sources.length) setKind('base')
  }, [data, sources.length])

  const source = sources.find((c) => c.case_id === sourceId) ?? null
  const layout = useSourceTree(kind === 'whatif' ? sourceId : null)

  if (error) {
    return (
      <div className="np">
        <ErrorCard title="The project did not load" cause={error} onRetry={reload} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the project…
      </div>
    )
  }

  const readOnly = data.project.my_role === 'viewer'
  const mine = data.cases.filter((c) => c.created_by === me).length
  const scope = [data.project.lcia_method, data.project.region_code].filter(Boolean).join(' · ') || null
  const fu = data.project.functional_unit
  const others = (c: { created_by: number | null; author: string | null }) => (c.created_by !== me && c.author ? ` (${c.author})` : '')
  const toFile = kind === 'base' && start === 'file'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (toFile) return router.push(`/project/${projectId}/import`)
    const caseName = name.trim()
    if (!caseName) return setNameError('Name the case first.')
    setBusy(true)
    setNameError(null)
    setFormError(null)
    try {
      const body: Record<string, string> = { case_name: caseName }
      if (change.trim()) body.description = change.trim()
      const res =
        kind === 'whatif'
          ? await apiRequest(`/api/cases/${sourceId}/duplicate`, { method: 'POST', body: JSON.stringify(body) })
          : await apiRequest(`/api/projects/${projectId}/cases`, { method: 'POST', body: JSON.stringify({ ...body, case_type: 'base' }) })
      const d = await res.json().catch(() => ({}))
      if (res.status === 409) return setNameError(d?.error ?? 'This project already has a case with that name.')
      if (res.status === 403) return setFormError('You can read this project but not make cases in it. Its owner can give you Can change.')
      if (!res.ok) return setFormError(d?.error ?? `The case was not made (${res.status}).`)
      const id = Number(d.case_id ?? d.case?.case_id)
      void useShellStore.getState().refresh()
      router.push(`/project/${projectId}/case/${id}`)
    } catch (err: any) {
      setFormError(err?.message ?? 'The case was not made.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="np pc">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>
            <Link className="ds-link" style={{ color: 'inherit' }} href={`/project/${projectId}/cases`}>
              {data.project.project_name} · Cases
            </Link>
          </p>
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            New case{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              {casesHeader({ all: data.cases.length, mine, others: data.cases.length - mine }, word, scope)}
            </span>
          </h1>
        </div>
      </header>

      <form className="nc-card" onSubmit={submit} noValidate>
        <fieldset className="nc-section" disabled={readOnly}>
          <legend className="nc-legend">
            <span className="pp-card-h" style={{ fontSize: 20, display: 'block' }}>
              What kind of case?
            </span>
            <span style={{ fontSize: 15, color: 'var(--ds-text-2)' }}>Every case in this project answers the same question for {fu ?? 'one functional unit'}.</span>
          </legend>
          {readOnly && (
            <p role="note" className="pp-alert" style={{ marginTop: 10 }}>
              You can read this project but not make cases in it. Its owner can give you Can change.
            </p>
          )}

          <div className="nc-option" data-on={kind === 'whatif' || undefined}>
            <label className="nc-option-head">
              <input type="radio" name="kind" checked={kind === 'whatif'} disabled={!sources.length} onChange={() => setKind('whatif')} />
              <span style={{ flex: 1 }}>
                <strong>A what-if: copy a case and change one thing</strong>
                <span>The copy keeps every step and flow. Change one, run it, and compare the two answers.</span>
              </span>
              <span className="nc-rec">Recommended</span>
            </label>
            {kind === 'whatif' && source && (
              <div className="nc-from">
                <label style={{ display: 'grid', gap: 8, flex: '1 1 300px' }}>
                  <span className="edu-field-label">Copy from</span>
                  <select className="ds-input rp-select" value={sourceId ?? ''} onChange={(e) => setSourceId(Number(e.target.value))}>
                    {sources.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_name}
                        {others(c)} · {c.latest_run ? `Run #${c.latest_run.run_id}` : 'not run yet'}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="nc-info">
                  <span aria-hidden>ⓘ</span> Runs are not copied. Your first answer comes from your own run.
                </p>
              </div>
            )}
          </div>

          <div className="nc-option" data-on={kind === 'base' || undefined}>
            <label className="nc-option-head">
              <input type="radio" name="kind" checked={kind === 'base'} onChange={() => setKind('base')} />
              <span style={{ flex: 1 }}>
                <strong>A new base case</strong>
                <span>A tree of its own, for a different way of making {fu ? `the ${perNoun(fu)}` : 'the product'}.</span>
                <span style={{ fontSize: 14 }}>Starts from a file or empty. Pick this to choose which.</span>
              </span>
            </label>
            {kind === 'base' && (
              <div className="nc-start" role="radiogroup" aria-label="How the new base case starts">
                <label>
                  <input type="radio" name="start" checked={start === 'empty'} onChange={() => setStart('empty')} />
                  <span>
                    <strong>Empty</strong> Build the tree step by step.
                  </span>
                </label>
                <label>
                  <input type="radio" name="start" checked={start === 'file'} onChange={() => setStart('file')} />
                  <span>
                    <strong>From a file</strong> A routing, a bill of materials or an equipment list.
                  </span>
                </label>
              </div>
            )}
          </div>
        </fieldset>

        {!toFile && (
          <fieldset className="nc-section nc-names" disabled={readOnly}>
            <legend className="ds-sr-only">Name and change</legend>
            <label className="nc-field">
              <span className="edu-field-label">Case name</span>
              <input
                className="ds-input rp-select"
                value={name}
                maxLength={255}
                placeholder={kind === 'whatif' ? 'e.g. Lighter blank' : 'e.g. Cast bracket'}
                aria-invalid={!!nameError || undefined}
                aria-describedby="nc-name-help"
                onChange={(e) => (setName(e.target.value), setNameError(null))}
              />
              <span id="nc-name-help" className={nameError ? 'nc-error' : 'nc-help'} role={nameError ? 'alert' : undefined}>
                {nameError ?? (kind === 'whatif' ? 'Name it after the change you will make.' : 'Name it after the way of making it.')}
              </span>
            </label>
            <label className="nc-field">
              <span className="edu-field-label">
                {kind === 'whatif' ? 'What will you change?' : 'What is different?'}{' '}
                <span style={{ fontWeight: 400, color: 'var(--ds-text-2)' }}>Optional</span>
              </span>
              <input
                className="ds-input rp-select"
                value={change}
                maxLength={500}
                placeholder={kind === 'whatif' ? 'e.g. Steel blank from 0.80 kg to 0.78 kg' : 'e.g. Cast instead of cut and welded'}
                aria-describedby="nc-change-help"
                onChange={(e) => setChange(e.target.value)}
              />
              <span id="nc-change-help" className="nc-help">
                One line, kept as the case description.
              </span>
            </label>
          </fieldset>
        )}

        {kind === 'whatif' && source && (
          <section className="nc-section" aria-labelledby="nc-copy-h">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <h2 id="nc-copy-h" className="pp-card-h" style={{ fontSize: 20 }}>
                What you copy
              </h2>
              <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>A preview of {source.case_name}. Nothing changes in it.</span>
            </div>
            <div className="nc-preview">
              <MiniTree layout={layout} name={source.case_name} />
              <div className="nc-facts">
                <strong style={{ fontSize: 20 }}>{source.case_name}</strong>
                <span style={{ color: 'var(--ds-text-2)' }}>{[fu, scope].filter(Boolean).join(' · ')}</span>
                <span className="nc-counts">
                  <span>
                    <b className="ds-mono">{source.steps}</b> {source.steps === 1 ? 'step' : 'steps'}
                  </span>
                  <span>
                    <b className="ds-mono">{source.flows}</b> {source.flows === 1 ? 'flow' : 'flows'}
                  </span>
                </span>
                <ul className="nc-come">
                  <li>
                    <span aria-hidden>✓</span> Steps, flows and step costs come along
                  </li>
                  <li data-no>
                    <span aria-hidden>✕</span> {source.latest_run ? `Run #${source.latest_run.run_id} stays with ${source.case_name}` : `${source.case_name} has no run yet; nothing to leave behind`}
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        <div className="nc-foot">
          <span style={{ flex: 1, fontSize: 15, color: 'var(--ds-text-2)' }}>
            {toFile ? 'Opens Add a file. The case is made when you save what we read.' : 'Opens the new case on its Tree. Nothing is computed until you run it.'}
          </span>
          {formError && (
            <span role="alert" className="pp-alert" style={{ margin: 0, flexBasis: '100%' }}>
              {formError}
            </span>
          )}
          <Link className="ds-btn" href={`/project/${projectId}/cases`}>
            Cancel
          </Link>
          <Button type="submit" variant="primary" busy={busy} disabled={readOnly}>
            {toFile ? 'Choose the file' : 'Make the case'} →
          </Button>
        </div>
      </form>
    </div>
  )
}

/** The source case's steps, laid out on the five tier lanes, for the preview. */
function useSourceTree(caseId: number | null): TierLayout | null {
  const [layout, setLayout] = useState<TierLayout | null>(null)
  useEffect(() => {
    setLayout(null)
    if (!caseId) return
    let live = true
    void apiRequest(`/api/cases/${caseId}/components`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return
        const steps = (d.components ?? []).map((c: any) => ({
          id: Number(c.component_id),
          parentId: c.parent_component_id == null ? null : Number(c.parent_component_id),
          type: c.component_type,
          level: c.hierarchy_level,
        }))
        setLayout(steps.length ? layoutOnLanes(steps) : null)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [caseId])
  return layout
}

const LABEL_W = 230

function MiniTree({ layout, name }: { layout: TierLayout | null; name: string }) {
  if (!layout) {
    return (
      <div className="nc-tree" role="status" style={{ display: 'grid', placeItems: 'center', color: 'var(--ds-text-2)', fontSize: 14 }}>
        Drawing the tree…
      </div>
    )
  }
  const w = layout.width + LABEL_W
  return (
    <svg className="nc-tree" viewBox={`0 0 ${w} ${layout.height}`} role="img" aria-label={`The tree of ${name}: ${layout.steps.length} steps on five tiers`}>
      {layout.lanes.map((l, i) => (
        <g key={l.tier}>
          {i % 2 === 1 && <rect x={0} y={l.y} width={w} height={l.h} fill="#f3f5f3" />}
          <rect x={20} y={l.y + l.h / 2 - 9} width={18} height={18} rx={4} fill={TIER_COLOURS[l.tier].fill} stroke={TIER_COLOURS[l.tier].border} strokeWidth={2} />
          <text x={50} y={l.y + l.h / 2 + 8} className="nc-lane">
            {TIER_LABEL[l.tier].toUpperCase()}
          </text>
        </g>
      ))}
      <g transform={`translate(${LABEL_W} 0)`}>
        {layout.edges.map((e) => (
          <path key={`${e.from}-${e.to}`} d={e.path} fill="none" stroke="#9aa29d" strokeWidth={3} />
        ))}
        {layout.steps.map((s) => (
          <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={14} fill={TIER_COLOURS[s.tier].fill} stroke={TIER_COLOURS[s.tier].border} strokeWidth={3} />
        ))}
      </g>
    </svg>
  )
}
