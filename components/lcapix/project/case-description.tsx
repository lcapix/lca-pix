'use client'

// Active case description — what this scenario actually represents, tagged
// BASELINE or WHAT CHANGED.

export function CaseDescription({ activeCase }: { activeCase: any }) {
  const accent = activeCase.type === 'base' ? '#2d6a4f' : '#9f88cc'
  const label =
    activeCase.type === 'base' ? 'BASELINE' : 'WHAT CHANGED'
  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 16px',
        background:
          'color-mix(in oklab, ' +
          accent +
          ' 5%, var(--surface-raised))',
        border:
          '1px solid color-mix(in oklab, ' +
          accent +
          ' 18%, var(--border-subtle))',
        borderRadius: 10,
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          padding: '4px 8px',
          borderRadius: 999,
          background:
            'color-mix(in oklab, ' + accent + ' 18%, transparent)',
          color: accent,
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1 }}>{activeCase.description}</span>
    </div>
  )
}
