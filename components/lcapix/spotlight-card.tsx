'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useMouseSpotlight } from '@/lib/hooks/use-mouse-spotlight'

interface SpotlightCardProps {
  className?: string
  style?: CSSProperties
  children: ReactNode
  as?: 'div' | 'article' | 'section'
}

export function SpotlightCard({
  className,
  style,
  children,
  as = 'div',
}: SpotlightCardProps) {
  const ref = useMouseSpotlight<HTMLDivElement>()
  const Tag: any = as
  return (
    <Tag
      ref={ref}
      className={`card-spotlight ${className ?? ''}`}
      style={style}
    >
      {children}
    </Tag>
  )
}
