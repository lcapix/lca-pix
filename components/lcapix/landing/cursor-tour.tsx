'use client'

// CursorTour — animated cursor that walks between elements inside a parent
// container, "clicking" them in sequence. Replaces the static arrow/callout
// tour. Each step optionally fires an onClick callback so the mockup can react
// (switching active category, advancing methods, etc.).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface CursorStep {
  /** CSS selector inside the parent container the cursor will travel to. */
  selector: string
  /** Short caption that rides beside the cursor while it's on this step. */
  label: string
  /** Fired when the cursor "arrives" — use to simulate the click in state. */
  onClick?: () => void
  /** ms the cursor pauses on this step before moving on (default 2600). */
  holdMs?: number
}

interface CursorTourProps {
  containerRef: React.RefObject<HTMLElement>
  steps: CursorStep[]
  /** ms between automatic step advances (overrides each step's holdMs). */
  intervalMs?: number
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function CursorTour({ containerRef, steps, intervalMs }: CursorTourProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [clicking, setClicking] = useState(false)
  // Stash steps in a ref so the tour clock and arrival effect don't restart
  // every time the parent re-renders (each render produces a new array).
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const clickedAtStepRef = useRef<number>(-1)
  const stepCount = steps.length

  // Drive the tour clock — depends only on stepIdx so a parent re-render
  // doesn't cancel and reschedule the in-flight timer.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const hold = intervalMs ?? stepsRef.current[stepIdx]?.holdMs ?? 2600
    const t = setTimeout(() => setStepIdx((i) => (i + 1) % stepCount), hold)
    return () => clearTimeout(t)
  }, [stepIdx, stepCount, intervalMs])

  // Recompute target position whenever the active step changes or the
  // container resizes (number morphs may reflow neighbors slightly).
  useLayoutEffect(() => {
    const compute = () => {
      const container = containerRef.current
      if (!container) return
      const step = stepsRef.current[stepIdx]
      const target = container.querySelector<HTMLElement>(step.selector)
      const cr = container.getBoundingClientRect()
      setContainerSize({ w: cr.width, h: cr.height })
      if (!target) {
        setPos(null)
        return
      }
      const tr = target.getBoundingClientRect()
      setPos((prev) => {
        const x = tr.left - cr.left + tr.width / 2
        const y = tr.top - cr.top + tr.height / 2
        // Skip identical updates to avoid retriggering the arrival effect.
        if (prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5) {
          return prev
        }
        return { x, y }
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  // Fire the click effect ~700ms after arrival. Guarded so each stepIdx only
  // produces one click even if pos updates again from a parent re-render.
  useEffect(() => {
    if (!pos) return
    if (clickedAtStepRef.current === stepIdx) return
    const arriveTimer = setTimeout(() => {
      if (clickedAtStepRef.current === stepIdx) return
      clickedAtStepRef.current = stepIdx
      setClicking(true)
      stepsRef.current[stepIdx]?.onClick?.()
      const pulseTimer = setTimeout(() => setClicking(false), 380)
      return () => clearTimeout(pulseTimer)
    }, 700)
    return () => clearTimeout(arriveTimer)
  }, [pos, stepIdx])

  if (!pos) return null

  // Label sits below-right of the cursor unless that would clip — then flip.
  const labelW = 240
  const labelH = 44
  const placeBelow = pos.y + 18 + labelH < containerSize.h - 8
  const placeRight = pos.x + 14 + labelW < containerSize.w - 8
  const labelTop = placeBelow ? pos.y + 18 : pos.y - 18 - labelH
  const labelLeft = placeRight ? pos.x + 14 : pos.x - 14 - labelW

  return (
    <>
      {/* Click pulse ring */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: pos.y,
          left: pos.x,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: 7,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: -22,
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '2px solid var(--brand-primary)',
            opacity: clicking ? 0 : 0,
            transform: clicking ? 'scale(1.4)' : 'scale(0.4)',
            transition: clicking
              ? 'transform 380ms cubic-bezier(0.2,0.8,0.2,1), opacity 380ms ease-out'
              : 'none',
            animation: clicking ? 'cursor-pulse 380ms ease-out forwards' : 'none',
          }}
        />
      </div>

      {/* The cursor itself — translated to the target's center */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate3d(${pos.x - 6}px, ${pos.y - 4}px, 0) scale(${
            clicking ? 0.9 : 1
          })`,
          transformOrigin: '6px 4px',
          transition:
            'transform 760ms cubic-bezier(0.22, 0.85, 0.28, 1), opacity 200ms ease',
          pointerEvents: 'none',
          zIndex: 8,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
        }}
      >
        <svg width="22" height="26" viewBox="0 0 22 26">
          {/* Outline keeps the cursor visible on any background */}
          <path
            d="M2 1.5 L2 19.5 L7 15.5 L10 22 L13 21 L10 14.5 L17 14 Z"
            fill="white"
            stroke="oklch(0.22 0.02 240)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Floating caption */}
      <div
        style={{
          position: 'absolute',
          top: labelTop,
          left: labelLeft,
          width: labelW,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          fontSize: 12,
          lineHeight: 1.4,
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          zIndex: 7,
          transition:
            'top 760ms cubic-bezier(0.22, 0.85, 0.28, 1), left 760ms cubic-bezier(0.22, 0.85, 0.28, 1)',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.14em',
            color: 'var(--brand-primary)',
            fontWeight: 600,
            marginBottom: 2,
          }}
        >
          STEP {stepIdx + 1} / {steps.length}
        </div>
        <div>{steps[stepIdx]?.label}</div>
      </div>

      <style>{`
        @keyframes cursor-pulse {
          0%   { transform: scale(0.4); opacity: 0.85; }
          70%  { opacity: 0.35; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </>
  )
}
