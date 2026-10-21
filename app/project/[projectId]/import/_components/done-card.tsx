'use client'

// Saved (F2.4): what was saved and where, the file kept with the case, Where
// this case stands (six rows, read fresh from the case), the next file as the
// one primary, Open the tree, and with Guided mode on a short walk through
// what to add next.

import { useEffect, useState } from 'react'
import { Button, Flag } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { caseStands, nextFile, type StandsRow } from '@/lib/import/case-stands'
import type { ApplyResult } from '@/lib/import/done-summary'

export function DoneCard({
  projectId,
  applied,
  fileName,
  readByAi,
  stepCount,
  caseName,
  onAddAnother,
  onOpenCase,
  onStartNew,
}: {
  projectId: string
  applied: ApplyResult & { held_details?: unknown }
  fileName: string | null
  readByAi: boolean
  /** The steps saved, as the Save button counted them ("Save 5 steps"). */
  stepCount?: number
  /** The case's name, when the answer does not carry it (adding to a case). */
  caseName?: string | null
  /** Continue this case with the next file. */
  onAddAnother: () => void
  onOpenCase: () => void
  onStartNew: () => void
}) {
  const [guided] = useGuidedMode()
  const [rows, setRows] = useState<StandsRow[] | null>(null)
  // A read that never answers (offline, a dropped connection) must not leave
  // "Reading the case…" up for good.
  const [unread, setUnread] = useState(false)
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
        setRows(
          caseStands({
            project: {
              functional_unit: p?.project?.functional_unit ?? null,
              system_boundary: p?.project?.system_boundary ?? null,
              lcia_method: p?.project?.lcia_method ?? null,
              region_code: p?.project?.region_code ?? null,
            },
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
  }, [projectId, caseId])

  const next = rows ? nextFile(rows) : null
  const what = applied.appended
    ? `${applied.flows_applied ?? 0} ${applied.flows_applied === 1 ? 'line is' : 'lines are'} in ${applied.case_name ?? caseName ?? 'the case'}`
    : `${stepCount ?? applied.components_created ?? 0} ${(stepCount ?? applied.components_created) === 1 ? 'step' : 'steps'}${applied.cost_nodes ? ' and their hours' : ''} ${(stepCount ?? applied.components_created) === 1 ? 'is' : 'are'} in ${applied.case_name ?? 'the new case'}`
  const held = Number(applied.flows_held_for_review ?? 0)

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
                {held ? ` · ${held} ${held === 1 ? 'line' : 'lines'} held to give a value` : ''}
                {applied.left_out ? ` · ${applied.left_out} left out at your check` : ''}
              </span>
            </span>
          </div>
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
          <footer className="np-foot">
            <span style={{ flex: 1 }} />
            <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={onStartNew}>
              Start another case
            </button>
            <Button onClick={onOpenCase}>Open the tree</Button>
            {next && (
              <Button variant="primary" onClick={onAddAnother}>
                {next.label} →
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
