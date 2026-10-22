'use client'

// The sample study's Overview (E02): the first Home, and the sample project's
// Overview. Seven sections in the order research is done, each with a door to
// its screen: 01 the question, 02 how it is made, 03 what goes in, 04 the
// answer, 05 a what-if, 06 the write-up (an example, not saved), 07 what to do
// next. Read-only, with Make my own copy. With Guided mode on, the guide walks
// the seven sections from a card in the sidebar (Next section, Skip the walk).

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, ErrorCard, Flag, SourceTag } from '@/components/lcapix/ds'
import { useGuidedMode } from '@/lib/shell/use-shell'
import { useSidebarGuide } from '@/lib/shell/guide-slot'
import { useSampleStudy } from '@/lib/home/use-sample-study'
import { exampleWriteUp, howSureLong, whatChanged, whatGoesIn, type FlowAmount } from '@/lib/home/sample-view'
import { amountBox, answer, caseTotal, co2Unit, fixed, result3 } from '@/lib/ui/format'
import { answerSentence, howSure, runClimate, whatBuilds } from '@/lib/workspace/results-view'
import { TIER_COLOURS, TIER_LABEL, TIERS } from '@/lib/workspace/tier-layout'
import { makeOwnCopy } from '@/lib/workspace/make-copy'
import { sourceText } from '@/components/lcapix/workspace/flow-bits'

const WALK_KEY = 'lcapix-sample-walk-done'
const WALK = [
  'A finished study, read in the order research is done. Start with what it asks.',
  'How it is made: the product down to each task. The shares show where the impact sits.',
  'What goes in: each line is an amount times a factor. You can check every one.',
  'The answer, what builds it, and how sure to be.',
  'A what-if: one change, run again, compared with the base case.',
  'The numbers said in words. Yours goes on your own copy.',
  'Now make your own copy. The six exercises happen there.',
]

function useWalk() {
  const [done, setDone] = useState(true)
  useEffect(() => {
    try {
      setDone(localStorage.getItem(WALK_KEY) === '1')
    } catch {
      setDone(false)
    }
  }, [])
  const finish = () => {
    setDone(true)
    try {
      localStorage.setItem(WALK_KEY, '1')
    } catch {}
  }
  return { done, finish }
}

export function SampleOverview({ projectId, ownName, ownsProject }: { projectId: number; ownName: string | null; ownsProject: boolean }) {
  const router = useRouter()
  const s = useSampleStudy(projectId)
  const [guided] = useGuidedMode()
  const walk = useWalk()
  const [section, setSection] = useState(0)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const refs = useRef<Array<HTMLElement | null>>([])
  const walking = guided && !walk.done

  const go = (i: number) => {
    setSection(i)
    refs.current[i]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    refs.current[i]?.focus({ preventScroll: true })
  }

  const card = useMemo(
    () =>
      walking ? (
        <div className="so-guide" role="region" aria-label="Guided mode">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>Guided mode</strong> <Flag kind="beta" />
          </span>
          <span className="ds-mono" style={{ fontSize: 12, color: '#86D3A6' }}>
            Section {section + 1} of 7
          </span>
          <p style={{ margin: '10px 0 12px', fontSize: 14, lineHeight: '20px' }} aria-live="polite">
            {WALK[section]}
          </p>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {section < 6 ? (
              <button type="button" className="so-guide-next" onClick={() => go(section + 1)}>
                Next section
              </button>
            ) : (
              <button type="button" className="so-guide-next" onClick={walk.finish}>
                Done
              </button>
            )}
            <button type="button" className="so-guide-skip" onClick={walk.finish}>
              Skip the walk
            </button>
          </span>
        </div>
      ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walking, section],
  )
  useSidebarGuide(card)

  const copy = async () => {
    if (!s.base) return
    setCopying(true)
    setCopyError(null)
    try {
      const id = await makeOwnCopy(s.base.case_id, ownName)
      router.push(`/project/${projectId}/case/${id}`)
    } catch (e: any) {
      setCopyError(e?.message ?? 'the copy failed')
      setCopying(false)
    }
  }

  if (s.status === 'error') {
    return (
      <div style={{ padding: 24 }}>
        <ErrorCard title="The sample study did not load" cause={s.error} onRetry={s.reload} />
      </div>
    )
  }
  if (s.status === 'loading' || !s.project || !s.base) {
    return (
      <div style={{ padding: 24, color: 'var(--ds-text-2)' }} role="status">
        Loading the sample study…
      </div>
    )
  }

  const p = s.project
  const caseHref = (tab?: string) => `/project/${projectId}/case/${s.base!.case_id}${tab ? `?tab=${tab}` : ''}`
  const unit = s.base.reference_flow_unit || 'unit'
  const method = s.inventory?.method ?? p.lcia_method ?? ''
  const region = s.inventory?.region ?? p.region_code ?? ''
  const run = s.run
  const climate = run ? runClimate(run) : null
  const builds = run ? whatBuilds(run, 'base') : []
  const sentence = run ? answerSentence(run, builds) : null
  const sure = run ? howSure(run, 'base') : null
  const shareOf = new Map(builds.map((b) => [b.component_id, b.share.replace(/\.\d%$/, '%')]))
  const stepName = (id: number) => s.steps.find((x) => x.id === id)?.name ?? 'a step'
  const inputs = s.inventory ? whatGoesIn(s.inventory.rows, stepName, method) : null
  const wiClimate = s.whatIfRun ? runClimate(s.whatIfRun) : null
  const amountsOf = (inv: typeof s.inventory, name: (id: number) => string): FlowAmount[] =>
    (inv?.rows ?? []).map((r) => ({ step: name(r.component_id), substance: r.substance, direction: r.direction, amount: r.amount, unit: r.unit }))
  const changed =
    climate && wiClimate && s.whatIfInventory
      ? whatChanged(
          amountsOf(s.inventory, stepName),
          // The copy's steps carry the same names; its rows name their own step ids.
          amountsOf(s.whatIfInventory, (id) => s.whatIfRun?.run_steps?.find((x) => x.component_id === id)?.name ?? ''),
          climate.value,
          wiClimate.value,
        )
      : null
  const pctDiff = climate && wiClimate ? (Number(fixed(wiClimate.value, 3)) - Number(fixed(climate.value, 3))) / Number(fixed(climate.value, 3)) : null
  const allFrom =
    changed && changed.changes.length && new Set(changed.changes.map((c) => c.substance.split(',')[0].toLowerCase())).size === 1
      ? changed.changes[0].substance.split(',')[0].toLowerCase()
      : null
  const writeUp =
    climate && s.whatIf
      ? exampleWriteUp({
          total: climate.value,
          unit: co2Unit(climate.unit),
          perUnit: unit,
          answerSentence: sentence,
          sure: sure ? { pct: Math.round(sure.groups[0].fraction * 100), what: sureWhat(sure.sentence) } : null,
          whatIf:
            pctDiff !== null
              ? { name: s.whatIf.case_name, pct: `${fixed(Math.abs(pctDiff) * 100, 1)}%`, lower: pctDiff < 0, allFrom }
              : null,
        })
      : null

  const sections: Array<{ label: string; lead: string; door?: { label: string; href?: string; onClick?: () => void }; body: React.ReactNode }> = [
    {
      label: 'The question',
      lead: '',
      door: { label: 'Goal and scope', onClick: () => setScopeOpen((v) => !v) },
      body: (
        <>
          <p className="so-question">{p.goal_statement || p.project_name}</p>
          <span className="so-chips">
            {p.functional_unit && <span className="so-chip">{p.functional_unit}</span>}
            {p.system_boundary && <span className="so-chip">{boundaryWords(p.system_boundary)}</span>}
            <span className="so-chip ds-mono">
              {method}
              {region ? ` · ${region}` : ''}
            </span>
          </span>
          {scopeOpen && (
            <dl className="so-scope">
              <dt>Goal</dt>
              <dd>{p.goal_statement || '–'}</dd>
              <dt>Functional unit</dt>
              <dd>{p.functional_unit || '–'}</dd>
              <dt>Boundary</dt>
              <dd>
                {p.system_boundary ? boundaryWords(p.system_boundary) : '–'}
                {p.boundary_notes ? `. ${p.boundary_notes}` : ''}
              </dd>
              <dt>Method and region</dt>
              <dd>
                {method}
                {region ? `, ${region}` : ''}
              </dd>
            </dl>
          )}
        </>
      ),
    },
    {
      label: 'How it is made',
      lead: `${s.steps.length} steps in five tiers, from the product down to each task.`,
      door: { label: 'Open the tree', href: caseHref() },
      body: (
        <div className="so-tiers">
          {TIERS.map((t) => {
            const row = s.steps.filter((x) => x.tier === t)
            if (!row.length) return null
            const c = TIER_COLOURS[t]
            return (
              <div key={t} className="so-tier-row">
                <span className="so-tier-label">{TIER_LABEL[t]}</span>
                <span className="so-chips">
                  {row.map((x) => (
                    <span key={x.id} className="so-step" style={{ background: c.fill + '55', borderColor: c.border, color: c.ink }}>
                      {x.name}
                      {t === 'product' && climate ? <span className="ds-mono"> {answer(climate.value, 'base')}</span> : null}
                      {t === 'operation' && shareOf.has(x.id) ? <span className="ds-mono so-share"> {shareOf.get(x.id)}</span> : null}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      ),
    },
    {
      label: 'What goes in',
      lead: 'Each impact is amount times factor. You can check every line.',
      door: { label: 'Inventory', href: caseHref('inventory') },
      body: inputs ? (
        <>
          <table className="so-lines">
            <caption className="ds-sr-only">The largest climate lines of the base case</caption>
            <tbody>
              {inputs.shown.map((r) => (
                <tr key={r.flow_id}>
                  <td className="ds-mono so-dim">{stepName(r.component_id)}</td>
                  <td>{r.substance}</td>
                  <td className="ds-mono">
                    {amountBox(r.amount)} {r.unit} × {fixed(r.climate!.factor, 3)} = {result3(r.climate!.impact)}
                  </td>
                  <td>
                    <span style={{ display: 'block', fontSize: 13 }}>
                      {sourceText(r.climate!.source)}
                      {r.climate!.tag === 'regional' && r.climate!.scope ? ` · ${r.climate!.scope}` : ''}
                    </span>
                    <SourceTag kind={r.climate!.tag} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inputs.footnote && <p className="so-foot">{inputs.footnote}</p>}
        </>
      ) : null,
    },
    {
      label: 'The answer',
      // "Global warming, per bracket": the category in sentence case.
      lead: climate ? `${climate.name.charAt(0)}${climate.name.slice(1).toLowerCase()}, per ${unit}, from Run #${run!.run_id}.` : 'Not run yet.',
      door: { label: 'Results', href: caseHref('results') },
      body: climate ? (
        <>
          <div className="so-answer">
            <div>
              <span className="ws-answer">
                <span className="ws-answer-num">{answer(climate.value, 'base')}</span>
                <span className="ds-mono">{co2Unit(climate.unit)}</span>
              </span>
              {sentence && <p style={{ margin: '12px 0 0', fontSize: 17 }}>{sentence}</p>}
            </div>
            <div>
              <span className="ds-section-label">What builds this number</span>
              <ul className="so-bars">
                {builds
                  .filter((b) => b.value > 0)
                  .slice(0, 4)
                  .map((b) => (
                    <li key={b.component_id}>
                      <span>{b.name}</span>
                      <span className="ws-bar" aria-hidden>
                        <span style={{ width: `${(b.fraction / (builds[0]?.fraction || 1)) * 100}%` }} />
                      </span>
                      <span className="ds-mono">{result3(b.value)}</span>
                      <span className="ds-mono so-dim">{b.share}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          {sure && (
            <div className="so-sure">
              <p style={{ margin: 0 }}>{howSureLong(sure.sentence, sure.groups, region, climate.value, 'base')}</p>
              <p className="ds-mono" style={{ margin: '8px 0 0', fontSize: 13 }}>
                {sure.groups.map((g) => `${g.kind === 'global' ? 'Global average' : g.kind === 'regional' ? 'Regional' : g.kind === 'hand' ? 'Entered by hand' : g.kind === 'supplier' ? 'Supplier' : 'Reference'} ${g.share}`).join(' · ')}
              </p>
            </div>
          )}
        </>
      ) : null,
    },
    {
      label: 'A what-if',
      lead: 'One change, run again, compared with the base.',
      door: s.whatIf ? { label: 'Compare', href: `/project/${projectId}/comparison?cases=${s.base.case_id},${s.whatIf.case_id}` } : undefined,
      body:
        climate && wiClimate && s.whatIf ? (
          <div className="so-whatif">
            <span>
              <span className="so-dim" style={{ display: 'block', fontSize: 14 }}>
                {s.base.case_name}
              </span>
              <span className="so-big so-dim">{answer(climate.value, 'base')}</span>
            </span>
            <span aria-hidden className="so-dim" style={{ fontSize: 22 }}>
              →
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{s.whatIf.case_name}</span>
              <span className="so-big">{caseTotal(wiClimate.value, 'comparative')}</span>
            </span>
            {pctDiff !== null && (
              <span className="ws-pill ds-mono" style={{ cursor: 'default', background: 'var(--ds-success-bg)', borderColor: '#cfe5d8', color: 'var(--ds-green)' }}>
                {pctDiff < 0 ? '▼' : '▲'} {fixed(Math.abs(pctDiff) * 100, 1)}% {pctDiff < 0 ? 'lower' : 'higher'}
              </span>
            )}
            {changed && (
              <span className="so-changed">
                <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
                  What changed
                </span>
                <span style={{ display: 'block', marginTop: 6 }}>{changed.sentence}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="so-foot">The what-if has not run.</p>
        ),
    },
    {
      label: 'The write-up',
      lead: 'What the numbers mean, in words.',
      door: { label: 'Write-up', href: caseHref('writeup') },
      body: writeUp ? (
        <>
          <span className="so-chip ds-mono" style={{ letterSpacing: '0.08em' }}>
            EXAMPLE · NOT SAVED TO THE CASE
          </span>
          <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: '28px' }}>{writeUp}</p>
        </>
      ) : null,
    },
  ]

  return (
    <div className="so">
      <header className="so-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="ds-flag ds-flag--sample">Sample study</span>
            <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>Read-only · made for you when you signed up</span>
          </span>
          <h1 className="ds-title" style={{ margin: '6px 0 0' }}>
            {p.project_name}{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              A finished study · {s.base.reference_flow ?? 1} {unit} · {method}
              {region ? ` · ${region}` : ''}
              {run ? ` · Run #${run.run_id}` : ''}
            </span>
          </h1>
        </div>
        <button type="button" className="so-search ds-focusable" onClick={() => window.dispatchEvent(new CustomEvent('lcapix:open-search'))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
          <kbd>⌘K</kbd>
        </button>
        <Button variant="primary" onClick={copy} busy={copying}>
          Make my own copy
        </Button>
      </header>
      {copyError && (
        <div style={{ padding: '0 24px' }}>
          <ErrorCard title="The copy was not made" cause={copyError} onRetry={copy} />
        </div>
      )}

      <ol className="so-sections">
        {sections.map((sec, i) => (
          <li key={sec.label} className="so-section">
            <span className="so-num" data-current={walking && section === i ? 'true' : undefined} aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <section
              ref={(el) => {
                refs.current[i] = el
              }}
              tabIndex={-1}
              aria-labelledby={`so-h-${i}`}
              className="so-card"
              data-current={walking && section === i ? 'true' : undefined}
            >
              <div className="so-side">
                <h2 id={`so-h-${i}`} className="ds-section-label">
                  {sec.label}
                </h2>
                {sec.lead && <p style={{ margin: '8px 0 10px', fontSize: 15, lineHeight: '22px' }}>{sec.lead}</p>}
                {sec.door &&
                  (sec.door.href ? (
                    <Link href={sec.door.href} className="ds-link so-door">
                      {sec.door.label} ›
                    </Link>
                  ) : (
                    <button type="button" className="ds-link so-door" aria-expanded={scopeOpen} onClick={sec.door.onClick}>
                      {sec.door.label} ›
                    </button>
                  ))}
              </div>
              <div className="so-main">{sec.body}</div>
            </section>
          </li>
        ))}
        <li className="so-section">
          <span className="so-num" data-current={walking && section === 6 ? 'true' : undefined} aria-hidden>
            07
          </span>
          <section
            ref={(el) => {
              refs.current[6] = el
            }}
            tabIndex={-1}
            aria-label="What to do next"
            className="so-next"
          >
            <div className="so-next-card">
              <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
                Next · Try it
              </span>
              <h3>Make my own copy</h3>
              <p>The base case, named after you, with no runs. The six exercises happen there, and the fourth asks you to predict before you run.</p>
              <Button onClick={copy} busy={copying}>
                Make my own copy
              </Button>
            </div>
            <div className="so-next-card">
              <span className="ds-section-label">Then</span>
              <h3>Start my own project</h3>
              <p>From a bill of materials, a routing or an equipment list, or empty, one tier at a time.</p>
              <Link href="/project/new" className="ds-btn" style={{ alignSelf: 'flex-start' }}>
                + New project
              </Link>
            </div>
            <div className="so-next-card" data-locked={!ownsProject || undefined} aria-disabled={!ownsProject || undefined}>
              <span className="ds-section-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {!ownsProject && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
                {ownsProject ? 'Now' : 'Later'}
              </span>
              <h3>Add people</h3>
              <p>
                {ownsProject
                  ? 'Students and helpers join a project you made. The sample is never shared.'
                  : 'After you start your own project. Students and helpers join a project you made. The sample is never shared.'}
              </p>
              {ownsProject && (
                <Link href="/home" className="ds-link">
                  Open your projects
                </Link>
              )}
            </div>
          </section>
        </li>
      </ol>
    </div>
  )
}

/** "cradle_to_gate" → "Cradle to gate". */
function boundaryWords(b: string): string {
  const w = b.replace(/_/g, ' ').trim()
  return w ? w[0].toUpperCase() + w.slice(1) : w
}

/** "88% rests on one Global average, for steel." → "one Global average factor". */
function sureWhat(sentence: string): string {
  const m = sentence.match(/rests on (.+?)(?:, for |\.$)/)
  const what = m ? m[1] : 'its factors'
  return /^one /.test(what) ? `${what} factor` : what
}
