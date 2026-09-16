'use client'

// The five ISO 14040 phases as a row of chips: ✓ done, ◐ partial, and the
// current phase highlighted. Hover shows what the phase is and where the case
// stands in it. Used by the case editor and the project view.

import type { JourneyPhase } from '@/lib/case-journey'
import { ISO_HELP } from '@/components/lcapix/iso-help'

export function PhaseStepper({ phases, accent = 'var(--accent, #4f8a6a)' }: { phases: JourneyPhase[]; accent?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {phases.map((p) => {
        const bg = p.current
          ? accent
          : p.state === 'done'
            ? 'oklch(from var(--accent, #4f8a6a) l c h / 0.15)'
            : p.state === 'partial'
              ? 'color-mix(in oklab, #d97706 16%, transparent)'
              : 'var(--surface-sunken, #ece9e2)'
        return (
          <span
            key={p.label}
            title={`${ISO_HELP.phases[p.label]}\n\nThis case: ${p.detail}`}
            style={{
              cursor: 'help',
              fontSize: 10.5,
              padding: '2px 9px',
              borderRadius: 11,
              background: bg,
              color: p.current ? '#fff' : 'var(--text-secondary)',
              fontWeight: p.current ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {p.state === 'done' ? '✓ ' : p.state === 'partial' ? '◐ ' : ''}
            {p.label}
          </span>
        )
      })}
    </div>
  )
}
