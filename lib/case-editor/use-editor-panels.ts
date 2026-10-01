'use client'

// The case editor's optional panes. The reference pane holds the document a
// person types their quantities from, beside the editor. Guided lessons are
// opened by ?learn=1 (the build-by-hand path, which also opens the reference
// pane) or the Learn button.

import { useEffect, useState } from 'react'

export function useEditorPanels() {
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [learnOpen, setLearnOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('learn') === '1') {
      setLearnOpen(true)
      setReferenceOpen(true)
    }
  }, [])

  return { learnOpen, setLearnOpen, referenceOpen, setReferenceOpen }
}
