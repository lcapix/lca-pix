// Logo + LogoMark — mirrored from LCAPIX/shared.jsx lines 4-23

export interface LogoMarkProps {
  size?: number
}

export function LogoMark({ size = 20 }: LogoMarkProps) {
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" style={{ display: 'block' }}>
      <rect x="0" y="0" width="8" height="8" rx="1" fill="currentColor" opacity="0.95" />
      <rect x="10" y="2" width="8" height="8" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="4" y="10" width="8" height="8" rx="1" fill="currentColor" opacity="0.40" />
    </svg>
  )
}

export interface LogoProps {
  size?: number
  showWordmark?: boolean
}

export function Logo({ size = 20, showWordmark = true }: LogoProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        color: 'var(--brand-primary)',
      }}
    >
      <LogoMark size={size} />
      {showWordmark && (
        <span className="logo-wordmark" style={{ fontSize: size * 0.82 }}>
          LCAPIX
        </span>
      )}
    </div>
  )
}
