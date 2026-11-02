'use client'

// Leaving Check what we read with the review open (B3). The read has already
// used one of the hourly reads, and the review edits live only on this page,
// so every way out asks first (Keep reviewing / Leave): the page's own Back
// link and Back button (through ask), browser back, a link in the sidebar,
// and closing or reloading the tab (the browser's own beforeunload prompt).
//
// Browser back: while the review is open one extra history entry (same URL)
// sits on top. Back pops it, so nothing leaves; the guard puts it back and
// asks. Leave then goes back past the page for real.

import { useCallback, useEffect, useRef, useState } from 'react'

const MARK = 'lcapixImportReview'

/** What Leave does: run the page's own action, or follow the link that was held. */
type Pending = { kind: 'run'; run: () => void; navigates: boolean } | { kind: 'link'; href: string }

export function useLeaveGuard(active: boolean, go: (href: string) => void) {
  const [pending, setPending] = useState<Pending | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  // Set while the page is leaving on purpose, so the guard lets it through.
  const leaving = useRef(false)

  // Close or reload the tab: the browser's own question (it shows its own words).
  useEffect(() => {
    if (!active) return
    const onUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [active])

  // Browser back.
  useEffect(() => {
    if (!active) return
    leaving.current = false
    window.history.pushState({ ...(window.history.state ?? {}), [MARK]: true }, '', window.location.href)
    const onPop = () => {
      if (leaving.current || !activeRef.current) return
      // Back took off the extra entry: put it back, then ask.
      window.history.pushState({ ...(window.history.state ?? {}), [MARK]: true }, '', window.location.href)
      setPending({
        kind: 'run',
        navigates: true,
        // Past the extra entry and this page, to where the person came from.
        run: () => window.history.go(-2),
      })
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // The review ended on this page (saved, or Start over): take the extra
      // entry off again, so the next Back does not land on this same page.
      if (!leaving.current && window.history.state?.[MARK]) {
        leaving.current = true
        window.history.back()
      }
    }
  }, [active])

  // A link anywhere on the page (the sidebar, a breadcrumb) asks before it
  // goes. Capture phase, so it runs before the link's own click handler.
  useEffect(() => {
    if (!active) return
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      setPending({ kind: 'link', href: url.pathname + url.search + url.hash })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [active])

  /**
   * Runs `leaveNow` at once when no review is open; otherwise asks first.
   * `navigates`: false when the page stays (Start over), so the extra history
   * entry is taken off again.
   */
  const ask = useCallback((leaveNow: () => void, navigates = true) => {
    if (!activeRef.current) return leaveNow()
    setPending({ kind: 'run', run: leaveNow, navigates })
  }, [])

  const keep = useCallback(() => setPending(null), [])
  const leave = useCallback(() => {
    const p = pending
    setPending(null)
    if (!p) return
    if (p.kind === 'link' || p.navigates) leaving.current = true
    if (p.kind === 'link') go(p.href)
    else p.run()
  }, [pending, go])

  return { asking: pending !== null, ask, keep, leave }
}
