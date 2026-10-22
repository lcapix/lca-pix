'use client'

import { useEffect, useRef, useState } from 'react'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useCountUp(target: number, durationMs = 700, precision = 2): number {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(0)

  useEffect(() => {
    // Snap to the target (no animation) when motion is reduced or the tab is
    // hidden. requestAnimationFrame is paused in background/hidden tabs, so a
    // pure-rAF count-up would otherwise stick at its start value (0) forever —
    // e.g. a dashboard KPI loading its data while the tab isn't focused.
    const hidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (prefersReducedMotion() || hidden) {
      setValue(target)
      return
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startTimeRef.current = null
    startValueRef.current = value

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = easeOutCubic(progress)
      const next = startValueRef.current + (target - startValueRef.current) * eased
      setValue(next)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    // Safety net: if rAF never fires (tab hidden mid-animation, throttled,
    // jank), force the final value once the duration has elapsed so the number
    // always lands on `target` rather than freezing partway.
    const settle = setTimeout(() => setValue(target), durationMs + 80)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearTimeout(settle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs])

  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}
