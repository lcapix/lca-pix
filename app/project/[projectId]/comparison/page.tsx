'use client'

// /project/[id]/comparison: compare a base case with its copies.
//
// Everything comes from one read of /api/projects/[id]/compare: the run each
// case is compared on, its results per functional unit, its current step costs
// and what each copy changes against the base. The views follow what LCA tools
// put side by side: what differs (openLCA's project variants), results by
// category (absolute, change, relative), where a change comes from, hotspots,
// cost against impact, and data quality.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB } from '@/lib/data-transformers'
import { totalOf } from '@/lib/compare/analytics'
import { HelpTip } from '@/components/lcapix/help-tip'
import { Breadcrumb, Icon, fmtInt, fmtNum } from '@/components/lcapix'
import type { CompareCase, CompareResponse } from '@/components/lcapix/compare/types'
import { BAD, GOOD, SelectBox, seriesColor, signedPct } from '@/components/lcapix/compare/ui'
import { WhatDiffersPanel } from '@/components/lcapix/compare/what-differs'
import { ResultsPanel } from '@/components/lcapix/compare/results-panel'
import { ChangePanel } from '@/components/lcapix/compare/change-panel'
import { HotspotPanel } from '@/components/lcapix/compare/hotspot-panel'
import { CostPanel } from '@/components/lcapix/compare/cost-panel'
import { QualityPanel } from '@/components/lcapix/compare/quality-panel'

interface CaseSummary {
  id: string
  name: string
  type: 'base' | 'comparative'
}

type Tab = 'differs' | 'results' | 'change' | 'hotspots' | 'cost' | 'quality'

const TABS: Array<{ id: Tab; label: string; help: string }> = [
  { id: 'differs', label: 'What differs', help: 'What each copy changes against the base: run settings, exchanges, steps and costs.' },
  { id: 'results', label: 'Results', help: 'Every impact category side by side, as values, as change against the base, or relative.' },
  { id: 'change', label: 'Where the change comes from', help: 'The difference against the base, split by step or by material.' },
  { id: 'hotspots', label: 'Hotspots', help: 'The steps or materials that carry the largest shares of each case.' },
  { id: 'cost', label: 'Cost', help: 'Cost by kind, and what each change costs against what it saves.' },
  { id: 'quality', label: 'Data quality', help: 'Sources, fallbacks and gaps behind each run, so the comparison is fair.' },
]

const unique = <T,>(xs: T[]) => Array.from(new Set(xs))

export default function ComparisonPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  // Seeds the selection from the URL once; after that the chips own it.
  const initedRef = useRef(false)

  const [projectName, setProjectName] = useState('')
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [runPicks, setRunPicks] = useState<Record<string, number>>({})
  const [data, setData] = useState<CompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [tab, setTab] = useState<Tab>('differs')
  const [category, setCategory] = useState('Global Warming')

  // Returning from a fresh run re-reads the comparison.
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const onFocus = () => setRefreshTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Project name and its cases.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      try {
        const [pr, cr] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/projects/${projectId}/cases`),
        ])
        const pd = await pr.json()
        const cd = await cr.json()
        if (cancelled) return
        if (pd.success) setProjectName(pd.project?.project_name ?? '')
        const list: CaseSummary[] = (cd.cases ?? []).map((c: any) => {
          const t = transformCaseFromDB(c)
          return { id: t.id, name: t.name, type: t.type }
        })
        // Base cases first, then copies in the order they were made.
        list.sort((a, b) => (a.type === b.type ? Number(a.id) - Number(b.id) : a.type === 'base' ? -1 : 1))
        setCases(list)
        if (!initedRef.current) {
          initedRef.current = true
          const urlIds = new Set((new URLSearchParams(window.location.search).get('cases') ?? '').split(',').filter(Boolean))
          const fromUrl = list.filter((c) => urlIds.has(c.id))
          const ids = new Set<string>()
          const base = list.find((c) => c.type === 'base')
          if (base) ids.add(base.id)
          if (fromUrl.length) fromUrl.forEach((c) => ids.add(c.id))
          else list.filter((c) => c.type === 'comparative').forEach((c) => ids.add(c.id))
          setSelected(ids)
        }
      } catch {
        if (!cancelled) setError('Could not load the cases.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // The comparison itself.
  const selectedIds = useMemo(
    () => cases.filter((c) => selected.has(c.id)).map((c) => c.id),
    [cases, selected],
  )
  useEffect(() => {
    if (!selectedIds.length) {
      setData(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setIsLoadingData(true)
      setError(null)
      try {
        const runs = Object.entries(runPicks)
          .filter(([id]) => selectedIds.includes(id))
          .map(([id, run]) => `${id}:${run}`)
          .join(',')
        const r = await apiRequest(
          `/api/projects/${projectId}/compare?cases=${selectedIds.join(',')}${runs ? `&runs=${runs}` : ''}`,
        )
        const d = await r.json()
        if (cancelled) return
        if (!r.ok || !d.success) {
          setError(d?.error || 'Could not compare these cases.')
          setData(null)
        } else {
          setData(d)
        }
      } catch {
        if (!cancelled) setError('Could not compare these cases.')
      } finally {
        if (!cancelled) setIsLoadingData(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, selectedIds, runPicks, refreshTick])

  // Keep the URL shareable.
  useEffect(() => {
    if (!cases.length) return
    const url = selectedIds.length
      ? `/project/${projectId}/comparison?cases=${selectedIds.join(',')}`
      : `/project/${projectId}/comparison`
    window.history.replaceState(null, '', url)
  }, [selectedIds, projectId, cases.length])

  const compared: CompareCase[] = data?.cases ?? []
  const base = compared.find((c) => c.caseId === data?.baseCaseId) ?? compared[0]

  const categories = useMemo(
    () => unique(compared.flatMap((c) => c.totals.map((t) => t.category))),
    [compared],
  )
  useEffect(() => {
    if (categories.length && !categories.includes(category)) setCategory(categories[0])
  }, [categories, category])

  const basis = useMemo(() => {
    const withRun = compared.filter((c) => c.run)
    const methods = unique(withRun.map((c) => c.run!.method ?? '')).filter(Boolean)
    const regions = unique(withRun.map((c) => c.run!.region ?? '')).filter(Boolean)
    const fus = unique(withRun.map((c) => (c.run!.functionalUnit ?? '').trim())).filter(Boolean)
    return {
      count: withRun.length,
      methods,
      regions,
      fus,
      methodMismatch: methods.length > 1,
      regionMismatch: regions.length > 1,
      fuMismatch: fus.length > 1,
      fuUnrecorded: withRun.some((c) => !c.run!.functionalUnit),
    }
  }, [compared])

  const unit = base?.totals.find((t) => t.category === category)?.unit ?? ''

  const verdict = useMemo(() => {
    if (!base?.run || basis.methodMismatch || basis.fuMismatch) return null
    const copies = compared.filter((c) => c.caseId !== base.caseId && c.run)
    if (!copies.length) return null
    const baseValue = totalOf(base, category)
    if (!(baseValue > 0)) return null
    const best = copies.reduce((a, b) => (totalOf(b, category) < totalOf(a, category) ? b : a))
    const bestValue = totalOf(best, category)
    return { best, pct: ((bestValue - baseValue) / baseValue) * 100, lower: bestValue < baseValue }
  }, [compared, base, basis, category])

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          { label: projectName || 'Project', onClick: () => router.push(`/project/${projectId}`) },
          { label: 'Compare cases' },
        ]}
      />
      <div style={{ padding: '8px 32px 80px', maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => router.push(`/project/${projectId}`)}
            aria-label="Back to project"
            style={{ padding: '6px 10px' }}
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="display-md" style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Compare cases
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{projectName}</div>
          </div>
        </div>

        {/* Case picker */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            Cases in the comparison
            <HelpTip label="How does the comparison work?">
              The base case is the reference: every change is measured against it. Add the copies you made from it,
              each with one change, and read what differs and what it does to the result.
            </HelpTip>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>
              <Loader2 className="animate-spin" size={14} /> Loading cases…
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {cases.map((c) => {
                const on = selected.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.id)) next.delete(c.id)
                        else next.add(c.id)
                        return next
                      })
                    }
                    aria-pressed={on}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 999,
                      border: on
                        ? '1px solid color-mix(in oklab, var(--brand-primary) 60%, transparent)'
                        : '1px solid var(--border-subtle)',
                      background: on ? 'color-mix(in oklab, var(--brand-primary) 10%, var(--surface-raised))' : 'var(--surface-raised)',
                      color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {on && <Icon name="check" size={12} style={{ color: 'var(--brand-primary)' }} />}
                    <span style={{ fontWeight: on ? 500 : 400 }}>{c.name}</span>
                    <span className="eyebrow" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
                      {c.type === 'base' ? 'BASE' : 'COPY'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="card" style={{ padding: 14, marginBottom: 16, color: BAD, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!selectedIds.length ? (
          <EmptyState title="Pick at least one case" body="Use the chips above to choose which cases to compare." />
        ) : isLoadingData && !data ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            <Loader2 className="animate-spin" size={18} style={{ display: 'inline-block', marginRight: 8 }} />
            Comparing…
          </div>
        ) : !data || !base ? null : (
          <div style={{ opacity: isLoadingData ? 0.6 : 1, transition: 'opacity 150ms' }}>
            {/* Scope */}
            {basis.count >= 2 && (basis.methodMismatch || basis.fuMismatch) ? (
              <div className="card" style={{ marginBottom: 16, padding: '12px 16px', borderLeft: '3px solid var(--signal-warn)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Not a valid comparison yet</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {basis.methodMismatch && <>These runs use different LCIA methods ({basis.methods.join(', ')}). Re-run every case under one method. </>}
                  {basis.fuMismatch && <>They were computed per different functional units ({basis.fus.join(' vs ')}). Re-run them after setting one functional unit.</>}
                </div>
              </div>
            ) : basis.count >= 1 ? (
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span className="chip" style={{ fontSize: 11 }}>Method: {basis.methods.join(', ') || '—'}</span>
                <span className="chip" style={{ fontSize: 11 }}>
                  {basis.regionMismatch ? 'Regions' : 'Region'}: {basis.regions.join(', ') || '—'}
                </span>
                <span className="chip" style={{ fontSize: 11 }}>Per: {basis.fus[0] ?? 'functional unit not recorded'}</span>
                <span>
                  {basis.fuUnrecorded
                    ? 'At least one run has no functional unit recorded, so its values are raw case totals. Re-run after setting goal & scope.'
                    : basis.regionMismatch
                      ? 'Same functional unit and method; the runs used different regions, so a difference between them includes the electricity grid.'
                      : 'Same functional unit, method and region.'}
                  {basis.regionMismatch && !basis.fuUnrecorded && (
                    <HelpTip label="Why does the region matter?">
                      A run&apos;s region picks its electricity factor (US, EU or Global grid mix). Comparing across
                      regions is right when the grid is the change you are testing. If it is not, re-run the cases on
                      one region so a grid change does not hide inside another change. Each card shows its run&apos;s region.
                    </HelpTip>
                  )}
                </span>
              </div>
            ) : null}

            {/* Case cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
                gap: 12,
                marginBottom: 16,
              }}
            >
              {compared.map((c, i) => (
                <CaseCard
                  key={c.caseId}
                  c={c}
                  color={seriesColor(i)}
                  base={base}
                  category={category}
                  unit={unit}
                  regionMismatch={basis.regionMismatch}
                  projectId={projectId}
                  onPickRun={(runId) => setRunPicks((p) => ({ ...p, [c.caseId]: runId }))}
                />
              ))}
            </div>

            {verdict && (
              <div
                className="card"
                style={{
                  padding: '12px 16px',
                  marginBottom: 16,
                  background: 'linear-gradient(135deg, var(--brand-subtle), transparent 70%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 13.5,
                }}
              >
                <Icon name="target" size={18} style={{ color: 'var(--brand-primary)' }} />
                {verdict.lower ? (
                  <span>
                    Lowest {category}: <strong style={{ color: 'var(--brand-primary)' }}>{verdict.best.name}</strong>,{' '}
                    <span className="mono" style={{ fontWeight: 600 }}>{signedPct(verdict.pct, 1)}</span> against {base.name}.
                  </span>
                ) : (
                  <span>No copy has a lower {category} than {base.name}.</span>
                )}
              </div>
            )}

            {/* Where to go after reading the comparison. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '10px 14px',
                marginBottom: 16,
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-raised)',
                fontSize: 12.5,
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Next</span>
              <Link href={`/project/${projectId}`} className="btn btn-ghost btn-sm">
                Duplicate the base to test another change
              </Link>
              {base?.run && (
                <Link href={`/project/${projectId}/case/${base.caseId}/results`} className="btn btn-ghost btn-sm">
                  Export a report
                </Link>
              )}
              <span style={{ color: 'var(--text-tertiary)' }}>
                Change one thing per copy, so each difference has one cause.
              </span>
            </div>

            {/* Analysis */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div role="tablist" aria-label="Comparison views" style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {TABS.map((t) => {
                  const on = t.id === tab
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      title={t.help}
                      onClick={() => setTab(t.id)}
                      style={{
                        padding: '9px 12px',
                        border: 'none',
                        borderBottom: on ? '2px solid var(--brand-primary)' : '2px solid transparent',
                        background: 'transparent',
                        color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontWeight: on ? 600 : 400,
                        fontSize: 13,
                        fontFamily: 'var(--font-ui)',
                        cursor: 'pointer',
                        marginBottom: -1,
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ flex: 1 }} />
              {categories.length > 1 && tab !== 'results' && tab !== 'quality' && (
                <div style={{ paddingBottom: 6 }}>
                  <SelectBox
                    label="Impact category"
                    value={category}
                    onChange={setCategory}
                    options={categories.map((k) => ({ value: k, label: k }))}
                  />
                </div>
              )}
            </div>

            {tab === 'differs' && (
              <WhatDiffersPanel base={base} cases={compared} diffs={data.diffs} category={category} />
            )}
            {tab === 'results' && <ResultsPanel cases={compared} baseId={base.caseId} />}
            {tab === 'change' && <ChangePanel base={base} cases={compared} category={category} />}
            {tab === 'hotspots' && <HotspotPanel cases={compared} category={category} />}
            {tab === 'cost' && <CostPanel base={base} cases={compared} diffs={data.diffs} category={category} />}
            {tab === 'quality' && <QualityPanel base={base} cases={compared} />}
          </div>
        )}
      </div>
    </>
  )
}

function CaseCard({
  c,
  color,
  base,
  category,
  unit,
  regionMismatch,
  projectId,
  onPickRun,
}: {
  c: CompareCase
  color: string
  base: CompareCase
  category: string
  unit: string
  regionMismatch: boolean
  projectId: string
  onPickRun: (runId: number) => void
}) {
  const isBase = c.caseId === base.caseId
  const value = c.run ? totalOf(c, category) : null
  const baseValue = base.run ? totalOf(base, category) : null
  const delta = !isBase && value !== null && baseValue ? ((value - baseValue) / baseValue) * 100 : null
  const latest = c.runs[0]
  const reasonText =
    c.run && latest && latest.runId !== c.run.runId
      ? c.run.reason === 'matches-copies'
        ? `Compared on run #${c.run.runId} (${c.run.region}) to match the copies. The latest run is #${latest.runId} (${latest.region}).`
        : c.run.reason === 'matches-study'
          ? `Compared on run #${c.run.runId}, the study's method and region. The latest run is #${latest.runId} (${latest.region}).`
          : c.run.reason === 'picked'
            ? `Compared on run #${c.run.runId}, picked here. The latest run is #${latest.runId}.`
            : null
      : null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: `color-mix(in oklab, ${color} 12%, var(--surface-raised))`,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flex: 'none' }} />
        <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
          {c.name}
        </span>
        <span style={{ flex: 1 }} />
        {regionMismatch && c.run?.region && (
          <span className="chip" style={{ fontSize: 10, padding: '2px 8px' }} title={`This run used the ${c.run.region} region`}>
            {c.run.region}
          </span>
        )}
        <span className="chip" style={{ fontSize: 10, padding: '2px 8px' }}>
          {isBase ? 'BASE' : 'COPY'}
        </span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>
          {category}
        </div>
        {value === null ? (
          <div style={{ fontSize: 13, color: BAD, padding: '6px 0' }}>
            Not run yet.{' '}
            <Link href={`/project/${projectId}/case/${c.caseId}`} style={{ color: 'var(--brand-primary)' }}>
              Open the case
            </Link>{' '}
            and run it.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {fmtNum(value, 2)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{unit}</span>
            {delta !== null && (
              <span
                className="mono"
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                  color: delta <= 0 ? GOOD : BAD,
                  background: delta <= 0 ? 'color-mix(in oklab, #16a34a 14%, transparent)' : 'color-mix(in oklab, #d98568 18%, transparent)',
                }}
              >
                {signedPct(delta, 2)}
              </span>
            )}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
          {fmtInt(c.inventory.steps)} nodes · {fmtInt(c.inventory.flows)} flows
          {c.run && (
            <>
              {' · '}
              <Link href={`/project/${projectId}/case/${c.caseId}/results`} style={{ color: 'var(--brand-primary)' }}>
                Results
              </Link>
            </>
          )}
        </div>
        {c.runs.length > 0 && c.run && (
          <div style={{ marginTop: 8 }}>
            <select
              className="input"
              aria-label={`Run used for ${c.name}`}
              value={c.run.runId}
              onChange={(e) => onPickRun(Number(e.target.value))}
              style={{ height: 28, fontSize: 11.5, padding: '0 6px', width: '100%' }}
            >
              {c.runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  Run #{r.runId} · {r.method} · {r.region} · {new Date(r.runDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </option>
              ))}
            </select>
          </div>
        )}
        {reasonText && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>{reasonText}</div>}
        {c.run?.stale && (
          <div style={{ fontSize: 11.5, color: BAD, marginTop: 6 }}>Edited after this run. Re-run it for current numbers.</div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{body}</div>
    </div>
  )
}
