'use client'

// NodeDetailsStrip — inspector strip beneath the canvas.
// Mirrors LCAPIX/pages-app.jsx lines 819-905 (NodeDetailsStrip + MetricMini).

import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import { HelpTip } from '@/components/lcapix/help-tip'

export interface NodeDetailsStripProps {
  node: FlatCaseNode | null
  totalComponents: number
  /** Subtree totals (this node + everything below). Parents are pure sums. */
  rolled?: { cost: number; flows: number } | null
  /** True when the node has children — a roll-up, not a terminating node. */
  hasChildren?: boolean
}

// Hover definitions per tier (explanations are hover, not inline text).
const TIER_HELP: Record<string, string> = {
  Product:
    'The finished thing being assessed. Its totals are the sum of every line, subprocess and operation below it.',
  Machine: 'A production line or major stage — a roll-up of the subprocesses beneath it.',
  Subprocess: 'A group of related steps, such as a work center — a roll-up of its operations.',
  Operation:
    'One processing step: a unit process in ISO 14044 terms. Its inputs (materials, energy), outputs (emissions) and costs (labor, machine time) are recorded here.',
  Task: 'An optional finer sub-step of an operation, used only when you split an operation into parts.',
}

export function NodeDetailsStrip({
  node,
  totalComponents,
  rolled = null,
  hasChildren = false,
}: NodeDetailsStripProps) {
  const t = node ? HIERARCHY_TYPES.find((h) => h.id === node.type) : null
  // Honest values only. This lightweight strip has the node's real flow count
  // and cost; it does NOT have per-node driver counts, impact, or flow detail,
  // so those show "—" rather than fabricated numbers. (Previously this used a
  // seed to invent a driver count + impact, and rendered DEMO_FLOWS as if they
  // were real substances on the node.) For a roll-up node the values are the
  // subtree totals, since its own value is by design zero.
  const costUsd = Math.round(rolled?.cost ?? node?.cost ?? 0)
  const flowsCount = rolled?.flows ?? node?.flows ?? 0
  const sigma = hasChildren ? ' Σ' : ''

  return (
    <div
      style={{
        height: 128,
        background: 'var(--surface-base)',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1.6fr',
        fontFamily: 'var(--font-ui)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 0,
        }}
      >
        {node ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  color: t?.color,
                  background: 'oklch(from ' + t?.color + ' l c h / 0.16)',
                  padding: '2px 7px',
                  borderRadius: 3,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}
              >
                {t?.label}
              </span>
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                ID · {node.id}
              </span>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {node.label}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hasChildren
                  ? 'Roll-up node — its numbers are the totals of everything below it.'
                  : t?.id === 'Operation'
                    ? 'Unit process — its materials, energy, emissions and labor live here.'
                    : t?.id === 'Task'
                      ? 'Sub-step of an operation — its flows and costs live here.'
                      : 'Terminating node — flows and costs attach here.'}
              </span>
              {t?.id && TIER_HELP[t.id] ? (
                <HelpTip label={`What is a ${t.label}?`}>{TIER_HELP[t.id]}</HelpTip>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div
              className="mono"
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                fontWeight: 600,
              }}
            >
              No selection
            </div>
            <div
              style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              Click any node to inspect
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing{' '}
              <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                {totalComponents}
              </span>{' '}
              components in this case. Drag to pan, scroll to zoom.
            </div>
          </>
        )}
      </div>

      <div
        style={{
          padding: '14px 20px',
          borderRight: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 16px',
          alignContent: 'center',
          minWidth: 0,
        }}
      >
        {/* Two tiles showing the same number taught that flows and drivers are
            different counts of different things. They are not: every flow on a
            leaf is a driver flow, so the second tile is gone and the remaining
            ones each say something the other does not. */}
        <MetricMini label={'Flows' + sigma} value={node ? flowsCount : '—'} />
        <MetricMini
          label={'Cost' + sigma}
          value={node ? '$' + costUsd.toLocaleString() : '—'}
        />
        <MetricMini label="Impact" value="—" unit="" />
      </div>

      <div
        style={{
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="mono"
            style={{
              fontSize: 9,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontWeight: 600,
            }}
          >
            Top flows
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span
            style={{
              color: 'var(--signal-success)',
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span className="badge-dot" style={{ background: 'var(--signal-success)' }} />
            Auto-saving
          </span>
        </div>
        {node ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {hasChildren ? (
              <>
                <span className="mono" style={{ color: 'var(--text-primary)' }}>
                  {flowsCount}
                </span>{' '}
                flow{flowsCount === 1 ? '' : 's'} across the nodes below. Select a
                process step below to view or edit its flows.
              </>
            ) : flowsCount > 0 ? (
              <>
                <span className="mono" style={{ color: 'var(--text-primary)' }}>
                  {flowsCount}
                </span>{' '}
                flow{flowsCount === 1 ? '' : 's'} attached. Open the inspector to
                view and edit them.
              </>
            ) : (
              'No flows on this node yet. Add its materials, energy or emissions in the inspector.'
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Select a node to preview its environmental flows here.
          </div>
        )}
      </div>
    </div>
  )
}

interface MetricMiniProps {
  label: string
  value: string | number
  unit?: string
}

export function MetricMini({ label, value, unit }: MetricMiniProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
        {unit ? (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              fontWeight: 400,
              marginLeft: 4,
            }}
          >
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  )
}
