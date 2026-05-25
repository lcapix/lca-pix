'use client'

import { useState } from 'react'
import { AnimatedNumber } from '../animated-number'

interface Material {
  id: string
  label: string
  values: { CML: number; ReCiPe: number; TRACI: number }
  note: string
  color: string
}

const MATERIALS: Material[] = [
  {
    id: 'steel',
    label: 'Steel bracket',
    values: { CML: 1.8, ReCiPe: 2.1, TRACI: 1.9 },
    note: 'Carbon-intensive smelting; ductile, recyclable.',
    color: '#7bb5e8',
  },
  {
    id: 'aluminum',
    label: 'Aluminum bracket',
    values: { CML: 8.2, ReCiPe: 9.4, TRACI: 8.6 },
    note: 'Energy-heavy electrolysis. Lower mass, higher impact per kg.',
    color: '#f0a68a',
  },
  {
    id: 'plastic',
    label: 'Plastic (ABS) bracket',
    values: { CML: 3.4, ReCiPe: 3.9, TRACI: 3.6 },
    note: 'Fossil feedstock; lighter still, end-of-life burden.',
    color: '#c8b5e8',
  },
]

const METHOD_NOTES: Record<string, string> = {
  CML: 'European reference. Conservative midpoint.',
  ReCiPe: 'Updated factors; slightly higher GWP for metals.',
  TRACI: 'US EPA basis. Closer to CML for most flows.',
}

export function InteractiveMethodCards() {
  const [activeId, setActiveId] = useState<string>('steel')
  const material = MATERIALS.find((m) => m.id === activeId)!

  return (
    <div>
      {/* Material chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            alignSelf: 'center',
            marginRight: 4,
          }}
        >
          Input:
        </span>
        {MATERIALS.map((m) => {
          const active = m.id === activeId
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveId(m.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: active ? `1.5px solid ${m.color}` : '1px solid var(--border-subtle)',
                background: active ? `${m.color}22` : 'var(--surface-raised)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'background 200ms, border-color 200ms, transform 120ms',
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: m.color,
                }}
              />
              {m.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {(['CML', 'ReCiPe', 'TRACI'] as const).map((method) => (
          <div
            key={method}
            className="card card-spotlight"
            style={{
              padding: '36px 32px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'border-color 200ms, box-shadow 200ms',
            }}
          >
            <div className="label-sm" style={{ marginBottom: 24, color: 'var(--primary)' }}>
              {method === 'CML' ? 'CML 2001 v4' : method === 'ReCiPe' ? 'ReCiPe Midpoint (H)' : 'TRACI 2.1'}
            </div>
            <div
              key={`${activeId}-${method}`}
              className="mono"
              style={{
                fontSize: 44,
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: 8,
                letterSpacing: '-0.025em',
                lineHeight: 1,
              }}
            >
              <AnimatedNumber
                value={material.values[method]}
                decimals={2}
                duration={600}
              />
            </div>
            <div className="label-sm" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>
              kg CO₂-eq
            </div>
            <div className="divider-tonal" style={{ margin: '24px 0 16px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {METHOD_NOTES[method]}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: '14px 18px',
          background: `${material.color}14`,
          border: `1px solid ${material.color}55`,
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: material.color,
            flexShrink: 0,
          }}
        />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{material.label}:</strong>{' '}
          {material.note}
        </span>
      </div>
    </div>
  )
}
