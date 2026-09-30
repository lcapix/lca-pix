'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/lcapix'
import { fmtSig } from '@/components/lcapix/formatters'
import { useStreamText } from '@/lib/hooks/use-stream-text'
import { consultantRead, stepLabel, type ConsultantItem } from '@/lib/insights/consultant'

interface Contributor {
  id: string
  name: string
  pct: number
  value: number
}

interface ImpactValue {
  value: number
  unit: string
}

interface ComponentImpact {
  category_name: string
  impact_value: number
  unit: string
}

interface ComponentBreakdownEntry {
  component_id: string | number
  component_name: string
  impacts: ComponentImpact[]
}

interface MagicInsightsModalProps {
  open: boolean
  onClose: () => void
  caseName: string
  method: string
  /** All impact category totals (key = category name). */
  impacts?: Record<string, ImpactValue>
  /** Per-component breakdown so we can compute contributors per category. */
  componentBreakdown?: ComponentBreakdownEntry[]
  /** Per-flow impacts (category, substance, step): names the lever by material. */
  materialBreakdown?: Array<{ category_name: string; name: string; value: number; step: string; tier?: string | null }>
  totalCost?: number
  /** Each step's cost columns, so cost can be set against impact step by step. */
  stepCosts?: Array<{ id: string; name: string; labor: number; material: number; energy: number; other: number }>
  /** Initially active category (e.g. the one selected on the results page). */
  initialCategory?: string
  projectId: string
  caseId: string
}

type ChipId = 'summary' | 'reduce' | 'tradeoff' | 'base' | 'custom'

interface InsightChip {
  id: ChipId
  label: string
  icon: 'sparkle' | 'arrow-down' | 'dollar' | 'layers' | 'message'
}

const OVERALL_KEY = '__overall__'
const OVERALL_LABEL = 'Overall environmental load'

export function MagicInsightsModal({
  open,
  onClose,
  caseName,
  method,
  impacts,
  componentBreakdown,
  materialBreakdown,
  totalCost,
  stepCosts,
  initialCategory,
  projectId,
  caseId,
}: MagicInsightsModalProps) {
  // Available category options (real categories + an "overall" option).
  const categoryOptions = useMemo(() => {
    const real = impacts ? Object.keys(impacts) : []
    return [{ key: OVERALL_KEY, label: OVERALL_LABEL }, ...real.map((k) => ({ key: k, label: k }))]
  }, [impacts])

  const [activeChip, setActiveChip] = useState<ChipId>('summary')
  const [reducePct, setReducePct] = useState<number>(20)
  const [reducePctInput, setReducePctInput] = useState<string>('20')
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory && impacts?.[initialCategory] ? initialCategory : OVERALL_KEY,
  )
  const [prompt, setPrompt] = useState<string>('')
  const [submittedPrompt, setSubmittedPrompt] = useState<string>('')

  // AI narration mode (open model via Hugging Face). Off by default: the
  // deterministic computed insight is the always-available baseline and the
  // automatic fallback whenever no model key is configured or a call fails.
  const [aiMode, setAiMode] = useState<boolean>(false)
  const [aiText, setAiText] = useState<string>('')
  const [aiStatus, setAiStatus] = useState<'idle' | 'streaming' | 'done' | 'fallback'>('idle')
  const [aiModel, setAiModel] = useState<string>('')

  // Reset state when the modal re-opens with new context.
  useEffect(() => {
    if (open) {
      setActiveChip('summary')
      setReducePct(20)
      setReducePctInput('20')
      setSelectedCategory(
        initialCategory && impacts?.[initialCategory] ? initialCategory : OVERALL_KEY,
      )
      setPrompt('')
      setSubmittedPrompt('')
      setAiText('')
      setAiStatus('idle')
    }
  }, [open, initialCategory, impacts])

  // Resolve the active category, its unit, and the contributors under it.
  const { activeLabel, activeUnit, activeTotal, contributors, stepShares } = useMemo(() => {
    if (selectedCategory === OVERALL_KEY) {
      // "Overall" = sum of per-category normalized loads. We approximate "overall"
      // by treating each category equally and summing each component's share
      // across categories. (The real tool does proper EPS weighting; this view
      // is an at-a-glance heuristic.)
      const perComp = new Map<string, { name: string; value: number }>()
      ;(componentBreakdown ?? []).forEach((c) => {
        const id = String(c.component_id)
        let total = 0
        c.impacts.forEach((i) => {
          const catTotal = impacts?.[i.category_name]?.value
          if (catTotal && catTotal > 0 && i.impact_value > 0) {
            total += i.impact_value / catTotal
          }
        })
        if (total > 0) {
          perComp.set(id, { name: c.component_name, value: total })
        }
      })
      const sorted = Array.from(perComp.entries())
        .map(([id, v]) => ({ id, name: v.name, value: v.value }))
        .sort((a, b) => b.value - a.value)
      const sum = sorted.reduce((s, c) => s + c.value, 0) || 1
      const contribs: Contributor[] = sorted.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        value: c.value,
        pct: (c.value / sum) * 100,
      }))
      return {
        activeLabel: OVERALL_LABEL,
        activeUnit: 'normalized share',
        activeTotal: undefined as number | undefined,
        contributors: contribs,
        stepShares: new Map(sorted.map((c) => [c.id, (c.value / sum) * 100])),
      }
    }

    const catTotal = impacts?.[selectedCategory]?.value
    const catUnit = impacts?.[selectedCategory]?.unit ?? ''
    const rows = (componentBreakdown ?? [])
      .map((c) => {
        const match = c.impacts.find((i) => i.category_name === selectedCategory)
        return {
          id: String(c.component_id),
          name: c.component_name,
          value: match?.impact_value ?? 0,
        }
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
    const sum = rows.reduce((s, c) => s + c.value, 0) || 1
    const contribs: Contributor[] = rows.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      value: c.value,
      pct: (c.value / sum) * 100,
    }))
    return {
      activeLabel: selectedCategory,
      activeUnit: catUnit,
      activeTotal: catTotal,
      contributors: contribs,
      stepShares: new Map(rows.map((c) => [c.id, (c.value / sum) * 100])),
    }
  }, [selectedCategory, impacts, componentBreakdown])

  // The same result grouped by material (one material can sit on several
  // steps). This is the lever to name: a step only books where a part is used.
  const materials = useMemo(() => {
    if (!materialBreakdown?.length || selectedCategory === OVERALL_KEY) return []
    const by = new Map<string, { value: number; steps: Set<string> }>()
    for (const f of materialBreakdown) {
      if (f.category_name !== selectedCategory || !(f.value > 0)) continue
      const e = by.get(f.name) ?? { value: 0, steps: new Set<string>() }
      e.value += f.value
      e.steps.add(f.step)
      by.set(f.name, e)
    }
    const sum = [...by.values()].reduce((s, e) => s + e.value, 0) || 1
    return [...by.entries()]
      .map(([name, e]) => ({ name, value: e.value, pct: (e.value / sum) * 100, steps: e.steps.size }))
      .sort((a, b) => b.value - a.value)
  }, [materialBreakdown, selectedCategory])

  // What a sustainability consultant would look at first, triggered by this
  // run's own flows for the selected category (levers, not numbers).
  const consultant = useMemo(() => {
    if (!materialBreakdown?.length || selectedCategory === OVERALL_KEY) return []
    return consultantRead(
      materialBreakdown
        .filter((f) => f.category_name === selectedCategory)
        .map((f) => ({ name: f.name, value: f.value, step: f.step, tier: f.tier ?? null })),
      { categoryLabel: selectedCategory },
    )
  }, [materialBreakdown, selectedCategory])

  // Cost set against impact: the case's cost split by kind, and each step's
  // share of cost next to its share of the selected category.
  const costView = useMemo(() => {
    const steps = stepCosts ?? []
    const sums = { material: 0, labor: 0, energy: 0, other: 0 }
    for (const c of steps) {
      for (const k of ['material', 'labor', 'energy', 'other'] as const) sums[k] += c[k] > 0 ? c[k] : 0
    }
    const total = sums.material + sums.labor + sums.energy + sums.other
    if (!(total > 0)) return null
    const pctOf = (v: number) => (v / total) * 100
    return {
      split: {
        material: pctOf(sums.material),
        labor: pctOf(sums.labor),
        energy: pctOf(sums.energy),
        other: pctOf(sums.other),
      },
      steps: steps
        .map((c) => ({
          id: c.id,
          name: c.name,
          costPct: pctOf(c.labor + c.material + c.energy + c.other),
          impactPct: stepShares.get(c.id) ?? 0,
        }))
        .filter((st) => st.costPct > 0 || st.impactPct > 0)
        .sort((a, b) => b.impactPct - a.impactPct),
    }
  }, [stepCosts, stepShares])

  // Questions this case can actually answer, for the free-text box.
  const exampleQs = [
    `Can we cut ${selectedCategory === OVERALL_KEY ? 'the footprint' : activeLabel} by 30%?`,
    materials[0] ? `What if the ${materials[0].name.toLowerCase()} were recycled?` : 'What drives this result?',
  ]

  const CHIPS: InsightChip[] = [
    { id: 'summary', label: 'Summary', icon: 'sparkle' },
    { id: 'reduce', label: `Reduce environmental load by X%`, icon: 'arrow-down' },
    { id: 'tradeoff', label: 'Cost vs environmental load trade-off', icon: 'dollar' },
    { id: 'base', label: 'Compare to base', icon: 'layers' },
    { id: 'custom', label: 'Ask anything', icon: 'message' },
  ]

  const insightText = useMemo(() => {
    const top = contributors[0]
    const second = contributors[1]
    const totalStr =
      activeTotal !== undefined
        ? `${fmtSig(activeTotal)} ${activeUnit}`
        : 'an indicative overall load'
    const costStr = totalCost !== undefined ? `$${totalCost.toLocaleString()}` : '—'
    const loadLabel = selectedCategory === OVERALL_KEY ? 'environmental load' : activeLabel

    switch (activeChip) {
      case 'summary': {
        const m0 = materials[0]
        const byMaterial = m0
          ? ` By material, {{${m0.name}}} makes up {{${m0.pct.toFixed(1)}%}} of it, across ${m0.steps} step${m0.steps === 1 ? '' : 's'}: that is the biggest lever.`
          : ''
        return `Your ${caseName} assessment under ${method} totals {{${totalStr}}} for {{${loadLabel}}} at {{${costStr}}}.${byMaterial} By step, {{${top ? stepLabel(top.name) : 'your top step'}}} carries the most ({{${top?.pct.toFixed(1) ?? '—'}%}}), and the top two steps account for {{${((top?.pct ?? 0) + (second?.pct ?? 0)).toFixed(1)}%}}.`
      }

      case 'reduce': {
        const topShare = top?.pct ?? 0
        if (!top) {
          return `No contributor data yet for {{${loadLabel}}}. Run an assessment with this category enabled to get reduce-by-${reducePct}% guidance.`
        }
        // A material that spans several steps is the real lever.
        const m0 = materials[0]
        if (m0 && m0.pct >= topShare) {
          const need = Math.min(100, Math.ceil(reducePct / (m0.pct / 100 || 1)))
          return reducePct > m0.pct
            ? `Cutting {{${loadLabel}}} by {{${reducePct}%}} is more than {{${m0.name}}} carries ({{${m0.pct.toFixed(1)}%}}), though it is the biggest share. It takes changes to several materials, or a different design.`
            : `To cut {{${loadLabel}}} by {{${reducePct}%}}, start with {{${m0.name}}}: it is {{${m0.pct.toFixed(1)}%}} of the load, across ${m0.steps} step${m0.steps === 1 ? '' : 's'}. A {{${need}%}} cut in its footprint gets you there: use less of it, a lower-carbon grade, or another material. Duplicate the case, swap it on the step${m0.steps === 1 ? '' : 's'} that use${m0.steps === 1 ? 's' : ''} it, and run both.`
        }
        // If the target exceeds what's practically achievable on the top
        // contributor, say so plainly — that's the "magic" the user asked for.
        if (reducePct > topShare) {
          return `Cutting {{${loadLabel}}} by {{${reducePct}%}} is more than any one step carries: the largest, {{${stepLabel(top.name)}}}, is {{${topShare.toFixed(1)}%}}. It takes changes on several steps, or a different design. Open each step to see which flow drives it, and test every change on a copy of the case.`
        }
        const requiredOnTop = Math.min(100, Math.ceil(reducePct / (topShare / 100 || 1)))
        return `To cut {{${loadLabel}}} by {{${reducePct}%}}, start with {{${stepLabel(top.name)}}}: it carries {{${topShare.toFixed(1)}%}} of the load, so a {{${requiredOnTop}%}} cut on that step alone reaches the target. Open it to see which material or energy flow drives it, then use less of that flow, a lower-carbon grade or supplier, or a redesigned step.${second ? ` If that step cannot change, {{${stepLabel(second.name)}}} is next.` : ''}`
      }

      case 'tradeoff':
        return tradeoffText({ loadLabel, costStr, top, materials, costView })

      case 'base':
        return baseText({ loadLabel, top, materials })

      case 'custom': {
        if (!submittedPrompt.trim()) {
          return `Type a question in the box, for example "${exampleQs[0]}" or "${exampleQs[1]}". The answer comes from this case's result only.`
        }
        return answerFreeText({
          question: submittedPrompt,
          loadLabel,
          top,
          totalStr,
          material: materials[0],
          levers: consultant,
        })
      }
    }
  }, [
    activeChip,
    caseName,
    method,
    activeLabel,
    activeUnit,
    activeTotal,
    selectedCategory,
    totalCost,
    contributors,
    materials,
    consultant,
    costView,
    reducePct,
    submittedPrompt,
  ])

  const { value: streamed, done } = useStreamText(insightText)

  // When AI mode is on, stream a grounded narration from the open model for the
  // current facts. Re-runs whenever the facts change (chip/category/target/
  // question). Any failure or missing key degrades silently to the computed
  // insight — the AI path is strictly additive.
  useEffect(() => {
    if (!open || !aiMode) return
    // 'custom' with no submitted question: nothing to narrate yet.
    if (activeChip === 'custom' && !submittedPrompt.trim()) {
      setAiText('')
      setAiStatus('idle')
      return
    }
    const controller = new AbortController()
    const facts = {
      caseName,
      method,
      categoryLabel: activeLabel,
      total: activeTotal !== undefined ? { value: activeTotal, unit: activeUnit } : undefined,
      totalCost,
      contributors: contributors.map((c) => ({ name: c.name, pct: c.pct, value: c.value })),
      materials: materials.slice(0, 5).map((m) => ({ name: m.name, pct: m.pct, value: m.value })),
      levers: consultant.map((c) => ({ title: c.title, why: c.why, moves: c.moves })),
      costSplit: costView
        ? [
            { name: 'Purchased material', pct: costView.split.material },
            { name: 'Labor', pct: costView.split.labor },
            { name: 'Energy', pct: costView.split.energy },
            { name: 'Other', pct: costView.split.other },
          ].filter((c) => c.pct > 0)
        : undefined,
      stepCosts: costView?.steps.slice(0, 6).map((st) => ({ name: st.name, costPct: st.costPct, impactPct: st.impactPct })),
      mode: activeChip,
      reducePct: activeChip === 'reduce' ? reducePct : undefined,
      question: activeChip === 'custom' ? submittedPrompt : undefined,
      // Full impact profile (every category), so the model can reason across
      // categories instead of only restating the one on screen.
      allCategories: impacts
        ? Object.entries(impacts).map(([name, v]) => ({ name, value: v.value, unit: v.unit }))
        : [],
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    setAiText('')
    setAiStatus('streaming')
    ;(async () => {
      try {
        const res = await fetch('/api/insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify(facts),
          signal: controller.signal,
        })
        const ct = res.headers.get('content-type') || ''
        // JSON response = fallback signal (no key / upstream error).
        if (ct.includes('application/json')) {
          setAiStatus('fallback')
          return
        }
        setAiModel(res.headers.get('x-insights-model') || '')
        const reader = res.body?.getReader()
        if (!reader) {
          setAiStatus('fallback')
          return
        }
        const decoder = new TextDecoder()
        let acc = ''
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done: rdone, value } = await reader.read()
          if (rdone) break
          acc += decoder.decode(value, { stream: true })
          setAiText(acc)
        }
        setAiStatus(acc.trim() ? 'done' : 'fallback')
      } catch (e: any) {
        if (e?.name !== 'AbortError') setAiStatus('fallback')
      }
    })()
    return () => controller.abort()
  }, [
    open,
    aiMode,
    activeChip,
    selectedCategory,
    reducePct,
    submittedPrompt,
    caseName,
    method,
    activeLabel,
    activeUnit,
    activeTotal,
    totalCost,
    contributors,
  ])

  // What actually renders: AI narration when in AI mode and it produced text,
  // otherwise the deterministic computed insight (also the fallback).
  const usingAI = aiMode && aiStatus !== 'fallback' && (aiStatus === 'streaming' || aiStatus === 'done')
  const bodyText = usingAI ? aiText : streamed
  const showCursor = usingAI ? aiStatus === 'streaming' : !done

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'fadeIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card bloom-in"
        style={{
          width: 680,
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflow: 'auto',
          padding: 0,
          background: 'var(--surface-raised)',
          boxShadow:
            '0 20px 60px -20px rgba(15,23,42,0.35), 0 0 0 1px rgba(15,23,42,0.06)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 14px',
            background:
              'linear-gradient(135deg, oklch(from var(--brand-primary) l c h / 0.08), oklch(from var(--brand-primary) l c h / 0.02))',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--brand-gradient)',
                color: 'var(--on-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="sparkle" size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Magic Insights
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}
              >
                {caseName} · {method}
              </div>
            </div>
            {/* Computed ↔ AI toggle. Computed is the deterministic baseline;
                AI narrates the same figures via an open model. */}
            <div
              role="group"
              aria-label="Insight mode"
              style={{
                display: 'inline-flex',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {([
                { id: false, label: 'Computed' },
                { id: true, label: 'AI' },
              ] as const).map((opt) => {
                const on = aiMode === opt.id
                return (
                  <button
                    key={String(opt.id)}
                    type="button"
                    onClick={() => setAiMode(opt.id)}
                    aria-pressed={on}
                    style={{
                      padding: '5px 12px',
                      fontSize: 11.5,
                      fontWeight: on ? 600 : 500,
                      border: 'none',
                      cursor: 'pointer',
                      background: on ? 'var(--brand-primary)' : 'transparent',
                      color: on ? 'var(--on-primary)' : 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {opt.id === true && <Icon name="sparkle" size={11} />}
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="press-active"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 6,
                borderRadius: 6,
                display: 'inline-flex',
              }}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Category selector — operate across ALL impact categories. */}
          {categoryOptions.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="eyebrow"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                Impact category
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-base)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                }}
              >
                {categoryOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action chips */}
        <div
          style={{
            padding: '14px 24px 0',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {CHIPS.map((c) => {
            const active = activeChip === c.id
            // Render the reduce chip with the user-editable percentage in place of "X".
            const label =
              c.id === 'reduce'
                ? `Reduce environmental load by ${reducePct}%`
                : c.label
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveChip(c.id)}
                className="press-active"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: active
                    ? '1px solid var(--brand-primary)'
                    : '1px solid var(--border-subtle)',
                  background: active
                    ? 'oklch(from var(--brand-primary) l c h / 0.10)'
                    : 'var(--surface-raised)',
                  color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 180ms',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <Icon name={c.icon as any} size={12} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Reduce % input — only visible when the reduce chip is active. */}
        {activeChip === 'reduce' && (
          <div
            style={{
              padding: '12px 24px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Reduce target
            </span>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={reducePctInput}
              onChange={(e) => {
                setReducePctInput(e.target.value)
                const n = parseFloat(e.target.value)
                if (!Number.isNaN(n)) {
                  setReducePct(Math.max(1, Math.min(100, Math.round(n))))
                }
              }}
              style={{
                width: 72,
                fontSize: 13,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-base)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                textAlign: 'right',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>%</span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
              {[10, 20, 30, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setReducePct(preset)
                    setReducePctInput(String(preset))
                  }}
                  className="press-active"
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--border-subtle)',
                    background:
                      reducePct === preset
                        ? 'oklch(from var(--brand-primary) l c h / 0.10)'
                        : 'transparent',
                    color:
                      reducePct === preset
                        ? 'var(--brand-primary)'
                        : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Free-text prompt — only when the custom chip is active. */}
        {activeChip === 'custom' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSubmittedPrompt(prompt)
            }}
            style={{
              padding: '12px 24px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`e.g. "${exampleQs[0]}" or "${exampleQs[1]}"`}
              rows={2}
              style={{
                fontSize: 13,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-base)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                resize: 'vertical',
                minHeight: 48,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!prompt.trim()}
              >
                Ask
              </button>
            </div>
          </form>
        )}

        {/* Streamed body with cited data chips */}
        <div style={{ padding: '20px 24px 8px' }}>
          <div
            key={`${activeChip}-${selectedCategory}-${reducePct}-${submittedPrompt}`}
            style={{
              fontSize: 14,
              color: 'var(--text-primary)',
              lineHeight: 1.65,
            }}
          >
            {renderWithCitations(bodyText, contributors, { projectId, caseId })}
            {showCursor && (
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 14,
                  marginLeft: 2,
                  verticalAlign: '-2px',
                  background: 'var(--brand-primary)',
                  animation: 'fadeIn 600ms ease infinite alternate',
                }}
              />
            )}
          </div>
          {/* Honest provenance line: computed vs AI, and — crucially — that the
              numbers always come from the engine, never the model. */}
          <div style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {usingAI ? (
              <>
                Narrated by <span className="mono">{aiModel || 'an open model'}</span> via Hugging
                Face, grounded on your computed figures — the model phrases the analysis, the
                numbers come from the engine.
              </>
            ) : aiMode && aiStatus === 'fallback' ? (
              <>AI narration unavailable (no model key configured) — showing the computed insight.</>
            ) : (
              <>Computed deterministically from your assessment results. Not AI-generated.</>
            )}
          </div>
        </div>

        {/* What a consultant would look at: levers triggered by this case */}
        {consultant.length > 0 && (
          <div style={{ padding: '4px 24px 6px' }}>
            <div
              className="eyebrow"
              style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 10, marginBottom: 8 }}
            >
              What a sustainability consultant would look at
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {consultant.map((item) => (
                <div
                  key={item.title}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    background: 'var(--surface-raised)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 6px' }}>
                    {item.why}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                    {item.moves.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top contributor mini-list (per active category) */}
        {contributors.length > 0 && (
          <div
            style={{
              padding: '8px 24px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              className="eyebrow"
              style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 14, marginBottom: 8 }}
            >
              Source data — top contributors for {activeLabel}
            </div>
            {contributors.slice(0, 5).map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--surface-overlay)',
                }}
              >
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{c.name}</span>
                <span
                  className="mono"
                  style={{ color: 'var(--text-tertiary)', fontSize: 11 }}
                >
                  {fmtSig(c.value)}
                </span>
                <span
                  className="mono"
                  style={{
                    color: 'var(--brand-primary)',
                    fontWeight: 600,
                    fontSize: 11,
                    minWidth: 42,
                    textAlign: 'right',
                  }}
                >
                  {c.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface-base)',
          }}
        >
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Generated locally · not stored
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/project/${projectId}/case/${caseId}`} className="btn btn-secondary btn-sm">
              Open editor
            </Link>
            <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const fmtShare = (p: number) => (p > 0 && p < 0.1 ? 'under 0.1%' : `${p.toFixed(1)}%`)
// Flows that are energy or freight rather than a material you buy.
const NOT_MATERIAL = /electric|energy|power|natural gas|diesel|fuel|heat|steam|transport|freight|truck|ship|ocean|rail|\bair\b/i

type MaterialShare = { name: string; pct: number; steps: number }

/**
 * Cost against impact, from the case's own cost columns and this run's
 * shares. Labor carries cost but no flows, so it never moves an impact.
 */
function tradeoffText(args: {
  loadLabel: string
  costStr: string
  top?: Contributor
  materials: MaterialShare[]
  costView: {
    split: { material: number; labor: number; energy: number; other: number }
    steps: Array<{ id: string; name: string; costPct: number; impactPct: number }>
  } | null
}): string {
  const { loadLabel, costStr, top, materials, costView } = args
  if (!top) return `No results yet for {{${loadLabel}}}. Run an assessment first.`
  if (!costView) {
    return `This case has no step costs yet, so there is nothing to set against {{${loadLabel}}}. Add labor, material or energy costs on the steps, then come back.`
  }
  const { split } = costView
  const parts: string[] = [
    `Purchased material is {{${fmtShare(split.material)}}} of the {{${costStr}}} cost, labor {{${fmtShare(split.labor)}}} and energy {{${fmtShare(split.energy)}}}${split.other > 0 ? `, other costs {{${fmtShare(split.other)}}}` : ''}.`,
  ]
  const topStep = costView.steps.find((st) => st.id === top.id)
  if (topStep) {
    parts.push(`By step, {{${stepLabel(top.name)}}} carries {{${top.pct.toFixed(1)}%}} of {{${loadLabel}}} and {{${fmtShare(topStep.costPct)}}} of cost.`)
  }
  const m0 = materials[0]
  const materialImpact = materials.filter((m) => !NOT_MATERIAL.test(m.name)).reduce((sum, m) => sum + m.pct, 0)
  if (m0 && !NOT_MATERIAL.test(m0.name)) {
    parts.push(`{{${m0.name}}} alone is {{${m0.pct.toFixed(1)}%}} of {{${loadLabel}}}, and labor carries none of it: an LCA counts materials, energy and emissions, not hours.`)
    if (split.material >= 50 && materialImpact >= 50) {
      parts.push(`So cost and {{${loadLabel}}} point the same way, at what you buy. The lever is a purchasing one: ask the ${m0.name.toLowerCase()} supplier to price a recycled or lower-carbon grade next to the current one. Cutting shop hours lowers cost but does not move {{${loadLabel}}}.`)
    } else if (split.labor >= 50 && materialImpact >= 50) {
      parts.push(`So cost and {{${loadLabel}}} sit in different places: most of the cost is labor, most of {{${loadLabel}}} is material. Cutting hours lowers cost without moving {{${loadLabel}}}; the {{${loadLabel}}} lever is the ${m0.name.toLowerCase()} you buy.`)
    }
  }
  return parts.join(' ')
}

/** How to compare copies of this case fairly, and which rows will move. */
function baseText(args: { loadLabel: string; top?: Contributor; materials: MaterialShare[] }): string {
  const { loadLabel, top, materials } = args
  if (!top) {
    return `No results yet for {{${loadLabel}}}. Run an assessment first, so copies of this case have something to compare against.`
  }
  const m0 = materials[0]
  const watch =
    m0 && !NOT_MATERIAL.test(m0.name)
      ? `If you swap {{${m0.name}}}, the rows that can move are the ${m0.steps === 1 ? 'step' : `${m0.steps} steps`} that use it ({{${m0.pct.toFixed(1)}%}} of {{${loadLabel}}} in total). The biggest single row is {{${stepLabel(top.name)}}} at {{${top.pct.toFixed(1)}%}}.`
      : `The row most likely to move is {{${stepLabel(top.name)}}}, at {{${top.pct.toFixed(1)}%}} of {{${loadLabel}}}.`
  return `Compare Cases sets copies of this case side by side, step by step. Keep the functional unit, LCIA method and region the same on every copy (the page flags a mismatch), change one thing per copy so each difference has one cause, and run each copy after the change. ${watch} Its What differs tab lists every change, and its Cost tab sets each change's cost against its impact.`
}

/**
 * Local answer to a free-text question, from this case's own result: a
 * reduction target is checked against the biggest share, and anything else is
 * matched to the consultant lever it asks about.
 */
function answerFreeText(args: {
  question: string
  loadLabel: string
  top?: Contributor
  totalStr: string
  material?: MaterialShare
  levers: ConsultantItem[]
}): string {
  const { question, loadLabel, top, totalStr, material, levers } = args
  const q = question.toLowerCase()
  const asked = `For {{"${question}"}}:`
  const close =
    ' To put a number on a change, the case needs a factor for the new option (from the library or a supplier EPD); then duplicate the case, apply it, and run both.'
  const pctMatch = question.match(/(\d{1,3})\s*%/)
  const target = pctMatch ? Math.min(100, parseInt(pctMatch[1], 10)) : undefined

  if (target !== undefined) {
    const lead = material ?? (top ? { name: stepLabel(top.name), pct: top.pct } : undefined)
    if (!lead) return `${asked} there are no results yet for {{${loadLabel}}}. Run an assessment first.`
    if (target > lead.pct) {
      return `${asked} a {{${target}%}} cut to {{${loadLabel}}} (now {{${totalStr}}}) is more than {{${lead.name}}} carries ({{${lead.pct.toFixed(1)}%}}), and that is the biggest share. No single change gets there: it takes several materials or steps, or a different design.`
    }
    const moves = levers[0]?.moves.slice(0, 2).join(' ')
    return `${asked} a {{${target}%}} cut to {{${loadLabel}}} (now {{${totalStr}}}) is within what {{${lead.name}}} carries ({{${lead.pct.toFixed(1)}%}}), so start there.${moves ? ` ${moves}` : ''}${close}`
  }

  // Match the question to a lever: a material it names, energy, or data.
  const subject = (l: ConsultantItem) => l.title.split(' is the ')[0].toLowerCase().slice(0, 5)
  const lever =
    levers.find((l) => / is the (biggest|next) lever$/.test(l.title) && q.includes(subject(l))) ??
    (/electric|energy|power|grid|solar|renewable|oven|booth|kwh/.test(q)
      ? levers.find((l) => /electricity/i.test(l.title))
      : undefined) ??
    (/\bepd|supplier|average|data quality|factor/.test(q) ? levers.find((l) => /supplier data/i.test(l.title)) : undefined)
  if (lever) {
    return `${asked} ${lever.title}. ${lever.why} What I would do: ${lever.moves.slice(0, 2).join(' ')}${close}`
  }
  if (levers[0]) {
    return `${asked} this case's result points first to one place. ${levers[0].title}: ${levers[0].why} ${levers[0].moves[0]}${close}`
  }
  if (top) {
    return `${asked} the biggest contributor is {{${stepLabel(top.name)}}} ({{${top.pct.toFixed(1)}%}} of {{${loadLabel}}}). Open that step to see which flow drives it.${close}`
  }
  return `${asked} there are no results yet for {{${loadLabel}}}. Run an assessment first.`
}

/**
 * Replaces {{token}} markers in streamed text with subtle chips.
 * If the token matches a contributor name, the chip links to its source.
 */
function renderWithCitations(
  text: string,
  contributors: Contributor[],
  ctx: { projectId: string; caseId: string },
): ReactNode {
  // While the text streams in character-by-character, the tail can be a
  // half-typed token like "totals {{3.41 kg" whose closing "}}" hasn't arrived
  // yet. Drop that incomplete trailing token so users never see raw "{{"
  // braces flash; the chip appears atomically once the token completes.
  const safe = text.replace(/\{\{(?:(?!\}\}).)*$/s, '')
  const parts = safe.split(/(\{\{[^}]+\}\})/g)
  return parts.map((part, i) => {
    const m = part.match(/^\{\{([^}]+)\}\}$/)
    if (!m) return <span key={i}>{part}</span>
    const value = m[1]
    const match = contributors.find((c) => value.includes(c.name) || value.includes(stepLabel(c.name)))
    const content = (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          padding: '1px 6px',
          borderRadius: 4,
          background: 'oklch(from var(--brand-primary) l c h / 0.10)',
          color: 'var(--brand-primary)',
          fontWeight: 600,
          fontSize: 13.5,
          marginInline: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    )
    if (match) {
      return (
        <Link
          key={i}
          href={`/project/${ctx.projectId}/case/${ctx.caseId}`}
          style={{ textDecoration: 'none' }}
        >
          {content}
        </Link>
      )
    }
    return <span key={i}>{content}</span>
  })
}
