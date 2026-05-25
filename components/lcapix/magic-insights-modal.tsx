'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/lcapix'
import { useStreamText } from '@/lib/hooks/use-stream-text'

interface Contributor {
  id: string
  name: string
  pct: number
  value: number
}

interface MagicInsightsModalProps {
  open: boolean
  onClose: () => void
  caseName: string
  method: string
  totalImpact?: number
  totalCost?: number
  topContributors: Contributor[]
  projectId: string
  caseId: string
}

type ChipId = 'summary' | 'reduce' | 'tradeoff' | 'base'

interface InsightChip {
  id: ChipId
  label: string
  icon: 'sparkle' | 'arrow-down' | 'dollar' | 'layers'
}

const CHIPS: InsightChip[] = [
  { id: 'summary', label: 'Summary', icon: 'sparkle' },
  { id: 'reduce', label: 'How to reduce 20%?', icon: 'arrow-down' },
  { id: 'tradeoff', label: 'Cost vs CO₂ tradeoff', icon: 'dollar' },
  { id: 'base', label: 'Compare to base', icon: 'layers' },
]

export function MagicInsightsModal({
  open,
  onClose,
  caseName,
  method,
  totalImpact,
  totalCost,
  topContributors,
  projectId,
  caseId,
}: MagicInsightsModalProps) {
  const [activeChip, setActiveChip] = useState<ChipId>('summary')

  const insightText = useMemo(() => {
    const top = topContributors[0]
    const second = topContributors[1]
    const totalStr = totalImpact !== undefined ? `${totalImpact.toFixed(2)} kg CO₂-eq` : 'no result yet'
    const costStr = totalCost !== undefined ? `$${totalCost.toLocaleString()}` : '—'
    switch (activeChip) {
      case 'summary':
        return `Your ${caseName} assessment under ${method} totals {{${totalStr}}} at {{${costStr}}}. The single biggest lever is {{${top?.name ?? 'your top contributor'}}}, responsible for {{${top?.pct.toFixed(1) ?? '—'}%}} of the impact. Together, your top two contributors account for {{${((top?.pct ?? 0) + (second?.pct ?? 0)).toFixed(1)}%}}. That concentration is good news — you can move the needle by working on a small number of components.`
      case 'reduce':
        return `To cut total impact by ~20%, target {{${top?.name ?? 'your top contributor'}}} first. It alone represents {{${top?.pct.toFixed(1) ?? '—'}%}} of the load, so a {{${Math.ceil(20 / ((top?.pct ?? 1) / 100))}%}} reduction there gets you most of the way. Practical moves: substitute the material (e.g., recycled-content stock), source from a lower-carbon grid region, or redesign the operation to consume less of it. If you can't change {{${top?.name ?? 'it'}}}, stack improvements across {{${second?.name ?? 'the next two contributors'}}} as well.`
      case 'tradeoff':
        return `Cost and CO₂ aren't always aligned. In this assessment, {{${top?.name ?? 'the top contributor'}}} drives {{${top?.pct.toFixed(1) ?? '—'}%}} of CO₂ but its share of the {{${costStr}}} total may be smaller — meaning a CO₂ cut here is "cheap" in dollar terms. The opposite pattern usually shows up at the assembly/labor end of the tree: high cost, low CO₂. Use the per-flow cost vs impact view in the editor to find your best dollars-per-kg-CO₂-cut moves.`
      case 'base':
        return `Comparing this case to your base scenario, the magic happens when one or two components diverge. Switch to the Compare Cases view to see component-level deltas (which nodes moved, by how much, and whether cost shifted with them). A common pattern: a comparative case improves CO₂ by 20–60% on a specific branch but increases material cost — which is the kind of trade-off your ABC costing layer is built to surface.`
    }
  }, [activeChip, caseName, method, totalImpact, totalCost, topContributors])

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
          width: 640,
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflow: 'auto',
          padding: 0,
          background: 'var(--surface-raised)',
          boxShadow: '0 20px 60px -20px rgba(15,23,42,0.35), 0 0 0 1px rgba(15,23,42,0.06)',
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
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
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
                  border: active ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
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
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Streamed body with cited data chips */}
        <div style={{ padding: '20px 24px 8px' }}>
          <div
            key={activeChip}
            style={{
              fontSize: 14,
              color: 'var(--text-primary)',
              lineHeight: 1.65,
            }}
          >
            {renderWithCitations(streamed, topContributors, { projectId, caseId })}
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

        {/* Top contributor mini-list */}
        {topContributors.length > 0 && (
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
              Source data — top contributors
            </div>
            {topContributors.slice(0, 5).map((c) => (
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
 * Replaces {{token}} markers in streamed text with subtle chips.
 * If the token matches a contributor name, the chip links to its source.
 */
function renderWithCitations(
  text: string,
  contributors: Contributor[],
  ctx: { projectId: string; caseId: string },
): ReactNode {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
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
