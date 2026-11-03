'use client'

// The panel beside the tree (canvas.md "The step panel", E05): its title over
// the Step, Results or Write-up content. It sits in the case's one docked
// panel (side-panel.tsx) beside the tree, never over it, with Documents as
// the panel's other tab. The side it is docked to is kept per device.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/lcapix/ds'
import { discardAndGo, keepEditing, saveAndGo, useUnsavedState } from '@/lib/workspace/unsaved'

export type Dock = 'right' | 'left'
const DOCK_KEY = 'lcapix-panel-dock'
const DOCK_EVENT = 'lcapix:panel-dock'

/** The side the docked panel sits on, kept per device. */
export function useDock(): [Dock, (d: Dock) => void] {
  const [dock, setDock] = useState<Dock>('right')
  useEffect(() => {
    try {
      if (localStorage.getItem(DOCK_KEY) === 'left') setDock('left')
    } catch {}
    const on = (e: Event) => setDock((e as CustomEvent<Dock>).detail)
    window.addEventListener(DOCK_EVENT, on)
    return () => window.removeEventListener(DOCK_EVENT, on)
  }, [])
  const set = (d: Dock) => {
    setDock(d)
    try {
      localStorage.setItem(DOCK_KEY, d)
    } catch {}
    window.dispatchEvent(new CustomEvent(DOCK_EVENT, { detail: d }))
  }
  return [dock, set]
}

/**
 * B3: the bar that asks before unsaved edits are left behind (another step,
 * another tab, a link, browser back): Save, Discard, or stay. It shows only
 * while a move is held.
 */
export function UnsavedBar() {
  const { labels, pending, saving } = useUnsavedState()
  if (!pending) return null
  return (
    <div className="ws-unsaved-bar" role="alertdialog" aria-label="You have unsaved changes" data-unsaved-bar>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>You have unsaved changes</strong>
        {labels.length > 0 && <span className="ws-unsaved-what">: {labels.join(', ')}</span>}
      </span>
      <Button variant="dark" size="small" busy={saving} onClick={() => void saveAndGo()}>
        Save
      </Button>
      <Button size="small" onClick={discardAndGo}>
        Discard
      </Button>
      <button type="button" className="ds-link" onClick={keepEditing}>
        Keep editing
      </button>
    </div>
  )
}

/**
 * The docked panel the page's own content goes into (side-panel.tsx): the
 * case gives it the slot, and learns the tab name (Step, Results, Write-up)
 * and which content is open, so a step clicked while Documents shows brings
 * the step back.
 */
export interface SideSlot {
  slot: HTMLElement | null
  setMain: (main: { tab: string; key: string } | null) => void
}
export const SideSlotContext = createContext<SideSlot | null>(null)

export function FloatingPanel({ tab, label, title, children }: { tab: string; label: string; title: ReactNode; children: ReactNode }) {
  const side = useContext(SideSlotContext)
  const setMain = side?.setMain
  useEffect(() => {
    setMain?.({ tab, key: label })
    return () => setMain?.(null)
  }, [setMain, tab, label])

  const panel = (
    <aside className="ws-panel" aria-label={label}>
      <div className="ws-panel-head">
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      <div className="ws-panel-body">{children}</div>
    </aside>
  )
  return side?.slot ? createPortal(panel, side.slot) : null
}
