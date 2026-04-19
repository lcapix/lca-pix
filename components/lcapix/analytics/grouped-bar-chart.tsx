'use client'

// GroupedBarChart — mirrored from LCAPIX/pages-misc.jsx lines 433-472.
// SVG grouped bar chart. Each `group` renders a cluster of bars (one per
// series). Series labels drive the legend above the plot. Bars are filled
// with the `--chart-N` CSS variables (1..N).

export interface GroupedBarChartGroup {
  label: string
  values: number[]
}

export interface GroupedBarChartProps {
  groups: GroupedBarChartGroup[]
  seriesLabels: string[]
  unit?: string
  height?: number
}

export function GroupedBarChart({
  groups,
  seriesLabels,
  unit,
  height = 260,
}: GroupedBarChartProps) {
  const W = 900
  const H = height
  const padX = 40
  const padY = 30
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const groupCount = Math.max(groups.length, 1)
  const seriesCount = Math.max(seriesLabels.length, 1)
  const groupW = innerW / groupCount
  const barW = Math.max(2, (groupW - 20) / seriesCount)

  // Normalize against the maximum across all bars so bars are comparable
  // within each category (matches the prototype's per-category intent).
  const maxPerGroup = groups.map((g) => {
    const m = Math.max(...g.values.map((v) => Math.abs(v)), 0)
    return m > 0 ? m : 1
  })

  if (!groups.length || !seriesLabels.length) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        No comparison data available.
      </div>
    )
  }

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {groups.map((g, gi) => {
        const xg = padX + gi * groupW
        const normBase = maxPerGroup[gi]
        return (
          <g key={g.label}>
            {seriesLabels.map((s, si) => {
              const rawVal = g.values[si] ?? 0
              const pct = Math.abs(rawVal) / normBase
              const h = Math.max(0, pct * innerH * 0.85)
              const x = xg + 10 + si * barW
              const y = H - padY - h
              return (
                <g key={s}>
                  <rect
                    x={x}
                    y={y}
                    width={Math.max(0, barW - 4)}
                    height={h}
                    fill={`var(--chart-${si + 1})`}
                    rx="2"
                  />
                  {si === 0 && (
                    <text
                      x={xg + groupW / 2}
                      y={H - 8}
                      fill="var(--text-tertiary)"
                      fontSize="10"
                      textAnchor="middle"
                      fontFamily="var(--font-ui)"
                    >
                      {g.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
      {/* Legend */}
      {seriesLabels.map((s, i) => (
        <g key={s} transform={`translate(${padX + i * 180}, 8)`}>
          <rect width="10" height="10" rx="2" fill={`var(--chart-${i + 1})`} />
          <text
            x="16"
            y="9"
            fill="var(--text-secondary)"
            fontSize="11"
            fontFamily="var(--font-ui)"
          >
            {s}
            {unit ? ` (${unit})` : ''}
          </text>
        </g>
      ))}
    </svg>
  )
}
