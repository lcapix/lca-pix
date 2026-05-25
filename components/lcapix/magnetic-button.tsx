'use client'

import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import Link from 'next/link'

interface MagneticLinkProps {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  /** Distance in px from button edge where magnetism activates. */
  radius?: number
  /** Maximum pixels the button shifts. */
  strength?: number
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function MagneticLink({
  href,
  className,
  style,
  children,
  radius = 80,
  strength = 8,
}: MagneticLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const onMove = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      const maxDist = Math.max(r.width, r.height) / 2 + radius
      if (dist > maxDist) {
        el.style.transform = ''
        return
      }
      const t = 1 - dist / maxDist
      const tx = (dx / maxDist) * strength * t
      const ty = (dy / maxDist) * strength * t
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`
    }
    const onLeave = () => {
      const el = ref.current
      if (el) el.style.transform = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [radius, strength])

  return (
    <Link
      ref={ref as any}
      href={href}
      className={`btn-magnetic ${className ?? ''}`}
      style={style}
    >
      {children}
    </Link>
  )
}
