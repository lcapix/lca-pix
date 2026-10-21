'use client'

// A case on a phone (E16, E17), read only for everyone: the header, the four
// tabs, and per tab the outline of the tree with each step's share, the
// flows by step, the answer with what builds it, how sure it is and its
// sources, and the write-up as text. Editing happens on a larger screen.

import { perUnit } from '@/lib/workspace/per-unit'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, FlowStatusPill, SourceTag, Tabs } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { SOURCE_WORD } from '@/lib/ui/words'
import { amount, answer, caseTotal, co2Unit, fixed, result3 } from '@/lib/ui/format'
import { compareNote, howSure, ownClimate, runClimate, subtreeSums, whatBuilds } from '@/lib/workspace/results-view'
import { comparability } from '@/lib/compare/comparability'
import { changeSummary, stepRows, whatChanged } from '@/lib/compare/compare-view'
import { caseKind, outlineRows, sourcesOf, zeroLines } from '@/lib/workspace/phone-view'
import { TIER_COLOURS, TIER_LABEL, TIERS } from '@/lib/workspace/tier-layout'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'
import type { WorkspaceCase, WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import { ReadOnlyBar } from '../shell/read-only-bar'

type Tab = 'tree' | 'inventory' | 'results' | 'writeup'
const SURE_COLOUR: Record<string, string> = { regional: '#2F6DB5', global: '#C49A3A', supplier: '#006A44', hand: '#6B4FA0', reference: '#8A918D' }

export function PhoneCase({
  kase,
  steps,
  inventory,
  run,
  against,
  targetCaseId,
  projectName,
  tab,
  onTab,
}: {
  kase: WorkspaceCase
  steps: WorkspaceStep[]
  inventory: WorkspaceInventory | null
  run: WorkspaceRun | null
  against: { label: string; run_id: number; total: number } | null
  targetCaseId: number | null
  projectName: string | null
  tab: Tab
  onTab: (t: Tab) => void
}) {
  const climate = run ? runClimate(run) : null
  const sums = useMemo(() => (run ? subtreeSums((run.run_steps ?? []).map((s) => ({ id: s.component_id, parentId: s.parent_id })), ownClimate(run)) : null), [run])
  const rows = inventory?.rows ?? []
  const fu = run?.goalScope?.functional_unit ?? kase.project_functional_unit
  const per = perUnit(kase, fu)

  return (
    <div className="ph" data-phone>
      <header className="ph-head">
        {projectName && <p style={{ margin: 0, fontSize: 14, color: 'var(--ds-text-2)' }}>{projectName}</p>}
        <h1 className="ph-title">{kase.case_name}</h1>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--ds-text-2)' }}>
          {caseKind(kase.case_type)} · {run ? `Run #${run.run_id}` : 'not run yet'}
        </p>
      </header>
      <div className="ph-tabs">
        <Tabs<Tab>
          gap={16}
          label="Case views"
          selected={tab}
          onSelect={onTab}
          tabs={[
            { id: 'tree', label: 'Tree', badge: <span className="ds-mono ph-badge">{steps.length}</span>, controls: 'ph-panel' },
            { id: 'inventory', label: 'Inventory', controls: 'ph-panel' },
            { id: 'results', label: 'Results', badge: run ? <span className="ds-mono ph-badge">Run #{run.run_id}</span> : undefined, controls: 'ph-panel' },
            { id: 'writeup', label: 'Write-up', controls: 'ph-panel' },
          ]}
        />
      </div>
      <div id="ph-panel" role="tabpanel" className="ph-body">
        {tab === 'tree' && <Outline steps={steps} sums={sums} total={climate?.value ?? null} rows={rows} caseType={kase.case_type} />}
        {tab === 'inventory' && <FlowsByStep steps={steps} rows={rows} />}
        {tab === 'results' &&
          (run && climate ? (
            <PhoneResults kase={kase} run={run} climate={climate} against={against} targetCaseId={targetCaseId} per={per} />
          ) : (
            <div className="ph-card">
              <EmptyState line="Not run yet. The answer shows here once the case is run on a larger screen." />
            </div>
          ))}
        {tab === 'writeup' && (
          <div className="ph-card">
            <p className="ds-section-label" style={{ margin: 0 }}>
              Interpretation
            </p>
            <p className="ph-text">{kase.interpretation?.trim() || 'Not written yet.'}</p>
            <p className="ds-section-label" style={{ margin: '18px 0 0' }}>
              Assumptions and limits
            </p>
            <p className="ph-text">{kase.assumptions?.trim() || 'Not written yet.'}</p>
            <p className="st-tick" data-off={!kase.is_final || undefined}>
              {kase.is_final ? (
                <>
                  <span aria-hidden>✓</span> <strong>Ticked as hand-in</strong>
                  <span>A tick only. It locks nothing.</span>
                </>
              ) : (
                'Not ticked as hand-in yet.'
              )}
            </p>
          </div>
        )}
      </div>
      <ReadOnlyBar />
    </div>
  )
}

function Outline({ steps, sums, total, rows, caseType }: { steps: WorkspaceStep[]; sums: Map<number, number> | null; total: number | null; rows: WorkspaceInventory['rows']; caseType: string }) {
  const lines = outlineRows(steps, sums, total, rows, caseType)
  return (
    <section className="ph-card" style={{ padding: 0 }} aria-labelledby="ph-outline-h">
      <div className="ph-outline-head">
        <h2 id="ph-outline-h" className="ds-section-label" style={{ margin: 0, flex: 1 }}>
          Outline · {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </h2>
        {total != null && <span className="ds-mono" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>share of {caseTotal(total, caseType)}</span>}
        <ul className="ph-legend" aria-label="Tiers">
          {TIERS.map((t) => (
            <li key={t}>
              <span className="ws-swatch" style={{ background: TIER_COLOURS[t].fill, borderColor: TIER_COLOURS[t].border }} aria-hidden />
              {TIER_LABEL[t]}
            </li>
          ))}
        </ul>
      </div>
      {lines.length ? (
        <ul className="ph-outline">
          {lines.map((l) => (
            <li key={l.id} style={{ paddingLeft: 18 + l.depth * 18 }} data-depth={l.depth}>
              <span className="ws-swatch" style={{ background: TIER_COLOURS[l.tier].fill, borderColor: TIER_COLOURS[l.tier].border }} aria-hidden />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ds-sr-only">{TIER_LABEL[l.tier]}: </span>
                <span style={{ fontWeight: l.strong ? 600 : l.tier === 'elemental_task' ? 400 : 500 }}>{l.name}</span>
                {l.note && <span className="ph-note">{l.note}</span>}
              </span>
              {l.right && (
                <span className="ds-mono" style={{ fontWeight: l.strong ? 600 : 400, color: l.tier === 'elemental_task' ? 'var(--ds-text-2)' : undefined }}>
                  {l.right}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="np-sub" style={{ padding: '0 18px 18px' }}>
          No steps yet.
        </p>
      )}
    </section>
  )
}

function FlowsByStep({ steps, rows }: { steps: WorkspaceStep[]; rows: WorkspaceInventory['rows'] }) {
  const byStep = steps.map((s) => ({ s, flows: rows.filter((r) => r.component_id === s.id) })).filter((g) => g.flows.length)
  if (!byStep.length) {
    return (
      <div className="ph-card">
        <EmptyState line="No flows yet." />
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {byStep.map(({ s, flows }) => (
        <section key={s.id} className="ph-card" aria-label={s.name}>
          <h2 className="ph-step">{s.name}</h2>
          <ul className="ph-flows">
            {flows.map((f) => (
              <li key={f.flow_id}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {f.substance}
                  <span className="ph-dir">{f.direction === 'output' ? 'out' : 'in'}</span>
                </span>
                <span className="ds-mono">{f.amount == null ? '–' : `${amount(f.amount)} ${f.unit}`}</span>
                <FlowStatusPill status={f.status} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PhoneResults({
  kase,
  run,
  climate,
  against,
  targetCaseId,
  per,
}: {
  kase: WorkspaceCase
  run: WorkspaceRun
  climate: { name: string; value: number; unit: string }
  against: { label: string; run_id: number; total: number } | null
  targetCaseId: number | null
  per: string
}) {
  const builds = whatBuilds(run, kase.case_type)
  const sure = howSure(run, kase.case_type)
  const sources = sourcesOf(run.flowDetail ?? [])
  const note = against ? compareNote(climate.value, against, !!kase.copied_from) : null
  const changed = useWhatChanged(kase.project_id, targetCaseId, kase.case_id)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <section className="ph-card" aria-labelledby="ph-answer-h">
        <h2 id="ph-answer-h" className="ds-section-label" style={{ margin: 0 }}>
          Answer · Global warming
        </h2>
        <p className="ph-answer">
          <span className="ds-mono">{answer(climate.value, kase.case_type)}</span>
          <span className="ds-mono">
            {co2Unit(climate.unit)} per {per}
          </span>
        </p>
        {note && against && (
          <p className="ph-delta">
            {note.chip.startsWith('Same') ? (
              note.chip
            ) : (
              <>
                <span aria-hidden>{climate.value < against.total ? '↓ ' : '↑ '}</span>
                {note.note ? `${note.note} than the ${against.label || 'previous run'} ${caseTotal(against.total, 'base')}` : note.chip}
              </>
            )}
          </p>
        )}
        {changed && <p style={{ margin: '12px 0 0', fontSize: 16 }}>{changed}</p>}
      </section>

      {builds.length > 0 && (
        <section className="ph-card" aria-labelledby="ph-builds-h">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 id="ph-builds-h" className="ds-section-label" style={{ margin: 0 }}>
              What builds this number
            </h2>
            <span className="ds-mono" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
              kg · share
            </span>
          </div>
          <ul className="ph-builds">
            {builds
              .filter((b) => Math.abs(b.value) >= 1e-12)
              .map((b) => (
                <li key={b.component_id}>
                  <span className="ph-build-row">
                    <span style={{ flex: 1, minWidth: 0 }}>{b.name}</span>
                    <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                      {result3(b.value)}
                    </span>
                    <span className="ds-mono" style={{ fontWeight: 600, minWidth: 56, textAlign: 'right' }}>
                      {b.share}
                    </span>
                  </span>
                  <span className="an-bar" aria-hidden>
                    <span style={{ width: `${Math.round(b.fraction * 100)}%` }} />
                  </span>
                </li>
              ))}
          </ul>
          {zeroLines(builds).map((l) => (
            <p key={l} style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ds-text-2)' }}>
              {l}
            </p>
          ))}
        </section>
      )}

      {sure && (
        <section className="ph-card ph-sure" aria-labelledby="ph-sure-h">
          <h2 id="ph-sure-h" className="ph-sure-h">
            <span aria-hidden>⚠</span> How sure
          </h2>
          <p style={{ margin: '8px 0 12px', fontSize: 16 }}>{sure.sentence}</p>
          <div className="ph-sure-bar" aria-hidden>
            {sure.groups.map((g) => (
              <span key={g.kind} style={{ width: `${Math.max(0, g.fraction) * 100}%`, background: SURE_COLOUR[g.kind] }} />
            ))}
          </div>
          <p style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, margin: '8px 0 0', fontSize: 14 }}>
            {sure.groups.map((g) => (
              <span key={g.kind}>
                {SOURCE_WORD[g.kind]} <span className="ds-mono" style={{ fontWeight: 600 }}>{g.share}</span>
              </span>
            ))}
          </p>
        </section>
      )}

      {sources.length > 0 && (
        <section className="ph-card" aria-labelledby="ph-src-h">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 id="ph-src-h" className="ds-section-label" style={{ margin: 0 }}>
              Sources
            </h2>
            <span className="ds-mono" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
              factor
            </span>
          </div>
          <ul className="ph-sources">
            {sources.map((s) => (
              <li key={`${s.substance}-${s.source}-${s.scope}`}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block' }}>{s.substance}</strong>
                  <span style={{ display: 'block', fontSize: 14, color: 'var(--ds-text-2)' }}>{[s.source, s.scope && s.tag === 'regional' && !(s.source ?? '').includes(s.scope) ? s.scope : null].filter(Boolean).join(' · ') || 'Library factor'}</span>
                  <SourceTag kind={s.tag} />
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span className="ds-mono" style={{ display: 'block', fontWeight: 600 }}>
                    {fixed(s.factor, 3)}
                  </span>
                  <span className="ds-mono" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
                    {s.per}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * "What changed: steel 0.80 to 0.78 kg, so 0.038 kg less, all from 10. Cut
 * blank." against the case this one is measured from, when the two runs
 * compare fairly (lib/compare/comparability.ts); otherwise nothing.
 */
function useWhatChanged(projectId: number, targetId: number | null, caseId: number): string | null {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => {
    setLine(null)
    if (!targetId || targetId === caseId) return
    let live = true
    void apiRequest(`/api/projects/${projectId}/compare?cases=${targetId},${caseId}&base=${targetId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.cases) return
        const base = d.cases.find((c: any) => c.caseId === String(targetId))
        const other = d.cases.find((c: any) => c.caseId === String(caseId))
        if (!base || !other) return
        const fair = comparability(
          [base, other].map((c: any) => ({
            caseId: c.caseId,
            run: c.run ? { runId: c.run.runId, method: c.run.method, region: c.run.region, functionalUnit: c.run.functionalUnit } : null,
            editedSinceRun: c.status === 'stale' || !!c.run?.stale,
          })),
        ).fair
        if (!fair) return
        const category = base.totals.find((t: any) => /global warming|climate/i.test(t.category))?.category
        if (!category) return
        const diff = d.diffs.find((x: any) => x.caseId === String(caseId))?.inventory ?? null
        const w = whatChanged(diff, other, category, 'kg CO₂-eq')
        const summary = changeSummary(stepRows([base, other], category, diff, true), 'kg CO₂-eq')
        if (!w.lines.length) return setLine('Nothing in this copy differs from the case it came from yet.')
        const head = w.main && w.nothingElse ? `${w.main.substance.toLowerCase()} ${w.main.from} to ${w.main.to} ${w.main.unit}` : `${w.lines.length} inputs`
        setLine(`What changed: ${head}${summary ? `, so ${summary.charAt(0).toLowerCase()}${summary.slice(1)}` : '.'}`)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [projectId, targetId, caseId])
  return line
}
