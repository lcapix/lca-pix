'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Top-of-page route progress bar.
 * Shows a green 2px bar that slides 0 → 80% during navigation, then completes to 100% and fades.
 */
export function RouteProgress() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const firstRender = useRef(true)
  const keyRef = useRef(0)

  useEffect(() => {
    // Skip on very first mount so we don't flash a bar on initial load.
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    keyRef.current += 1
    setPhase('loading')
    const t1 = setTimeout(() => setPhase('done'), 600)
    const t2 = setTimeout(() => setPhase('idle'), 1000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [pathname])

  if (phase === 'idle') return null

  const width = phase === 'loading' ? '80%' : '100%'
  const opacity = phase === 'done' ? 0 : 1

  return (
    <div
      key={keyRef.current}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 2,
        width,
        background:
          'linear-gradient(90deg, var(--brand-primary), oklch(from var(--brand-primary) l c h / 0.85))',
        boxShadow: '0 0 8px oklch(from var(--brand-primary) l c h / 0.6)',
        zIndex: 9999,
        transition: 'width 600ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 380ms ease',
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}
