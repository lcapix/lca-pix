'use client'

// GlobalTour — mounts the guided tour on non-home pages (project routes) so
// the "Tour" button in the top nav can launch the walkthrough from wherever
// the user is, instead of bouncing them back to the dashboard.
//
// Listens for the window 'lcapix:start-tour' event (dispatched by the Tour
// button in AppTopBar). On launch it picks the step that matches the current
// page so the tour is contextual.

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { GuidedTour } from '@/components/global/guided-tour'
import { LCAPIX_TOUR_STEPS } from '@/lib/lcapix-tour-steps'

// Map the current pathname to the best starting step in LCAPIX_TOUR_STEPS.
// Indices follow the order defined in lib/lcapix-tour-steps.ts.
function stepForPath(pathname: string | null): number {
  if (!pathname) return 0
  if (/\/case\/[^/]+\/results/.test(pathname)) return 10 // results-total-impact
  if (/\/case\/[^/]+$/.test(pathname)) return 6 // case-add-component
  if (/\/project\/[^/]+$/.test(pathname)) return 3 // project-header
  return 0
}

export function GlobalTour() {
  const [open, setOpen] = useState(false)
  const [startAt, setStartAt] = useState<number>(0)
  // Bumped on each launch so <GuidedTour> remounts and re-runs its lazy idx
  // initializer at the contextual step (avoids the idx=0 redirect race).
  const [launchKey, setLaunchKey] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => {
      setStartAt(stepForPath(pathname))
      setLaunchKey((k) => k + 1)
      setOpen(true)
    }
    window.addEventListener('lcapix:start-tour', handler)
    return () => window.removeEventListener('lcapix:start-tour', handler)
  }, [pathname])

  return (
    <GuidedTour
      key={launchKey}
      steps={LCAPIX_TOUR_STEPS}
      open={open}
      startAt={startAt}
      onClose={() => setOpen(false)}
    />
  )
}
