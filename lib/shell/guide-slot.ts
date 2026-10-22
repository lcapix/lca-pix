'use client'

/**
 * One guide voice at a time (behaviour spec "Sequence"): a page may place one
 * guide card in the sidebar, above the Guided mode switch (E02's "Section 1
 * of 7"). The page sets it while it is mounted and clears it on the way out.
 */

import { useEffect, type ReactNode } from 'react'
import { create } from 'zustand'

interface GuideSlot {
  card: ReactNode | null
  set: (card: ReactNode | null) => void
}

export const useGuideSlot = create<GuideSlot>()((set) => ({ card: null, set: (card) => set({ card }) }))

/** Show `card` in the sidebar while the calling component is mounted (null shows nothing). */
export function useSidebarGuide(card: ReactNode | null) {
  const set = useGuideSlot((s) => s.set)
  useEffect(() => {
    set(card)
  }, [card, set])
  useEffect(() => () => set(null), [set])
}
