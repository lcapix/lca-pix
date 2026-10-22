'use client'

// Start your own project (F2.1): the name, the question every case answers
// (functional unit, boundary, method, region), then how to start: from a file (read and checked
// before anything is saved) or empty. Two saves: the project, then its
// question. If the second fails the project still exists, and the page says
// so on the page with a way on, never in a toast.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, ErrorCard } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useShellStore } from '@/lib/shell/use-shell'
import { startEmptyCase } from '@/lib/project/start-empty'

// Only the methods with factors loaded (driver_impact_factors) and the regions
// with their own electricity factors; anything else would quietly read as
// zero or fall back to Global.
const METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'] as const
const REGIONS = [
  { value: 'Global', label: 'Global' },
  { value: 'US', label: 'United States' },
  { value: 'EU', label: 'Europe (EU-27)' },
] as const
const BOUNDARIES = [
  { value: 'cradle-to-gate', label: 'Cradle-to-gate' },
  { value: 'gate-to-gate', label: 'Gate-to-gate' },
  { value: 'cradle-to-grave', label: 'Cradle-to-grave' },
] as const

type Start = 'file' | 'empty'

export function NewProjectForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [functionalUnit, setFunctionalUnit] = useState('')
  const [boundary, setBoundary] = useState<string>('cradle-to-gate')
  const [method, setMethod] = useState<string>('CML 2001')
  const [region, setRegion] = useState<string>('Global')
  const [start, setStart] = useState<Start>('file')
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState<{ projectId: number; cause: string } | null>(null)

  const next = async (projectId: number) => {
    await useShellStore.getState().refresh()
    if (start === 'file') {
      router.push(`/project/${projectId}/import`)
      return
    }
    // Empty: the case is made now, with no steps, and opens on its tree (F2.5).
    try {
      const caseId = await startEmptyCase(projectId)
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
      const res = await apiRequest('/api/projects', { method: 'POST', body: JSON.stringify({ project_name: name.trim(), description: '' }) })
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
          <div className="np-grid">
            <label className="np-field">
              <span className="edu-field-label">Functional unit</span>
              <input className="edu-input" value={functionalUnit} placeholder="e.g. 1 enclosure" maxLength={255} onChange={(e) => setFunctionalUnit(e.target.value)} />
            </label>
            <label className="np-field">
              <span className="edu-field-label">System boundary</span>
              <select className="edu-input" value={boundary} onChange={(e) => setBoundary(e.target.value)}>
                {BOUNDARIES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="np-field">
              <span className="edu-field-label">Method</span>
              <select className="edu-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="np-field">
              <span className="edu-field-label">Region</span>
              <select className="edu-input" value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="np-sub" style={{ margin: '14px 0 0' }}>
            Change them here or when you run.
          </p>
        </section>

        <section className="np-section" aria-labelledby="np-start">
          <h2 id="np-start" className="np-h2">
            How do you want to start?
          </h2>
          <div className="edu-uses" role="radiogroup" aria-labelledby="np-start" style={{ marginTop: 12 }}>
            <label className="edu-use">
              <input type="radio" name="start" checked={start === 'file'} onChange={() => setStart('file')} />
              <span>
                <strong style={{ display: 'block', fontSize: 18 }}>From a file</strong>
                <span style={{ fontSize: 15, color: 'var(--ds-text-2)' }}>
                  A routing, a bill of materials or another plant file. We read it, and you check it before anything is saved.
                </span>
              </span>
            </label>
            <label className="edu-use">
              <input type="radio" name="start" checked={start === 'empty'} onChange={() => setStart('empty')} />
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
