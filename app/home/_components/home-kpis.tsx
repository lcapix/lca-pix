'use client'

// KPIs — calm, neutral, hairline-bordered (enfos discipline: green is the
// only accent; the library tiles link to their browsers).

import { MetricBlock } from '@/components/lcapix'
import type { HomeKpi } from '@/lib/home/projects'

export function HomeKpis({ kpis }: { kpis: HomeKpi[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 48,
      }}
    >
      {kpis.map((k, i) => (
        <div key={k.label} data-tour={i === 0 ? 'home-kpi-projects' : undefined}>
        <MetricBlock
          label={k.label}
          value={k.numeric}
          sub={k.sub}
          icon={k.icon}
          delayMs={i * 80}
          href={(k as any).href}
          hrefHint={(k as any).hrefHint}
        />
        </div>
      ))}
    </div>
  )
}
