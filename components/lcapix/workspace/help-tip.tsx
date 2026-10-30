'use client'

// A small "?" beside a field that opens its plain-language explanation (the
// ISO help a student reads everywhere). A button, so a keyboard reaches it;
// Esc or a click outside closes it.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button
        type="button"
        className="ds-icon-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        style={{ width: 24, height: 24, fontSize: 12 }}
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className="ds-popover" style={{ position: 'absolute', left: 0, top: 28, width: 320, zIndex: 20, padding: 12, fontSize: 13, lineHeight: '19px', fontWeight: 400 }}>
          {children}
        </span>
      )}
    </span>
  )
}
