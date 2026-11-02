'use client'

// Saved (F2.4, F1): what was saved and where, the file kept with the case,
// Where this case stands (six rows, read fresh from the case), and always one
// primary button for what is next: the next file while one is missing, else
// Run the case (it runs, then opens the results). Goal and scope can be set
// right here when it is not. Held lines link to where they are fixed, and a
// stage the import set says so. With Guided mode on, a short walk through
// what to add next.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Flag } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { BOUNDARIES } from '@/lib/project/study-options'
import { caseStands, nextFile, type StandsRow } from '@/lib/import/case-stands'
import type { ApplyResult } from '@/lib/import/done-summary'
import { materialsStageNote } from '@/lib/import/stages'

export function DoneCard({
  projectId,
  applied,
  fileName,
  readByAi,
  caseName,
  connector,
  onAddAnother,
  onOpenCase,
  onStartNew,
}: {
  projectId: string
  applied: ApplyResult & { held_details?: unknown; stages_set?: Array<{ name: string; stage: string }>; steps_created?: number }
  fileName: string | null
  readByAi: boolean
  /** The case's name, when the answer does not carry it (adding to a case). */
  caseName?: string | null
  /** The kind of file just saved. */
  connector: string
  /** Continue this case with the next file, of this kind. */
  onAddAnother: (connector: string) => void
  onOpenCase: () => void
  onStartNew: () => void
}) {
  const router = useRouter()
  const [guided] = useGuidedMode()
  const [rows, setRows] = useState<StandsRow[] | null>(null)
  const [project, setProject] = useState<{ functional_unit: string | null; system_boundary: string | null; lcia_method: string | null; region_code: string | null } | null>(null)
  // A read that never answers (offline, a dropped connection) must not leave
  // "Reading the case…" up for good.
  const [unread, setUnread] = useState(false)
  const [tick, setTick] = useState(0)
  const caseId = applied.case_id
  useEffect(() => {
    if (!caseId) return
    let live = true
    Promise.all([
      apiRequest(`/api/projects/${projectId}`).then((r) => (r.ok ? r.json() : null)),
      apiRequest(`/api/cases/${caseId}/components`).then((r) => (r.ok ? r.json() : null)),
      apiRequest(`/api/cases/${caseId}/completeness`).then((r) => (r.ok ? r.json() : null)),
      apiRequest(`/api/cases/${caseId}/inventory`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([p, c, comp, inv]) => {
        if (!live) return
        const pj = {
          functional_unit: p?.project?.functional_unit ?? null,
          system_boundary: p?.project?.system_boundary ?? null,
          lcia_method: p?.project?.lcia_method ?? null,
          region_code: p?.project?.region_code ?? null,
        }
        setProject(pj)
        setRows(
          caseStands({
            project: pj,
            steps: ((c?.components ?? []) as any[]).map((x) => ({
              name: x.component_name ?? x.name,
              type: x.component_type ?? x.type,
              labor_hours: x.labor_hours == null ? null : Number(x.labor_hours),
            })),
            layers: comp?.report?.present ?? [],
            latestRunId: inv?.latest_run?.run_id ?? null,
          }),
        )
      })
      .catch(() => {
        if (live) setUnread(true)
      })
    return () => {
      live = false
    }
  }, [projectId, caseId, tick])

  // Run the case: the study's method and region (the server's defaults), then its results.
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const runCase = useCallback(async () => {
    if (!caseId || running) return
    setRunning(true)
    setRunError(null)
    try {
      const res = await apiRequest(`/api/cases/${caseId}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          calculation_method: project?.lcia_method || undefined,
          region_code: project?.region_code || undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `the run answered ${res.status}`)
      router.push(`/project/${projectId}/case/${caseId}?tab=results`)
    } catch (e: any) {
      setRunError(`The case did not run: ${e?.message ?? 'the request failed'}. It is saved; open it and run it from there.`)
      setRunning(false)
    }
  }, [caseId, running, project, projectId, router])

  const next = rows ? nextFile(rows) : null
  // The tree's own count (the Tree row), so the two numbers agree (F4).
  const treeSteps = rows?.find((r) => r.key === 'tree')?.value ?? null
  const steps = applied.components_created ?? 0
  const what = applied.appended
    ? `${applied.flows_applied ?? 0} ${applied.flows_applied === 1 ? 'line is' : 'lines are'} in ${applied.case_name ?? caseName ?? 'the case'}${
        applied.steps_created ? `, with ${applied.steps_created} new ${applied.steps_created === 1 ? 'step' : 'steps'}` : ''
      }`
    : `${steps} ${steps === 1 ? 'step is' : 'steps are'} in ${applied.case_name ?? 'the new case'}`
  const heldLines = Array.isArray(applied.held_details) ? applied.held_details.map((x) => String(x)) : []
  const heldHref = caseId ? `/project/${projectId}/case/${caseId}?tab=inventory#held-lines` : null
  const stageNote = materialsStageNote(applied.stages_set ?? [])

  return (
    <div className="ip-done">
      <div className="ip-done-main">
        <div className="np-card" style={{ maxWidth: 'none' }}>
          <div className="ip-done-head">
            <span className="ip-done-tick" aria-hidden>
              ✓
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 20 }} role="status">
                Saved. {what}.
              </strong>
              <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
                {[fileName, readByAi ? 'read by AI' : 'read from the spreadsheet', 'the file is kept with the case'].filter(Boolean).join(' · ')}
                {applied.appended && treeSteps ? ` · the case has ${treeSteps}` : ''}
                {applied.left_out ? ` · ${applied.left_out} left out at your check` : ''}
              </span>
            </span>
          </div>
          {heldLines.length > 0 && (
            <div className="ip-held-note" role="note">
              <p style={{ margin: 0 }}>
                <strong>
                  {heldLines.length} {heldLines.length === 1 ? 'line was' : 'lines were'} held, not saved as {heldLines.length === 1 ? 'a flow' : 'flows'}.
                </strong>{' '}
                Give {heldLines.length === 1 ? 'it' : 'each one'} a substance and a step in the case&apos;s Inventory, under Held from the file.
              </p>
              <ul aria-label="Held lines">
                {heldLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {heldHref && (
                <a className="ds-link" style={{ fontWeight: 600 }} href={heldHref} onClick={(e) => (e.preventDefault(), router.push(heldHref))}>
                  Fix the held {heldLines.length === 1 ? 'line' : 'lines'} in the Inventory
                </a>
              )}
            </div>
          )}
          {stageNote && (
            <p className="ip-stage-note" role="note">
              {stageNote}
            </p>
          )}
          <section className="np-section" aria-labelledby="stands-h" style={{ borderBottom: 0 }}>
            <h2 id="stands-h" className="ds-section-label" style={{ margin: 0 }}>
              Where this case stands
            </h2>
            {rows ? (
              <ul className="ip-stands">
                {rows.map((r) => (
                  <li key={r.key}>
                    <span className="ip-stand-dot" data-done={r.done || undefined} aria-hidden>
                      {r.done ? '✓' : ''}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 16 }}>{r.label}</strong>
                      <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>{r.detail}</span>
                      {r.key === 'scope' && !r.done && (
                        <ScopeSetter projectId={projectId} boundary={project?.system_boundary ?? null} onSaved={() => setTick((t) => t + 1)} />
                      )}
                    </span>
                    <span className="ds-mono" style={{ color: r.done ? 'var(--ds-green)' : 'var(--ds-text-2)' }}>
                      {r.value !== 'Done' && r.value !== 'Not yet' && <span className="ds-sr-only">{r.done ? 'Done: ' : 'Not done: '}</span>}
                      {r.value}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" style={{ color: 'var(--ds-text-2)', fontSize: 14 }}>
                {unread ? 'The checklist did not load. The case is saved: open the tree to see it.' : 'Reading the case…'}
              </p>
            )}
          </section>
          {runError && (
            <p role="alert" className="pp-alert" style={{ margin: '0 28px 12px' }}>
              {runError}
            </p>
          )}
          <footer className="np-foot ip-done-foot">
            <span className="ip-done-next">
              <strong>Next:</strong>{' '}
              {!rows
                ? 'Open the case.'
                : next
                  ? `${next.label}. ${next.connector === 'bom' ? 'It gives the materials, placed on the steps that use them.' : 'With the hours, it gives each step’s electricity.'}`
                  : 'Run the case. Nothing is computed until you do.'}
            </span>
            <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={onStartNew}>
              Start another case
            </button>
            <Button onClick={onOpenCase}>Open the tree</Button>
            {rows && next && (
              <Button onClick={() => void runCase()} busy={running}>
                Run it now
              </Button>
            )}
            {!rows ? (
              <Button variant="primary" onClick={onOpenCase}>
                Open the case →
              </Button>
            ) : next ? (
              <Button variant="primary" onClick={() => onAddAnother(next.connector)}>
                {next.label} →
              </Button>
            ) : (
              <Button variant="primary" busy={running} onClick={() => void runCase()}>
                Run the case →
              </Button>
            )}
          </footer>
        </div>
      </div>
      {guided && rows && (
        <aside className="ip-walk" aria-label="Guided mode">
          <div className="ws-guide" style={{ borderRadius: '16px 16px 0 0' }}>
            <span style={{ flex: 1 }}>
              <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
                Guided mode
              </span>
              <strong style={{ display: 'block', fontSize: 18 }}>Walk me through this case</strong>
            </span>
            <Flag kind="beta" />
          </div>
          <ol className="ip-walk-list">
            {!rows.find((r) => r.key === 'materials')?.done && (
              <li>
                <strong>Add the bill of materials</strong>
                <span>What goes into the product. You place each line on the step that uses it.</span>
              </li>
            )}
            {!rows.find((r) => r.key === 'energy')?.done && (
              <li>
                <strong>Add the equipment list</strong>
                <span>Each machine&apos;s power. With the hours, it gives each step&apos;s electricity.</span>
              </li>
            )}
            <li>
              <strong>Run it</strong>
              <span>Then read which step builds the number.</span>
            </li>
          </ol>
          <p className="ip-walk-foot">Guided mode is a beta. It stays off unless you turn it on.</p>
        </aside>
      )}
    </div>
  )
}

/**
 * Goal and scope, set here when it is not (F1): the functional unit and the
 * boundary, saved onto the project with an explicit Save. Enter does not save.
 */
function ScopeSetter({ projectId, boundary, onSaved }: { projectId: string; boundary: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [fu, setFu] = useState('')
  const [b, setB] = useState<string>(boundary ?? 'cradle-to-gate')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    if (!fu.trim()) return setError('Write the functional unit first, for example 1 bike frame.')
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ functional_unit: fu.trim(), system_boundary: b }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
      setOpen(false)
      onSaved()
    } catch (e: any) {
      setError(`Not saved: ${e?.message ?? 'the request failed'}.`)
    } finally {
      setBusy(false)
    }
  }
  if (!open) {
    return (
      <button type="button" className="ds-link" style={{ display: 'block', fontWeight: 600, marginTop: 4 }} onClick={() => setOpen(true)}>
        Set the goal and scope
      </button>
    )
  }
  return (
    <span className="ip-scope-set" role="group" aria-label="Goal and scope">
      <label className="ip-line-field">
        <span className="edu-field-label">Functional unit</span>
        <input
          className="ds-input"
          value={fu}
          maxLength={255}
          placeholder="e.g. 1 bike frame"
          aria-label="Functional unit"
          onChange={(e) => setFu(e.target.value)}
          // Enter never saves (B2): only the Save button does.
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
      </label>
      <label className="ip-line-field">
        <span className="edu-field-label">System boundary</span>
        <select className="ds-input" aria-label="System boundary" value={b} onChange={(e) => setB(e.target.value)}>
          {BOUNDARIES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
        <Button size="small" variant="dark" busy={busy} onClick={() => void save()}>
          Save
        </Button>
        <button type="button" className="ds-link" onClick={() => (setOpen(false), setError(null))}>
          Cancel
        </button>
      </span>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)', flexBasis: '100%' }}>
          {error}
        </span>
      )}
    </span>
  )
}
