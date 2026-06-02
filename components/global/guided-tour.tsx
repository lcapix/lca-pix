'use client'

// GuidedTour — a user-controlled walkthrough overlay that highlights elements
// across the app, with Prev/Next/Skip controls and cross-page navigation.
//
// Designed for the "Walk me through" CTA on the empty-state home page.
//
// Each step targets a CSS selector. If the target lives on a different route,
// set `navigate` to the path; the tour will push the route and resume on land.
// State is persisted to localStorage so navigation doesn't lose progress.

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export interface TourStep {
  /** CSS selector for the element to highlight. */
  selector: string
  /** Title shown in the callout. */
  title: string
  /** Body text. */
  body: string
  /** Optional route to navigate to before showing this step. */
  navigate?: string
  /** Where to place the callout relative to the highlight. */
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'auto'
  /** Optional override for the "Next" label (e.g. "Got it"). */
  nextLabel?: string
  /** Optional: hint at an action the user should take. */
  actionHint?: string
}

interface GuidedTourProps {
  steps: TourStep[]
  /** Storage key — lets you run multiple distinct tours. */
  storageKey?: string
  open: boolean
  onClose: () => void
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface Box { top: number; left: number; width: number; height: number }

const SCROLL_PADDING = 80

export function GuidedTour({ steps, storageKey = 'lcapix-tour-v1', open, onClose }: GuidedTourProps) {
  const [idx, setIdx] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const findTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore step from storage when tour opens
  useEffect(() => {
    if (!open) return
    const saved = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
    if (saved) {
      const n = Number(saved)
      if (!isNaN(n) && n >= 0 && n < steps.length) setIdx(n)
    }
  }, [open, storageKey, steps.length])

  useEffect(() => {
    if (open) localStorage.setItem(storageKey, String(idx))
  }, [idx, storageKey, open])

  // Cross-page navigation: if the current step demands a route we're not on,
  // push it and wait for landing.
  useEffect(() => {
    if (!open) return
    const step = steps[idx]
    if (!step) return
    if (step.navigate && !pathname?.startsWith(step.navigate)) {
      router.push(step.navigate)
    }
  }, [idx, open, pathname, router, steps])

  // Locate target with retry — element may not be mounted immediately after
  // a route change.
  useEffect(() => {
    if (!open) return
    const step = steps[idx]
    if (!step) return

    let attempts = 0
    const tryFind = () => {
      const el = document.querySelector<HTMLElement>(step.selector)
      if (el) {
        const r = el.getBoundingClientRect()
        const top = r.top + window.scrollY
        // Scroll element into view if off-screen
        if (r.top < SCROLL_PADDING || r.bottom > window.innerHeight - SCROLL_PADDING) {
          window.scrollTo({
            top: top - SCROLL_PADDING - 60,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          })
          // Re-measure after scroll
          findTimerRef.current = setTimeout(() => {
            const el2 = document.querySelector<HTMLElement>(step.selector)
            if (el2) {
              const r2 = el2.getBoundingClientRect()
              setBox({
                top: r2.top + window.scrollY,
                left: r2.left + window.scrollX,
                width: r2.width,
                height: r2.height,
              })
            }
          }, 350)
          return
        }
        setBox({
          top: r.top + window.scrollY,
          left: r.left + window.scrollX,
          width: r.width,
          height: r.height,
        })
      } else if (attempts < 20) {
        attempts++
        findTimerRef.current = setTimeout(tryFind, 200)
      } else {
        // Target never appeared — show callout floating mid-screen
        setBox(null)
      }
    }
    setBox(null)
    if (findTimerRef.current) clearTimeout(findTimerRef.current)
    findTimerRef.current = setTimeout(tryFind, 150)
    return () => {
      if (findTimerRef.current) clearTimeout(findTimerRef.current)
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [idx, open, pathname, steps])

  if (!open) return null
  const step = steps[idx]
  if (!step) return null

  const close = () => {
    localStorage.removeItem(storageKey)
    setIdx(0)
    onClose()
  }
  const goNext = () => {
    if (idx + 1 >= steps.length) close()
    else setIdx((n) => n + 1)
  }
  const goPrev = () => setIdx((n) => Math.max(0, n - 1))

  // Compute callout placement
  const placement = step.placement ?? 'auto'
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  let calloutTop: number
  let calloutLeft: number
  let arrowFrom: { x: number; y: number } | null = null
  let arrowTo: { x: number; y: number } | null = null

  if (!box) {
    // Floating center fallback
    calloutTop = (typeof window !== 'undefined' ? window.scrollY : 0) + vh / 2 - 120
    calloutLeft = (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2 - 200
  } else {
    // Choose 'top' or 'bottom' by space
    const spaceBelow = vh - (box.top - window.scrollY + box.height)
    const auto = spaceBelow > 240 ? 'bottom' : 'top'
    const place = placement === 'auto' ? auto : placement
    const gap = 18
    const calloutW = 360
    const calloutH = 180
    switch (place) {
      case 'bottom':
        calloutTop = box.top + box.height + gap
        calloutLeft = Math.max(
          16,
          Math.min(
            box.left + box.width / 2 - calloutW / 2,
            (typeof window !== 'undefined' ? window.innerWidth : 1200) - calloutW - 16,
          ),
        )
        arrowFrom = { x: box.left + box.width / 2, y: box.top + box.height }
        arrowTo = { x: box.left + box.width / 2, y: box.top + box.height + gap }
        break
      case 'top':
        calloutTop = box.top - calloutH - gap
        calloutLeft = Math.max(
          16,
          Math.min(
            box.left + box.width / 2 - calloutW / 2,
            (typeof window !== 'undefined' ? window.innerWidth : 1200) - calloutW - 16,
          ),
        )
        arrowFrom = { x: box.left + box.width / 2, y: box.top }
        arrowTo = { x: box.left + box.width / 2, y: box.top - gap }
        break
      case 'right':
        calloutTop = box.top + box.height / 2 - calloutH / 2
        calloutLeft = box.left + box.width + gap
        arrowFrom = { x: box.left + box.width, y: box.top + box.height / 2 }
        arrowTo = { x: box.left + box.width + gap, y: box.top + box.height / 2 }
        break
      case 'left':
        calloutTop = box.top + box.height / 2 - calloutH / 2
        calloutLeft = box.left - calloutW - gap
        arrowFrom = { x: box.left, y: box.top + box.height / 2 }
        arrowTo = { x: box.left - gap, y: box.top + box.height / 2 }
        break
    }
  }

  return (
    <>
      {/* Backdrop — clicks pass through to elements except over the callout */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: Math.max(
            document.documentElement.scrollHeight,
            typeof window !== 'undefined' ? window.innerHeight : 0,
          ),
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          pointerEvents: 'none',
          zIndex: 9000,
        }}
      />

      {/* Spotlight cutout around the target via box-shadow */}
      {box && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
            borderRadius: 10,
            background: 'transparent',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.40)',
            outline: '2px solid var(--brand-primary)',
            outlineOffset: 2,
            zIndex: 9001,
            pointerEvents: 'none',
            animation: 'tourPulse 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Arrow */}
      {arrowFrom && arrowTo && (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9002,
          }}
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
            x1={arrowFrom.x}
            y1={arrowFrom.y}
            x2={arrowTo.x}
            y2={arrowTo.y}
            stroke="var(--brand-primary)"
            strokeWidth={2}
            markerEnd="url(#tourArrowHead)"
          />
        </svg>
      )}

      {/* Callout */}
      <div
        role="dialog"
        aria-label={`Tour step ${idx + 1} of ${steps.length}: ${step.title}`}
        style={{
          position: 'absolute',
          top: calloutTop,
          left: calloutLeft,
          width: 360,
          background: 'var(--surface-raised, white)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 12px 36px -8px rgba(15,23,42,0.30)',
          zIndex: 9003,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--brand-primary)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Step {idx + 1} of {steps.length}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
            letterSpacing: '-0.005em',
          }}
        >
          {step.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: step.actionHint ? 8 : 14,
          }}
        >
          {step.body}
        </div>
        {step.actionHint && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--brand-primary)',
              background: 'oklch(from var(--brand-primary) l c h / 0.10)',
              padding: '6px 10px',
              borderRadius: 6,
              marginBottom: 14,
              fontFamily: 'var(--font-mono)',
            }}
          >
            ↳ {step.actionHint}
          </div>
        )}
        {/* Dots */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {steps.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: i === idx ? 16 : 5,
                height: 5,
                borderRadius: 999,
                background: i === idx ? 'var(--brand-primary)' : 'var(--border-subtle)',
                transition: 'width 240ms',
              }}
            />
          ))}
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={close}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {idx > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="btn btn-secondary btn-sm"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="btn btn-primary btn-sm"
            >
              {step.nextLabel ?? (idx + 1 === steps.length ? 'Finish' : 'Next')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
