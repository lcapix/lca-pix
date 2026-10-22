'use client'

// The Results panel beside the tree (E05, behaviour spec "Results tab"): the
// answer first, the sentence on what builds it, the note against the Base case
// (or the previous run), What builds this number, How sure, Cost beside
// impact, the other categories behind one button, older runs (read-only, with
// "Back to Run #n"), Magic Insights, and one primary: Try a what-if.

import { perUnit } from '@/lib/workspace/per-unit'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShellStore } from '@/lib/shell/use-shell'
import { Button, EmptyState, Flag, SectionLabel } from '@/components/lcapix/ds'
import { SOURCE_WORD } from '@/lib/ui/words'
import { amount, answer, caseTotal, co2Unit, fixed, money, result3 } from '@/lib/ui/format'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { apiRequest } from '@/lib/api-client'
import { answerSentence, compareNote, costBeside, howSure, otherCategories, runClimate, whatBuilds } from '@/lib/workspace/results-view'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'
import type { WorkspaceCase } from '@/lib/workspace/use-workspace'
import { FloatingPanel } from './floating-panel'
import { ExerciseSlot } from './exercise-card'

const SURE_COLOUR: Record<string, string> = {
  global: '#C99A3A',
  regional: '#2F7BC0',
  supplier: '#006A44',
  hand: '#7C61B5',
  reference: '#858F8A',
}

export function ResultsPanel({
  kase,
  run,
  older,
  completed,
  against,
  readOnly,
  onOpenRun,
  onOpenInsights,
}: {
  kase: WorkspaceCase
  run: WorkspaceRun | null
  older: boolean
  completed: WorkspaceRun[]
  against: { label: string; run_id: number; total: number } | null
  readOnly: boolean
  onOpenRun: (runId: number | null) => void
  onOpenInsights: () => void
}) {
  const [guided] = useGuidedMode()
  const [showOther, setShowOther] = useState(false)
  const [whatIfBusy, setWhatIfBusy] = useState(false)
  const [whatIfError, setWhatIfError] = useState<string | null>(null)
  const router = useRouter()
  const unit = perUnit(kase)

  if (!run) {
    return (
      <FloatingPanel label="Results" title={<strong>Results</strong>}>
        <div className="ws-panel-section">
          <EmptyState line="Not run yet. Run Assessment and the answer shows here, with what builds it." />
        </div>
      </FloatingPanel>
    )
  }

  const climate = runClimate(run)
  const builds = whatBuilds(run, kase.case_type)
  const sentence = answerSentence(run, builds)
  const sure = howSure(run, kase.case_type)
  const cost = costBeside(run)
  const others = otherCategories(run)
  const latest = completed[0]
  const prev = completed.find((r) => r.run_id < run.run_id) ?? null
  const prevTotal = prev ? runClimate(prev)?.value : undefined
  const note =
    climate && against
      ? compareNote(climate.value, against, !!kase.copied_from)
      : climate && prev && prevTotal !== undefined
        ? compareNote(climate.value, { label: '', run_id: prev.run_id, total: prevTotal }, false)
        : null
  const maxBuild = Math.max(...builds.map((b) => b.fraction), 0)

  const tryWhatIf = async () => {
    setWhatIfBusy(true)
    setWhatIfError(null)
    try {
      for (let i = 1; i <= 20; i++) {
        const name = `What-if ${i} of ${kase.case_name}`.slice(0, 120)
        const res = await apiRequest(`/api/cases/${kase.case_id}/duplicate`, {
          method: 'POST',
          body: JSON.stringify({ case_name: name, case_type: 'comparative' }),
        })
        if (res.status === 409) continue
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
        // The sidebar's case count follows.
        void useShellStore.getState().refresh()
        router.push(`/project/${kase.project_id}/case/${d.case_id}`)
        return
      }
      throw new Error('every what-if name tried is taken; rename one of them')
    } catch (e: any) {
      setWhatIfError(e?.message ?? 'the what-if was not made')
      setWhatIfBusy(false)
    }
  }

  return (
    <FloatingPanel
      label={`Results, Run #${run.run_id}`}
      title={
        <>
          <span style={{ color: 'var(--ds-text-3)' }}>Results · </span>
          <strong>Run #{run.run_id}</strong>
        </>
      }
    >
      {older && latest && (
        <div className="ws-outofdate" role="status">
          <span style={{ flex: 1 }}>
            <strong>Run #{run.run_id} is an older run.</strong> It is read-only and shows what it froze.
          </span>
          <button type="button" className="ds-link" onClick={() => onOpenRun(null)}>
            Back to Run #{latest.run_id}
          </button>
        </div>
      )}
      <ExerciseSlot
        fallback={
        <div className="ws-guide">
          <span style={{ flex: 1 }}>
            <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
              Guided mode · The answer
            </span>
            <br />
            This is the climate impact of one {unit}. The bars show which step builds it.
          </span>
          <Flag kind="beta" />
        </div>
        }
      />

      {climate ? (
        <div className="ws-panel-section">
          <SectionLabel>Answer · {climate.name}</SectionLabel>
          <div className="ws-answer" style={{ marginTop: 8 }}>
            <span className="ws-answer-num">{answer(climate.value, kase.case_type)}</span>
            <span className="ds-mono" style={{ fontSize: 16 }}>
              {co2Unit(climate.unit)} per {unit}
            </span>
          </div>
          {sentence && <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: '24px' }}>{sentence}</p>}
          {note && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <span className="ws-pill" style={{ cursor: 'default' }}>
                {note.chip}
              </span>
              {note.note && <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>{note.note}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="ws-panel-section">
          <EmptyState line={`${run.calculation_method} has no climate category, so there is no single answer. The categories are below.`} />
        </div>
      )}

      {builds.length > 0 && (
        <div className="ws-panel-section">
          <SectionLabel>What builds this number</SectionLabel>
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 10 }}>
            {builds.map((b) => (
              <li key={b.component_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 52px 52px', gap: 12, alignItems: 'center', fontSize: 14 }}>
                {/* rules.md: a step's name wraps, never shortened ("30. Powder coat and cure"). */}
                <span style={{ overflowWrap: 'anywhere' }}>{b.name}</span>
                <span className="ws-bar" aria-hidden>
                  <span style={{ width: `${maxBuild ? (b.fraction / maxBuild) * 100 : 0}%` }} />
                </span>
                <span className="ds-mono" style={{ textAlign: 'right' }}>
                  {b.value ? result3(b.value) : '0'}
                </span>
                <span className="ds-mono" style={{ textAlign: 'right', color: 'var(--ds-text-2)' }}>
                  {b.share}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sure && (
        <div className="ws-panel-section">
          <SectionLabel>How sure</SectionLabel>
          <p style={{ margin: '8px 0 10px', fontSize: 15 }}>{sure.sentence}</p>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--ds-line-soft)' }} aria-hidden>
            {sure.groups.map((g) => (
              <span key={g.kind} style={{ width: `${Math.max(0, g.fraction) * 100}%`, background: SURE_COLOUR[g.kind] }} />
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>
            {sure.groups.map((g) => `${SOURCE_WORD[g.kind]} ${g.share}`).join(' · ')}
          </p>
        </div>
      )}

      {cost && (
        <div className="ws-panel-section">
          <div className="ds-card" style={{ padding: 18 }}>
            <strong style={{ fontSize: 17 }}>Cost beside impact</strong>
            <div className="ws-answer" style={{ marginTop: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 600 }}>{money(cost.total, cost.currency)}</span>
              <span className="ds-mono" style={{ fontSize: 14 }}>
                {cost.currency} per {unit}
              </span>
            </div>
            <p style={{ margin: '8px 0 12px', fontSize: 13, color: 'var(--ds-text-2)' }}>
              Frozen with this run · {cost.rows.length} {cost.rows.length === 1 ? 'step' : 'steps'}
            </p>
            <table className="ws-table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left' }}>
                    Step
                  </th>
                  <th scope="col">Cost</th>
                  <th scope="col">Share</th>
                  <th scope="col">Impact</th>
                </tr>
              </thead>
              <tbody>
                {cost.rows.map((r) => (
                  <tr key={r.component_id}>
                    <td>{r.name}</td>
                    <td className="ds-mono" style={{ textAlign: 'right' }}>
                      {money(r.cost, cost.currency)}
                    </td>
                    <td className="ds-mono" style={{ textAlign: 'right' }}>
                      {r.share}
                    </td>
                    <td className="ds-mono" style={{ textAlign: 'right' }}>
                      {r.impact ? result3(r.impact) : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="ws-panel-section">
          <button type="button" className="ds-link" aria-expanded={showOther} onClick={() => setShowOther((v) => !v)}>
            {showOther ? 'Hide' : 'Show'} the other {others.length === 1 ? 'category' : `${others.length} categories`}
          </button>
          {showOther && (
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 6, fontSize: 13 }}>
              {others.map((o) => (
                <li key={o.name} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ flex: 1 }}>{o.name}</span>
                  <span className="ds-mono">
                    {amount(o.value)} {o.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {completed.length > 1 && (
        <div className="ws-panel-section">
          <SectionLabel>Runs</SectionLabel>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 4, fontSize: 13 }}>
            {completed.slice(0, 8).map((r) => {
              const t = runClimate(r)?.value
              const here = r.run_id === run.run_id
              return (
                <li key={r.run_id}>
                  <button
                    type="button"
                    className="ws-run-row"
                    aria-current={here || undefined}
                    onClick={() => onOpenRun(r.run_id === latest?.run_id ? null : r.run_id)}
                  >
                    <span style={{ fontWeight: 600 }}>Run #{r.run_id}</span>
                    <span style={{ color: 'var(--ds-text-2)' }}>{String(r.run_date ?? '').slice(0, 10)}</span>
                    <span className="ds-mono" style={{ marginLeft: 'auto' }}>
                      {t !== undefined ? caseTotal(t, kase.case_type) : '–'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="ws-panel-section" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!readOnly && !older && (
          <Button variant="primary" onClick={tryWhatIf} busy={whatIfBusy}>
            Try a what-if
          </Button>
        )}
        <Button onClick={onOpenInsights}>Magic Insights</Button>
        {whatIfError && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)', flexBasis: '100%' }}>
            The what-if was not made: {whatIfError}
          </span>
        )}
      </div>
    </FloatingPanel>
  )
}
