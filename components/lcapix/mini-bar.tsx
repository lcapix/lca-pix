// MiniBar — mirrored from LCAPIX/shared.jsx lines 119-126

export interface MiniBarProps {
  value: number
  max?: number
  color?: string
  height?: number
}

export function MiniBar({
  value,
  max = 100,
  color = 'var(--brand-primary)',
  height = 6,
}: MiniBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'var(--surface-overlay)',
        borderRadius: 999,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 999,
          transition: 'width 260ms',
        }}
      />
    </div>
  )
}
