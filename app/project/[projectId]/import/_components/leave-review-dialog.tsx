'use client'

// "Leave this review?" (B3): asked before anything takes the person off an
// open review. Keep reviewing is first and has the focus; Leave throws the
// read and the edits away, and says that the read is already used.

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/lcapix/ds'

export function LeaveReviewDialog({
  readsLeft,
  onKeep,
  onLeave,
}: {
  readsLeft: { limit: number; remaining: number } | null
  onKeep: () => void
  onLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const keepRef = useRef(onKeep)
  keepRef.current = onKeep
  const titleId = useId()
  const bodyId = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('button') ?? []).filter((b) => !b.hasAttribute('disabled'))
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        keepRef.current()
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
  const reads = readsLeft ? ` You have ${readsLeft.remaining} of ${readsLeft.limit} reads left this hour.` : ''
  return (
    <div className="ds-scrim" onMouseDown={(e) => e.target === e.currentTarget && onKeep()}>
      <div ref={ref} className="ds-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId} className="ds-dialog-title">
          Leave this review?
        </h2>
        <p id={bodyId} className="ds-dialog-body">
          Nothing from this file is saved yet. If you leave, what we read and your changes are thrown away, and reading the file again uses another read.{reads}
        </p>
        <div className="ds-dialog-actions">
          <Button variant="primary" onClick={onKeep}>
            Keep reviewing
          </Button>
          <Button variant="danger" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </div>
    </div>
  )
}
