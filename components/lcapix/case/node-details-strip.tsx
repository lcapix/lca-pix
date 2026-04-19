'use client'

// NodeDetailsStrip — inspector strip beneath the canvas.
// Mirrors LCAPIX/pages-app.jsx lines 819-905 (NodeDetailsStrip + MetricMini).

import { HIERARCHY_TYPES, DEMO_FLOWS } from '@/lib/lcapix-demo'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface NodeDetailsStripProps {
  node: FlatCaseNode | null
  totalComponents: number
}

export function NodeDetailsStrip({ node, totalComponents }: NodeDetailsStripProps) {
  const t = node ? HIERARCHY_TYPES.find((h) => h.id === node.type) : null
  const seed = node ? String(node.id).length * 7 + node.label.length * 13 : 0
  const drivers = node ? (seed % 5) + 1 : 0
  const impactKg = node ? (12 + (seed % 40) + (seed % 11) / 10).toFixed(2) : '—'
  const costUsd = node?.cost ?? 0
  const flowsCount = node?.flows ?? 0
  const sampleFlows = DEMO_FLOWS.slice(0, 3)

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
        <MetricMini label="Drivers" value={node ? drivers : '—'} />
        <MetricMini label="Cost" value={node ? '$' + costUsd : '—'} />
        <MetricMini
          label="Impact"
          value={node ? impactKg : '—'}
          unit={node ? 'kg CO₂-eq' : ''}
        />
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minHeight: 0,
            }}
          >
            {sampleFlows.map((f, i) => (
              <div
                key={f.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 8.5,
                    padding: '2px 5px',
                    borderRadius: 3,
                    textAlign: 'center',
                    background:
                      f.dir === 'IN'
                        ? 'oklch(from var(--signal-info) l c h / 0.18)'
                        : 'oklch(from var(--signal-warn) l c h / 0.18)',
                    color: f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {f.dir}
                </span>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {f.substance}
                </span>
                <span
                  className="mono"
                  style={{ color: 'var(--text-secondary)', fontSize: 11 }}
                >
                  {f.amount.toFixed(2)}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, minWidth: 32 }}>
                  {f.unit}
                </span>
              </div>
            ))}
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
