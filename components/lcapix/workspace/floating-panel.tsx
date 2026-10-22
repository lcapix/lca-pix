'use client'

// The floating panel beside the tree (canvas.md "The step panel", E05): a
// handle, its title, a More menu (Dock right, Dock left, Reset position) and
// Collapse. The Step panel and the Results panel share it, so both dock and
// remember the side the same way. The side is kept per device.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconButton } from '@/components/lcapix/ds'

type Dock = 'right' | 'left'
const DOCK_KEY = 'lcapix-panel-dock'

function useDock(): [Dock, (d: Dock) => void] {
  const [dock, setDock] = useState<Dock>('right')
  useEffect(() => {
    try {
      if (localStorage.getItem(DOCK_KEY) === 'left') setDock('left')
    } catch {}
  }, [])
  const set = (d: Dock) => {
    setDock(d)
    try {
      localStorage.setItem(DOCK_KEY, d)
    } catch {}
  }
  return [dock, set]
}

export function FloatingPanel({ label, title, children }: { label: string; title: ReactNode; children: ReactNode }) {
  const [dock, setDock] = useDock()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLSpanElement>(null)
  const moreBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => !moreRef.current?.contains(e.target as Node) && setMoreOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false)
        moreBtn.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const pick = (fn: () => void) => () => {
    fn()
    setMoreOpen(false)
    moreBtn.current?.focus()
  }

  return (
    <aside className="ws-panel" data-dock={dock} data-collapsed={collapsed || undefined} aria-label={label}>
      <div className="ws-panel-head">
        <IconButton label={`Move panel to the ${dock === 'right' ? 'left' : 'right'}`} onClick={() => setDock(dock === 'right' ? 'left' : 'right')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {[6, 12, 18].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
          </svg>
        </IconButton>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span ref={moreRef} style={{ position: 'relative' }}>
          <IconButton ref={moreBtn} label="More for this panel" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
            <span aria-hidden style={{ fontWeight: 700, letterSpacing: 1 }}>
              ···
            </span>
          </IconButton>
          {moreOpen && (
            <div className="ws-menu" role="menu" style={{ right: 0, top: 38 }}>
              {(['right', 'left'] as Dock[]).map((d) => (
                <button key={d} type="button" role="menuitemradio" aria-checked={dock === d} onClick={pick(() => setDock(d))}>
                  Dock {d}
                </button>
              ))}
              <button type="button" role="menuitem" onClick={pick(() => (setDock('right'), setCollapsed(false)))}>
                Reset position
              </button>
            </div>
          )}
        </span>
        <IconButton label={collapsed ? 'Expand panel' : 'Collapse panel'} aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ transform: collapsed ? 'rotate(90deg)' : undefined }}>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </IconButton>
      </div>
      {!collapsed && <div className="ws-panel-body">{children}</div>}
    </aside>
  )
}
