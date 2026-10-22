'use client'

// The case editor's optional pane: the reference pane holds the document a
// person types their quantities from, beside the editor. ?reference=1 (the
// build-by-hand path) opens it.

import { useEffect, useState } from 'react'

export function useEditorPanels() {
  const [referenceOpen, setReferenceOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('reference') === '1') setReferenceOpen(true)
  }, [])

  return { referenceOpen, setReferenceOpen }
}
