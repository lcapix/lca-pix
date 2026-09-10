'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/lcapix'
import { useStreamText } from '@/lib/hooks/use-stream-text'

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
  totalCost?: number
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
  totalCost,
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
    }
  }, [open, initialCategory, impacts])

  // Resolve the active category, its unit, and the contributors under it.
  const { activeLabel, activeUnit, activeTotal, contributors } = useMemo(() => {
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
    }
  }, [selectedCategory, impacts, componentBreakdown])

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
        ? `${activeTotal.toFixed(2)} ${activeUnit}`
        : 'an indicative overall load'
    const costStr = totalCost !== undefined ? `$${totalCost.toLocaleString()}` : '—'
    const loadLabel = selectedCategory === OVERALL_KEY ? 'environmental load' : activeLabel

    switch (activeChip) {
      case 'summary':
        return `Your ${caseName} assessment under ${method} totals {{${totalStr}}} for {{${loadLabel}}} at {{${costStr}}}. The single biggest lever is {{${top?.name ?? 'your top contributor'}}}, responsible for {{${top?.pct.toFixed(1) ?? '—'}%}} of the ${loadLabel}. Together, your top two contributors account for {{${((top?.pct ?? 0) + (second?.pct ?? 0)).toFixed(1)}%}}. That concentration is good news — you can move the needle by working on a small number of components.`

      case 'reduce': {
        const topShare = top?.pct ?? 0
        if (!top) {
          return `No contributor data yet for {{${loadLabel}}}. Run an assessment with this category enabled to get reduce-by-${reducePct}% guidance.`
        }
        // If the target exceeds what's practically achievable on the top
        // contributor, say so plainly — that's the "magic" the user asked for.
        if (reducePct > topShare && reducePct > 50) {
          return `Cutting {{${loadLabel}}} by {{${reducePct}%}} is ambitious. {{${top?.name}}} only accounts for {{${topShare.toFixed(1)}%}}, so even eliminating it entirely wouldn't reach your target. You'd need to stack improvements across {{${second?.name ?? 'multiple components'}}} and likely change methodology (substitute materials, change energy source, redesign the process). If the goal is truly ${reducePct}% under current methodology, it may not be practically possible without scope change — and that's a defensible answer to bring back to the committee.`
        }
        const requiredOnTop = Math.min(100, Math.ceil(reducePct / (topShare / 100 || 1)))
        return `To cut {{${loadLabel}}} by {{${reducePct}%}}, target {{${top?.name}}} first. It alone represents {{${topShare.toFixed(1)}%}} of the load, so a {{${requiredOnTop}%}} reduction there gets you most of the way. Practical moves: substitute the material (e.g., recycled-content stock), source from a lower-impact energy mix (gas vs coal vs grid electricity), or redesign the operation to consume less of it. If you can't change {{${top?.name}}}, stack improvements across {{${second?.name ?? 'the next two contributors'}}} as well.`
      }

      case 'tradeoff':
        return `Cost and ${loadLabel} aren't always aligned. In this assessment, {{${top?.name ?? 'the top contributor'}}} drives {{${top?.pct.toFixed(1) ?? '—'}%}} of {{${loadLabel}}} but its share of the {{${costStr}}} total may be smaller — meaning a load cut here is "cheap" in dollar terms. The opposite pattern usually shows up at the assembly/labor end of the tree: high cost, low ${loadLabel}. Use the per-flow cost vs impact view in the editor to find your best dollars-per-unit-load-cut moves.`

      case 'base':
        return `Comparing this case to your base scenario, the magic happens when one or two components diverge. Switch to the Compare Cases view to see component-level deltas (which nodes moved, by how much for {{${loadLabel}}}, and whether cost shifted with them). A common pattern: a comparative case improves {{${loadLabel}}} by 20–60% on a specific branch but increases material cost — which is the kind of trade-off your ABC costing layer is built to surface.`

      case 'custom': {
        if (!submittedPrompt.trim()) {
          return `Type a question on the right (e.g. "Can we beat 35% on acidification?" or "What if we swap coal for natural gas?"). I'll answer using {{${loadLabel}}} and the top contributors below.`
        }
        return answerFreeText({
          question: submittedPrompt,
          loadLabel,
          top,
          second,
          totalStr,
          costStr,
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
    reducePct,
    submittedPrompt,
  ])

  const { value: streamed, done } = useStreamText(insightText)

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
              placeholder='e.g. "Can we beat 35% on acidification?" or "What if we swap coal for natural gas?"'
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
            {renderWithCitations(streamed, contributors, { projectId, caseId })}
            {!done && (
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
        </div>

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
                  {c.value.toFixed(2)}
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

/**
 * Local template-based response to a user's free-text question.
 * Detects a target percentage if present, falls back to a generic answer.
 */
function answerFreeText(args: {
  question: string
  loadLabel: string
  top?: Contributor
  second?: Contributor
  totalStr: string
  costStr: string
}): string {
  const { question, loadLabel, top, second, totalStr, costStr } = args
  const pctMatch = question.match(/(\d{1,3})\s*%/)
  const target = pctMatch ? Math.min(100, parseInt(pctMatch[1], 10)) : undefined
  const topShare = top?.pct ?? 0

  if (target !== undefined && top) {
    if (target > topShare && target > 60) {
      return `For your question — {{"${question}"}} — a {{${target}%}} cut to {{${loadLabel}}} (currently {{${totalStr}}}, ${costStr}) is unlikely under the current process. {{${top?.name}}} only contributes {{${topShare.toFixed(1)}%}}, so even eliminating it leaves you short of {{${target}%}}. You'd need a methodology change (different energy source, substituted material, redesigned operation). Saying "not practically possible at ${target}%" is the honest answer here.`
    }
    return `For your question — {{"${question}"}} — a {{${target}%}} cut to {{${loadLabel}}} looks achievable. Focus on {{${top?.name}}} ({{${topShare.toFixed(1)}%}} of load); stack with {{${second?.name ?? 'the next contributor'}}} if you need more headroom.`
  }

  // No explicit target — generic answer grounded in the data.
  return `For your question — {{"${question}"}} — the most useful levers in this case are around {{${top?.name ?? 'the top contributor'}}} ({{${topShare.toFixed(1)}%}} of {{${loadLabel}}}). Material substitution, switching the energy source (gas/coal/grid), and process redesign are the three families of moves that change ${loadLabel} meaningfully. Compare to base in the editor to see which move keeps cost ({{${costStr}}}) flat.`
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
    const match = contributors.find((c) => value.includes(c.name))
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
