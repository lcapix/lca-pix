'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useCountUp } from '@/lib/hooks/use-count-up'
import { Sparkline } from './sparkline'
import type { IconName } from './icon'
import { Icon } from './icon'

interface KpiTileProps {
  label: string
  value: number
  display?: string
  trend: string
  trendGood?: boolean | null
  spark: number[]
  icon?: IconName
  accent?: string
  delayMs?: number
  decimals?: number
  prefix?: string
  suffix?: string
  /**
   * Optional click-through route. When set, the tile becomes a clickable
   * button (pointer cursor + hover lift) and navigates on click. Use this
   * to give numeric KPIs a payoff — otherwise a user sees "162 Factors"
   * with no idea where to go to investigate.
   */
  href?: string
  /**
   * Short call-to-action shown under the trend line, e.g. "View library →".
   * Only renders when href is set.
   */
  hrefHint?: string
}

export function KpiTile({
  label,
  value,
  display,
  trend,
  trendGood,
  spark,
  icon,
  accent,
  delayMs = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  href,
  hrefHint,
}: KpiTileProps) {
  const router = useRouter()
  const animated = useCountUp(value, 900, decimals)
  const ref = useRef<HTMLDivElement>(null)

  // Mouse-following spotlight via CSS vars
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onMove = (e: MouseEvent) => {
      const r = node.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      node.style.setProperty('--mouse-x', `${x}%`)
      node.style.setProperty('--mouse-y', `${y}%`)
    }
    node.addEventListener('mousemove', onMove)
    return () => node.removeEventListener('mousemove', onMove)
  }, [])

  const accentColor = accent ?? 'var(--brand-primary)'
  const formatted =
    display ??
    `${prefix}${animated.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`

  const interactive = Boolean(href)
  const handleClick = () => {
    if (href) router.push(href)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!href) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(href)
    }
  }

  return (
    <div
      ref={ref}
      className={
        'tile-premium press-active fade-slide-up' +
        (interactive ? ' tile-interactive' : '')
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-label={interactive ? `${label}: ${formatted}. ${trend}. ${hrefHint ?? 'Open'}` : undefined}
      style={{
        animationDelay: `${delayMs}ms`,
        borderRadius: 14,
        cursor: interactive ? 'pointer' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 14,
          gap: 10,
        }}
      >
        {icon && (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `oklch(from ${accentColor} l c h / 0.12)`,
              color: accentColor,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={15} />
          </span>
        )}
        <div
          className="eyebrow"
          style={{
            color: 'var(--text-tertiary)',
            letterSpacing: '0.14em',
            fontSize: 10.5,
          }}
        >
          {label}
        </div>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 38,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {formatted}
      </div>
      <div
        style={{
          fontSize: 12,
          color: trendGood === true ? 'var(--signal-success, #16a34a)' : 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {trendGood === true && (
          <Icon name="arrow-up-right" size={12} style={{ color: 'currentColor' }} />
        )}
        {trend}
      </div>
      {interactive && hrefHint && (
        <div
          style={{
            fontSize: 11,
            color: accentColor,
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500,
          }}
        >
          {hrefHint}
          <Icon name="arrow-up-right" size={11} style={{ color: 'currentColor' }} />
        </div>
      )}
      <div className="tile-spark">
        <Sparkline data={spark} color={accentColor} width={84} height={32} />
      </div>
    </div>
  )
}
