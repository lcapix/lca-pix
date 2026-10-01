'use client'

/** Small badge: green when the substance has impact factors, loud when not —
 * picking a factorless substance used to silently contribute zero
 * (tool-review bug #1). */
export function FactorCoverageBadge({ s }: { s: { methods_with_factors?: string; factor_count?: number } }) {
  const methods = (s.methods_with_factors || '').split('|').filter(Boolean)
  const has = (s.factor_count ?? 0) > 0 && methods.length > 0
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        padding: '1px 6px',
        borderRadius: 999,
        background: has
          ? 'oklch(from var(--brand-primary) l c h / 0.14)'
          : 'oklch(from var(--signal-error) l c h / 0.14)',
        color: has ? 'var(--brand-primary)' : 'var(--signal-error)',
        whiteSpace: 'nowrap',
      }}
      title={
        has
          ? `Impact factors available: ${methods.join(', ')}`
          : 'No impact factors — flows of this substance will contribute ZERO to every category'
      }
    >
      {has ? `✓ ${methods.map((m) => m.split(' ')[0]).join(' · ')}` : 'no impact factors'}
    </span>
  )
}
