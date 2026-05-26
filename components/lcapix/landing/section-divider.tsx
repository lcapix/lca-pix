// SectionDivider — hairline divider carrying the LCAPIX 3-tile glyph in
// the middle. Used between marketing-page sections to give a quiet,
// repeating brand signal that ties the page together.

interface SectionDividerProps {
  /** Extra margin top/bottom in px. Default 0 (relies on adjacent section padding). */
  spacing?: number
  /** Glyph variant: tiles (default), nodes (process-flow), or pure rule (no glyph). */
  variant?: 'tiles' | 'nodes' | 'rule'
}

export function SectionDivider({ spacing = 0, variant = 'tiles' }: SectionDividerProps) {
  return (
    <div
      aria-hidden
      style={{
        margin: `${spacing}px auto`,
        maxWidth: 1280,
        padding: '0 64px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, var(--border-subtle) 50%, var(--border-subtle) 100%)',
        }}
      />
      {variant === 'tiles' && (
        <svg width="28" height="22" viewBox="0 0 28 22" style={{ color: 'var(--brand-primary)', opacity: 0.55 }}>
          <rect x="0" y="0" width="9" height="9" rx="1" fill="currentColor" opacity="0.95" />
          <rect x="11" y="2" width="9" height="9" rx="1" fill="currentColor" opacity="0.65" />
          <rect x="5" y="12" width="9" height="9" rx="1" fill="currentColor" opacity="0.4" />
        </svg>
      )}
      {variant === 'nodes' && (
        <svg width="56" height="14" viewBox="0 0 56 14" style={{ color: 'var(--brand-primary)', opacity: 0.55 }}>
          <line x1="8" y1="7" x2="24" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="32" y1="7" x2="48" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.95" />
          <circle cx="28" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <rect x="46" y="2" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.5" />
        </svg>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(90deg, var(--border-subtle) 0%, var(--border-subtle) 50%, transparent 100%)',
        }}
      />
    </div>
  )
}

// HeroOrnament — abstract "many sources → one model" diagram anchored top-
// left of the hero, in the negative space above the headline. No text
// labels — the right column already prints "5,234 / openLCA · PubChem · EIA"
// so we only carry the visual structure here.
export function HeroOrnament() {
  return (
    <svg
      aria-hidden
      width="180"
      height="80"
      viewBox="0 0 180 80"
      style={{
        position: 'absolute',
        top: -56,
        right: 0,
        color: 'var(--brand-primary)',
        opacity: 0.32,
        pointerEvents: 'none',
      }}
    >
      {/* Three small source tiles on the left converging into a single sink */}
      <rect x="2" y="6" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="2" y="35" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="2" y="64" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
      {/* Curved feeds */}
      <path d="M 16 11 C 60 11, 60 40, 92 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M 16 40 L 92 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M 16 69 C 60 69, 60 40, 92 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      {/* Sink — model node */}
      <circle cx="100" cy="40" r="8" fill="currentColor" opacity="0.18" />
      <circle cx="100" cy="40" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
      {/* Output trace — small sparkline tailing off to the right */}
      <path
        d="M 112 40 L 124 36 L 132 42 L 142 32 L 152 38 L 164 28 L 176 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  )
}

// StepGlyph — small domain SVG paired with each numbered step in
// "How it works." Three variants matching the three steps.
export function StepGlyph({ kind }: { kind: 'tree' | 'methods' | 'export' }) {
  const common = {
    width: 48,
    height: 48,
    viewBox: '0 0 48 48',
    style: { color: 'var(--brand-primary)', opacity: 0.85, marginBottom: 16 } as const,
  }
  if (kind === 'tree') {
    return (
      <svg {...common} aria-hidden>
        {/* Hierarchy tree — 1 root, 2 mid, 3 leaves */}
        <rect x="20" y="2" width="8" height="6" rx="1" fill="currentColor" />
        <line x1="24" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1" />
        <line x1="24" y1="8" x2="36" y2="16" stroke="currentColor" strokeWidth="1" />
        <rect x="8" y="16" width="8" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="32" y="16" width="8" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <line x1="12" y1="22" x2="6" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        <line x1="12" y1="22" x2="18" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        <line x1="36" y1="22" x2="42" y2="32" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        <rect x="2" y="32" width="8" height="6" rx="1" fill="currentColor" opacity="0.45" />
        <rect x="14" y="32" width="8" height="6" rx="1" fill="currentColor" opacity="0.45" />
        <rect x="38" y="32" width="8" height="6" rx="1" fill="currentColor" opacity="0.45" />
      </svg>
    )
  }
  if (kind === 'methods') {
    return (
      <svg {...common} aria-hidden>
        {/* Three overlapping method "tabs" — CML / ReCiPe / TRACI */}
        <rect x="2" y="6" width="28" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <rect x="10" y="14" width="28" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
        <rect x="18" y="22" width="28" height="14" rx="2" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1" />
        {/* Region pin */}
        <circle cx="38" cy="42" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="38" cy="42" r="1.2" fill="currentColor" />
      </svg>
    )
  }
  // 'export'
  return (
    <svg {...common} aria-hidden>
      {/* PDF doc with a download arrow and ISO seal */}
      <rect x="6" y="4" width="26" height="34" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="10" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="10" y1="18" x2="28" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <line x1="10" y1="24" x2="22" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <line x1="10" y1="30" x2="26" y2="30" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      {/* ISO seal */}
      <circle cx="38" cy="14" r="6" fill="currentColor" opacity="0.18" />
      <circle cx="38" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
      <text x="32.5" y="16.5" fontSize="5" fill="currentColor" fontFamily="ui-monospace, monospace" fontWeight="700">
        ISO
      </text>
      {/* Download arrow */}
      <line x1="22" y1="40" x2="22" y2="46" stroke="currentColor" strokeWidth="1.2" />
      <path d="M 19 43 L 22 46 L 25 43" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
