'use client'

import type { CSSProperties } from 'react'
import { useCountUp } from '@/lib/hooks/use-count-up'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
  style?: CSSProperties
}

export function AnimatedNumber({
  value,
  decimals = 2,
  duration = 800,
  prefix = '',
  suffix = '',
  className,
  style,
}: AnimatedNumberProps) {
  const v = useCountUp(value, duration, decimals)
  return (
    <span className={className} style={style}>
      {prefix}
      {v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
