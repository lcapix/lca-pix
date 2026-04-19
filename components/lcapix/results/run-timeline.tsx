'use client'

// RunTimeline — mirrored from LCAPIX/pages-misc.jsx lines 187-215.
// SVG area + line chart with status-colored dots. Accepts a list of runs;
// auto-scales to min/max. A single run is rendered as a flat line.

import { fmtNum } from '../formatters'

export type RunTimelineStatus = 'success' | 'partial' | 'error'

export interface RunTimelineRun {
  id: string | number
  /** Display label on the x-axis, e.g. "Apr 18". */
  timestamp: string
  /** The value plotted on the y-axis. */
  totalImpact: number
  status: RunTimelineStatus
}

export interface RunTimelineProps {
  runs: RunTimelineRun[]
}

export function RunTimeline({ runs }: RunTimelineProps) {
  if (!runs.length) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        No run history available.
      </div>
    )
  }

  const W = 900
  const H = 140
  const padX = 40
  const padY = 20
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const values = runs.map((r) => r.totalImpact)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  const pts = runs.map((r, i) => {
    const x =
      runs.length === 1 ? W / 2 : padX + (i / (runs.length - 1)) * innerW
    const y = padY + ((max - r.totalImpact) / range) * innerH
    return { ...r, x, y }
  })

  const line = pts
    .map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`)
    .join(' ')
  const area =
    line +
    ` L ${pts[pts.length - 1].x} ${H - padY} L ${pts[0].x} ${H - padY} Z`

  const dotColor = (s: RunTimelineStatus) =>
    s === 'success'
      ? 'var(--signal-success)'
      : s === 'partial'
        ? 'var(--signal-warn)'
        : 'var(--signal-error)'

  return (
    <div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <path d={area} fill="var(--brand-primary)" opacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="1.5"
        />
        {pts.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill={dotColor(p.status)}
              stroke="var(--surface-base)"
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={H - 4}
              fill="var(--text-tertiary)"
              fontSize="10"
              textAnchor="middle"
              fontFamily="var(--font-ui)"
            >
              {p.timestamp}
            </text>
            <text
              x={p.x}
              y={p.y - 10}
              fill="var(--text-secondary)"
              fontSize="10"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontWeight="500"
            >
              {fmtNum(p.totalImpact, 1)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
