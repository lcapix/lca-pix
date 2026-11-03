'use client'

// The case's one docked panel (UX 2): a column beside the tree, never over
// it, with two tabs. The first holds the page's own content (Step on the
// Tree, Results, Write-up), which the tab puts in through FloatingPanel; the
// second is Documents. Switching tabs keeps what each holds (an unsaved
// amount, an open document and its search). It docks left or right, kept
// per device; Hide panel in the tab row hides it.

import { IconButton } from '@/components/lcapix/ds'
import { useDock } from './floating-panel'
import type { ReactNode } from 'react'

export type SideShows = 'main' | 'docs'

export function SidePanel({
  visible,
  mainTab,
  shows,
  onShow,
  onSlot,
  docs,
}: {
  visible: boolean
  /** The first tab's name, or null when the page puts nothing in the panel (the Inventory, an empty tree). */
  mainTab: string | null
  shows: SideShows
  onShow: (s: SideShows) => void
  onSlot: (el: HTMLElement | null) => void
  /** The Documents panel once it is open, else null. */
  docs: ReactNode
}) {
  const [dock, setDock] = useDock()
  const showing: SideShows = mainTab ? shows : 'docs'
  return (
    <div className="ws-side" data-dock={dock} hidden={!visible}>
      <div className="ws-side-tabs" role="tablist" aria-label="Side panel">
        {mainTab && (
          <button
            type="button"
            role="tab"
            id="ws-side-tab-main"
            className="ws-side-tab"
            aria-selected={showing === 'main'}
            aria-controls="ws-side-main"
            aria-label={`${mainTab} panel`}
            onClick={() => onShow('main')}
          >
            {mainTab}
          </button>
        )}
        <button
          type="button"
          role="tab"
          id="ws-side-tab-docs"
          className="ws-side-tab"
          aria-selected={showing === 'docs'}
          aria-label="Documents panel"
          onClick={() => onShow('docs')}
        >
          Documents
        </button>
        <span style={{ flex: 1 }} />
        <IconButton label={`Move panel to the ${dock === 'right' ? 'left' : 'right'}`} onClick={() => setDock(dock === 'right' ? 'left' : 'right')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
            <path d={dock === 'right' ? 'M9.5 4.5v15' : 'M14.5 4.5v15'} />
          </svg>
        </IconButton>
      </div>
      <div id="ws-side-main" ref={onSlot} className="ws-side-main" role="tabpanel" aria-labelledby="ws-side-tab-main" hidden={showing !== 'main'} />
      {docs && (
        <div className="ws-side-docs" hidden={showing !== 'docs'}>
          {docs}
        </div>
      )}
    </div>
  )
}
