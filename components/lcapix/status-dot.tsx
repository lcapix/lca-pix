// StatusDot — mirrored from LCAPIX/shared.jsx lines 83-92
// The original uses `oklch(from var(--x) l c h / 0.2)` for a halo glow, which has
// spotty browser support. We substitute hex + `33` (alpha 0.2) to produce an
// equivalent halo without relaxed-color-space reliance.

export type StatusDotKind = 'success' | 'warn' | 'error' | 'info' | 'inactive'

export interface StatusDotProps {
  status?: StatusDotKind
  size?: number
}

const colorMap: Record<StatusDotKind, string> = {
  success: 'var(--signal-success)',
  warn: 'var(--signal-warn)',
  error: 'var(--signal-error)',
  info: 'var(--signal-info)',
  inactive: 'var(--text-disabled)',
}

// Hex equivalents of the light-theme CSS tokens, used to produce a low-alpha halo
// without relying on oklch relaxed-color-space syntax.
const haloMap: Record<StatusDotKind, string> = {
  success: '#00855833',
  warn: '#a66b0033',
  error: '#ba1a1a33',
  info: '#0b5fa533',
  inactive: '#9aa39e33',
}

export function StatusDot({ status = 'success', size = 8 }: StatusDotProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colorMap[status],
        display: 'inline-block',
        boxShadow: `0 0 0 3px ${haloMap[status]}`,
      }}
    />
  )
}
