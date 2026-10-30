'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export interface MagicInsightsShellProps {
  onClose: () => void
  children: ReactNode
}

/**
 * The design system's dialog for Magic Insights: a scrim (a click outside
 * closes), focus moves in and stays inside (Tab wraps), Esc closes, and focus
 * returns to the button that opened it.
 */
export function MagicInsightsShell({ onClose, children }: MagicInsightsShellProps) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => !el.hasAttribute('disabled'))
    focusables()[0]?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="ds-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="ds-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Magic Insights"
        style={{ width: 680, maxWidth: '92vw', maxHeight: '88vh', overflow: 'auto', padding: 0 }}
      >
        {children}
      </div>
    </div>
  )
}
