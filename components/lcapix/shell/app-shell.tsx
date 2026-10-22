'use client'

// Every signed-in page sits in this shell (look.md 1): the page background,
// the white shell with the sidebar and the main area. A skip link goes first;
// on a phone the sidebar folds into a menu behind a bar.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { InShellContext } from './shell-context'
import { usePathname } from 'next/navigation'
import { IconButton } from '@/components/lcapix/ds'
import { Sidebar } from './sidebar'
import { PixelMark, ShellIcon } from './shell-icons'

export function AppShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false)
  const pathname = usePathname()
  const menuButton = useRef<HTMLButtonElement>(null)

  // A new page closes the phone menu.
  useEffect(() => setMenu(false), [pathname])
  useEffect(() => {
    if (!menu) return
    // Focus moves into the menu that just opened.
    document.querySelector<HTMLElement>('.ds-sidebar[data-open="true"] a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false)
        menuButton.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menu])

  return (
    <InShellContext.Provider value={true}>
    <div className="ds-page">
      <a href="#main" className="ds-skip">
        Skip to content
      </a>
      <div className="ds-shell">
        <div className="ds-phone-bar">
          <PixelMark size={26} />
          <span style={{ fontWeight: 700, flex: 1 }}>LCAPIX</span>
          <IconButton ref={menuButton} label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <ShellIcon name={menu ? 'close' : 'menu'} />
          </IconButton>
        </div>
        {menu && <div className="ds-scrim" style={{ zIndex: 85 }} onClick={() => setMenu(false)} aria-hidden />}
        <Sidebar open={menu} onNavigate={() => setMenu(false)} />
        <main id="main" className="ds-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
    </InShellContext.Provider>
  )
}
