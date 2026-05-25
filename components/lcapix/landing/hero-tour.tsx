'use client'

import { useEffect, useRef, useState } from 'react'

export interface TourStep {
  /** CSS selector inside the parent container that the highlight points to. */
  selector: string
  /** Short label rendered in the callout bubble. */
  label: string
  /** Where the callout should sit relative to the highlight. */
  placement?: 'top' | 'right' | 'bottom' | 'left'
}

interface HeroTourProps {
  /** Parent container the tour is bound to (positioning is relative to this). */
  containerRef: React.RefObject<HTMLElement>
  steps: TourStep[]
  /** ms between automatic step advances. */
  intervalMs?: number
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

export function HeroTour({ containerRef, steps, intervalMs = 3200 }: HeroTourProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const rafRef = useRef<number | null>(null)

  // Cycle through steps automatically (unless reduced motion).
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setInterval(() => setStepIdx((i) => (i + 1) % steps.length), intervalMs)
    return () => clearInterval(t)
  }, [steps.length, intervalMs])

  // Recompute target geometry on step change, resize, and mockup re-render.
  useEffect(() => {
    const compute = () => {
      const container = containerRef.current
      if (!container) return
      const step = steps[stepIdx]
      const target = container.querySelector<HTMLElement>(step.selector)
      if (!target) {
        setBox(null)
        return
      }
      const cr = container.getBoundingClientRect()
      const tr = target.getBoundingClientRect()
      setContainerWidth(cr.width)
      setContainerHeight(cr.height)
      setBox({
        top: tr.top - cr.top,
        left: tr.left - cr.left,
        width: tr.width,
        height: tr.height,
      })
    }
    // Defer to next frame so any layout transitions finish.
    rafRef.current = requestAnimationFrame(compute)
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', compute)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, steps])

  if (!box) return null

  const step = steps[stepIdx]
  const placement = step.placement ?? 'bottom'

  // Callout position based on placement
  const calloutPos: { top: number; left: number; transform?: string } = (() => {
    const gap = 14
    switch (placement) {
      case 'top':
        return { top: Math.max(8, box.top - gap - 50), left: box.left + box.width / 2, transform: 'translateX(-50%)' }
      case 'right':
        return { top: box.top + box.height / 2, left: Math.min(containerWidth - 250, box.left + box.width + gap), transform: 'translateY(-50%)' }
      case 'left':
        return { top: box.top + box.height / 2, left: Math.max(8, box.left - 240 - gap), transform: 'translateY(-50%)' }
      case 'bottom':
      default:
        return { top: Math.min(containerHeight - 60, box.top + box.height + gap), left: box.left + box.width / 2, transform: 'translateX(-50%)' }
    }
  })()

  // Arrow line from highlight edge to callout
  const arrow = (() => {
    let x1 = box.left + box.width / 2
    let y1 = box.top + box.height / 2
    let x2 = x1
    let y2 = y1
    switch (placement) {
      case 'top':
        y1 = box.top
        y2 = box.top - 14
        break
      case 'bottom':
        y1 = box.top + box.height
        y2 = box.top + box.height + 14
        break
      case 'left':
        x1 = box.left
        x2 = box.left - 14
        break
      case 'right':
        x1 = box.left + box.width
        x2 = box.left + box.width + 14
        break
    }
    return { x1, y1, x2, y2 }
  })()

  return (
    <>
      <div
        className="tour-highlight"
        style={{
          top: box.top - 4,
          left: box.left - 4,
          width: box.width + 8,
          height: box.height + 8,
        }}
      />
      <svg
        width={containerWidth}
        height={containerHeight}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}
      >
        <defs>
          <marker
            id="tourArrowHead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand-primary)" />
          </marker>
        </defs>
        <line
          x1={arrow.x1}
          y1={arrow.y1}
          x2={arrow.x2}
          y2={arrow.y2}
          stroke="var(--brand-primary)"
          strokeWidth={1.5}
          strokeDasharray="0"
          markerEnd="url(#tourArrowHead)"
          style={{ transition: 'all 520ms cubic-bezier(0.22, 0.9, 0.3, 1.2)' }}
        />
      </svg>
      <div
        className="tour-callout"
        style={{
          top: calloutPos.top,
          left: calloutPos.left,
          transform: calloutPos.transform,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--brand-primary)',
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          Step {stepIdx + 1} / {steps.length}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {step.label}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 8,
          }}
        >
          {steps.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: i === stepIdx ? 14 : 5,
                height: 5,
                borderRadius: 999,
                background: i === stepIdx ? 'var(--brand-primary)' : 'var(--border-subtle)',
                transition: 'width 320ms, background 320ms',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
