'use client'

// Impact Overview: the active case's global-warming result from its latest
// run, or "Not yet assessed".

import { Icon } from '@/components/lcapix'
import { AnimatedNumber } from '@/components/lcapix/animated-number'
import type { CaseImpact } from '@/lib/project/case-impact'

export interface ImpactOverviewCardProps {
  assessed: boolean
  caseImpact: CaseImpact | null
  project: any
  totalImpact: number | null
  impactUnit: string
  componentCount: number
  driverCount: number
}

export function ImpactOverviewCard({
  assessed,
  caseImpact,
  project,
  totalImpact,
  impactUnit,
  componentCount,
  driverCount,
}: ImpactOverviewCardProps) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Impact Overview
        </span>
        <span
          className={'chip ' + (assessed ? 'chip-emerald' : '')}
          style={{ marginLeft: 'auto', fontSize: 11 }}
        >
          {assessed ? (
            <>
              <Icon name="check" size={10} /> Assessed
            </>
          ) : (
            'Not assessed'
          )}
        </span>
      </div>
      <div
        className="eyebrow"
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        GLOBAL WARMING · {caseImpact?.method ?? project?.lciaMethod ?? 'CML 2001'}
      </div>
      <div
        style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}
      >
        {totalImpact != null ? (
          <>
            <AnimatedNumber
              value={totalImpact}
              decimals={2}
              className="mono"
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: 'var(--brand-primary)',
                letterSpacing: '-0.02em',
              }}
            />
            <div
              style={{ fontSize: 13, color: 'var(--text-tertiary)' }}
            >
              {impactUnit}
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 18,
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            Not yet assessed
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginTop: 8,
        }}
      >
        <span className="mono">{componentCount}</span> steps ·{' '}
        <span className="mono">{caseImpact?.categoryCount || '—'}</span> categories ·{' '}
        <span className="mono">{driverCount}</span> flows
      </div>
    </div>
  )
}
