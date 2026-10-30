'use client'

// Start your own project (F2.1): the name, the question every case answers
// (functional unit, boundary, method, region; the method and region default
// to the sample study's), then how to start: from a file (read and checked
// before anything is saved) or empty. Two saves: the project, then its
// question. If the second fails the project still exists, and the page says
// so on the page with a way on, never in a toast.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, ErrorCard } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useShellData, useShellStore } from '@/lib/shell/use-shell'
import { startEmptyCase } from '@/lib/project/start-empty'
import { BOUNDARIES, METHODS, REGIONS } from '@/lib/project/study-options'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { HelpTip } from '@/components/lcapix/workspace/help-tip'


type Start = 'file' | 'empty'

// P112: classic's rail, word for word.
const FIVE_PHASES = [
  { title: 'Goal & scope', description: "You're here. Name the study and choose its boundaries." },
  { title: 'Inventory', description: 'List inputs and outputs across every stage.' },
  { title: 'Impact', description: 'Convert flows into category scores.' },
  { title: 'Interpretation', description: 'Sensitivity, contribution, and uncertainty checks.' },
  { title: 'Report', description: 'Defensible record of method and result.' },
]
// P111: classic's help for the method and the region.
const METHOD_HELP =
  'The impact-assessment method: the set of characterization factors that turns inputs and outputs into impact scores. CML 2001 (Leiden University) is common in Europe, TRACI 2.1 is the US EPA method, and ReCiPe Midpoint (H) uses the default "hierarchist" perspective. You can still choose the method each time you run an assessment; keep one method for every case you compare.'
const REGION_HELP =
  'Where the product is made, part of the study\'s scope. Runs use it by default, and each case can be run for another region to compare. Today only electricity has region-specific factors (US: EPA eGRID, EU: Ember, Global: Ember); everything else uses the Global factor, marked "Global (fallback)" in the results.'

export function NewProjectForm() {
  const router = useRouter()
  const { projects } = useShellData()
  const sample = projects.find((p) => p.is_sample)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [functionalUnit, setFunctionalUnit] = useState('')
  const [boundary, setBoundary] = useState<string>('cradle-to-gate')
  const [method, setMethod] = useState<string>('CML 2001')
  const [region, setRegion] = useState<string>('Global')
  const [fromSample, setFromSample] = useState(false)
  const [start, setStart] = useState<Start>('file')
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState<{ projectId: number; cause: string } | null>(null)

  // The sample study's method and region, as the defaults (F2.1).
  const sampleId = sample?.project_id
  useEffect(() => {
    if (!sampleId) return
    let live = true
    apiRequest(`/api/projects/${sampleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d?.project
        if (!live || !p) return
        if ((METHODS as readonly string[]).includes(p.lcia_method)) setMethod(p.lcia_method)
        if (REGIONS.some((r) => r.value === p.region_code)) setRegion(p.region_code)
        setFromSample(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [sampleId])

  const next = async (projectId: number) => {
    if (start === 'file') {
      await useShellStore.getState().refresh()
      // P87: the first file of a new project gets the guided banner.
      router.push(`/project/${projectId}/import?first=1`)
      return
    }
    // Empty: the case is made now, with no steps, and opens on its tree (F2.5).
    try {
      const caseId = await startEmptyCase(projectId)
      // 1.9: after the case exists, so the sidebar counts it without a reload.
      await useShellStore.getState().refresh()
      router.push(`/project/${projectId}/case/${caseId}`)
    } catch (e: any) {
      setError(`The project was made, but its first case was not: ${e?.message ?? 'the request failed'}.`)
      setPartial({ projectId, cause: '' })
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Give the project a name.')
      return
    }
    setNameError(null)
    setError(null)
    setBusy(true)
    try {
      const res = await apiRequest('/api/projects', { method: 'POST', body: JSON.stringify({ project_name: name.trim(), description: goal.trim() }) })
      const data = await res.json().catch(() => ({}))
      const projectId = Number(data?.project?.project_id ?? data?.project_id)
      if (!res.ok || !projectId) {
        if (res.status === 409) setNameError(data?.error ?? 'You already have a project with that name.')
        else setError(data?.error ?? `The project was not made (${res.status}).`)
        return
      }
      // The question is study-level (ISO 14044 4.2): saved onto the new project.
      let cause: string | null = null
      try {
        const put = await apiRequest(`/api/projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...(functionalUnit.trim() ? { functional_unit: functionalUnit.trim(), system_boundary: boundary } : {}),
            goal_statement: goal.trim(),
            lcia_method: method,
            region_code: region,
          }),
        })
        if (!put.ok) cause = (await put.json().catch(() => ({})))?.error ?? `error ${put.status}`
      } catch (err: any) {
        cause = err?.message ?? 'network error'
      }
      if (cause) {
        setPartial({ projectId, cause })
        return
      }
      await next(projectId)
    } catch (err: any) {
      setError(err?.message ?? 'The project was not made.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="np">
      <header className="np-head">
        <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
          <Link href="/home" className="ds-link" style={{ color: 'inherit' }}>
            Projects
          </Link>{' '}
          · New project
        </nav>
        <h1 className="ds-title" style={{ margin: '4px 0 0' }}>
          Start your own project
        </h1>
      </header>

      <form className="np-card" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        <section className="np-section">
          <label htmlFor="np-name" className="edu-field-label">
            Project name <span className="np-req">Required</span>
          </label>
          <input
            id="np-name"
            className="edu-input"
            value={name}
            maxLength={100}
            autoFocus
            aria-invalid={!!nameError || undefined}
            aria-describedby={nameError ? 'np-name-error' : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {nameError && (
            <span id="np-name-error" className="edu-error" role="alert" style={{ marginTop: 8 }}>
              {nameError}
            </span>
          )}
        </section>

        <section className="np-section" aria-labelledby="np-q">
          <h2 id="np-q" className="np-h2">
            The question
          </h2>
          <p className="np-sub">Every case in this project answers it for the same one unit.</p>
          {/* P112: the five phases you will work through, as classic named them. */}
          <span className="ds-section-label" id="np-phases-h">
            The five phases you&apos;ll work through
          </span>
          <ol aria-labelledby="np-phases-h" className="np-rail">
            {FIVE_PHASES.map((p, i) => (
              <li key={p.title} data-here={i === 0 || undefined}>
                <strong>
                  {i + 1}. {p.title}
                </strong>
                <span>{p.description}</span>
              </li>
            ))}
          </ol>
          <label className="np-field" style={{ display: 'block', marginBottom: 12 }}>
            <span className="edu-field-label">
              Goal of the study<HelpTip label="What goes in the goal?">{ISO_HELP.goal}</HelpTip>
            </span>
            <textarea className="edu-input" value={goal} maxLength={2000} rows={3} aria-label="Goal of the study" onChange={(e) => setGoal(e.target.value)} />
          </label>
          <div className="np-grid">
            <label className="np-field">
              <span className="edu-field-label">
                Functional unit<HelpTip label="What is a functional unit?">{ISO_HELP.functionalUnit}</HelpTip>
              </span>
              <input className="edu-input" aria-label="Functional unit" value={functionalUnit} placeholder="e.g. 1 enclosure" maxLength={255} onChange={(e) => setFunctionalUnit(e.target.value)} />
            </label>
            <label className="np-field">
              <span className="edu-field-label">
                System boundary<HelpTip label="What is a system boundary?">{ISO_HELP.systemBoundary}</HelpTip>
              </span>
              <select className="edu-input" aria-label="System boundary" value={boundary} onChange={(e) => setBoundary(e.target.value)}>
                {BOUNDARIES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="np-field">
              <span className="edu-field-label">
                Method<HelpTip label="What is a methodology?">{METHOD_HELP}</HelpTip>
              </span>
              <select className="edu-input" aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="np-field">
              <span className="edu-field-label">
                Region<HelpTip label="What does the regional context do?">{REGION_HELP}</HelpTip>
              </span>
              <select className="edu-input" aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="np-sub" style={{ margin: '14px 0 0' }}>
            {fromSample ? 'Same method and region as the sample study. ' : ''}Change them here or when you run.
          </p>
        </section>

        <section className="np-section" aria-labelledby="np-start">
          <h2 id="np-start" className="np-h2">
            How do you want to start?
          </h2>
          <div className="edu-uses" role="radiogroup" aria-labelledby="np-start" style={{ marginTop: 12 }}>
            <label className="edu-use">
              <input type="radio" name="start" value="file" aria-label="Start from a file" checked={start === 'file'} onChange={() => setStart('file')} />
              <span>
                <strong style={{ display: 'block', fontSize: 18 }}>From a file</strong>
                <span style={{ fontSize: 15, color: 'var(--ds-text-2)' }}>
                  A routing, a bill of materials or another plant file. We read it, and you check it before anything is saved.
                </span>
              </span>
            </label>
            <label className="edu-use">
              <input type="radio" name="start" value="empty" aria-label="Start empty" checked={start === 'empty'} onChange={() => setStart('empty')} />
              <span>
                <strong style={{ display: 'block', fontSize: 18 }}>Empty</strong>
                <span style={{ fontSize: 15, color: 'var(--ds-text-2)' }}>An empty case. You add each step and what goes in and comes out yourself.</span>
              </span>
            </label>
          </div>
        </section>

        {(error || partial) && (
          <div style={{ padding: '0 36px 8px' }}>
            {partial?.cause ? (
              <ErrorCard
                title={`"${name.trim()}" was made, but its question was not saved`}
                cause={partial.cause}
                fix="Every run would use CML 2001 and Global, with no functional unit. Set them in the project, or pick the method and region when you run."
              />
            ) : (
              error && <ErrorCard title="Not done" cause={error} />
            )}
            {partial && (
              <span style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <Button variant="dark" onClick={() => next(partial.projectId)}>
                  Continue anyway
                </Button>
                <Link className="ds-link" href={`/project/${partial.projectId}`}>
                  Open the project
                </Link>
              </span>
            )}
          </div>
        )}

        <footer className="np-foot">
          <span style={{ flex: 1, minWidth: 220, fontSize: 15, color: 'var(--ds-text-2)' }}>
            {start === 'file' ? 'Next you add the file. No case is made until you check it and save.' : 'Next you add the first step. The case is made now, empty.'}
          </span>
          <Button onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!!partial}>
            Continue →
          </Button>
        </footer>
      </form>
    </div>
  )
}
