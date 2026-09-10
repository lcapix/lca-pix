'use client'

// NodeDetailsStrip — inspector strip beneath the canvas.
// Mirrors LCAPIX/pages-app.jsx lines 819-905 (NodeDetailsStrip + MetricMini).

import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface NodeDetailsStripProps {
  node: FlatCaseNode | null
  totalComponents: number
}

export function NodeDetailsStrip({ node, totalComponents }: NodeDetailsStripProps) {
  const t = node ? HIERARCHY_TYPES.find((h) => h.id === node.type) : null
  // Honest values only. This lightweight strip has the node's real flow count
  // and cost; it does NOT have per-node driver counts, impact, or flow detail,
  // so those show "—" rather than fabricated numbers. (Previously this used a
  // seed to invent a driver count + impact, and rendered DEMO_FLOWS as if they
  // were real substances on the node.)
  const costUsd = node?.cost ?? 0
  const flowsCount = node?.flows ?? 0

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
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {t?.label === 'Product' &&
                'Top-level functional unit. Inherits region and method from the case.'}
              {t?.label === 'Machine/Line' &&
                'Equipment line aggregating downstream subprocesses.'}
              {t?.label === 'Subprocess' &&
                'Named operation stage — groups related elemental tasks.'}
              {t?.label === 'Operation' &&
                'Discrete processing step. Drives labor + energy demand.'}
              {t?.label === 'Elemental Task' &&
                'Leaf node — attaches drivers and environmental flows.'}
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
        <MetricMini label="Flows" value={node ? flowsCount : '—'} />
        {/* All flows attached to a leaf are driver flows, so the driver count
            equals the flow count. (Impact still needs an assessment run.) */}
        <MetricMini label="Drivers" value={node ? flowsCount : '—'} />
        <MetricMini label="Cost" value={node ? '$' + costUsd : '—'} />
        <MetricMini label="Impact" value={node ? '—' : '—'} unit="" />
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
            {flowsCount > 0 ? (
              <>
                <span className="mono" style={{ color: 'var(--text-primary)' }}>
                  {flowsCount}
                </span>{' '}
                flow{flowsCount === 1 ? '' : 's'} attached. Open the inspector to
                view and edit them.
              </>
            ) : (
              'No flows on this node yet. Select it in the inspector to add input/output flows.'
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
