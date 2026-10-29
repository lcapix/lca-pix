'use client'

// The full results page. The Results tab links here. An older run stays
// readable with ?run=.

import { Suspense } from 'react'
import { FullResults } from '@/components/lcapix/workspace/full-results'

export default function ResultsRoute() {
  return (
    <Suspense fallback={<p role="status">Loading results…</p>}>
      <FullResults />
    </Suspense>
  )
}
