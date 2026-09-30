'use client'

// Small shared pieces for the comparison views.

import type { ReactNode } from 'react'
import { HelpTip } from '@/components/lcapix/help-tip'
import { fmtNum } from '@/components/lcapix'
import type { CompareCase } from './types'
export { pctChange as pctOf } from '@/lib/compare/analytics'

export const SERIES_COLORS = ['#2d6a4f', '#74c69d', '#d98568', '#9f88cc', '#4f90c9', '#c9a227', '#6b8f71', '#b5651d']
export const seriesColor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]

export const GOOD = 'var(--signal-success, #16a34a)'
export const BAD = '#b45309'

/**
 * Why a case's results are not read: no run yet, or an incomplete run (no
 * flows, nothing computed), which is never compared or ranked.
 */
export function notComparableText(c: Pick<CompareCase, 'name' | 'run' | 'statusReason'>): string {
  if (!c.run) return `${c.name} has no run yet`
  return `${c.name} is incomplete (${(c.statusReason ?? 'nothing computed').toLowerCase()}), so it is not compared`
}

/** "+0.03" / "−0.43" with a true minus sign; "0" stays unsigned. */
export function signed(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (n === 0) return fmtNum(0, digits)
  return `${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n), digits)}`
}

/** Four significant digits, so 88.62 and 0.007334 both keep their detail. */
export function sig(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  return Number(n.toPrecision(digits)).toLocaleString('en-US', { maximumSignificantDigits: digits })
}

export function signedSig(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${sig(Math.abs(n), digits)}`
}

export function signedPct(n: number | null | undefined, digits = 1): string {
  const s = signed(n, digits)
  return s === '—' ? s : `${s}%`
}

export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function signedMoney(n: number): string {
  if (Math.abs(n) < 0.005) return '$0.00'
  return `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`
}

/** A titled card with an optional hover explanation and controls on the right. */
export function Panel({
  title,
  help,
  actions,
  children,
}: {
  title: string
  help?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
          {help && <HelpTip label={`About ${title.toLowerCase()}`}>{help}</HelpTip>}
        </div>
        <div style={{ flex: 1 }} />
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 7,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-raised)',
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              fontWeight: on ? 600 : 400,
              background: on ? 'var(--surface-overlay, #fff)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SelectBox({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
      {label}
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ height: 30, fontSize: 12, padding: '0 8px', minWidth: 120 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  padding: '8px 10px',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
}

export const td: React.CSSProperties = {
  fontSize: 12.5,
  padding: '8px 10px',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  verticalAlign: 'top',
}

export const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }

export function Muted({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{children}</div>
}
