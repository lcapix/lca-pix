'use client'

import { useEffect, useRef, type ReactNode } from 'react'
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
}: KpiTileProps) {
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

  return (
    <div
      ref={ref}
      className="tile-premium press-active fade-slide-up"
      style={{
        animationDelay: `${delayMs}ms`,
        borderRadius: 14,
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
      <div className="tile-spark">
        <Sparkline data={spark} color={accentColor} width={84} height={32} />
      </div>
    </div>
  )
}
