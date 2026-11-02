'use client'

// Home: the sample study's Overview first, then Continue, Needs attention and
// your projects. The layout (SignedIn) already guards the page. Home reads
// ?view=all (All projects), so it waits for the address in a Suspense.

import { Suspense } from 'react'
import { EduHome } from '@/components/lcapix/home/edu-home'

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <EduHome />
    </Suspense>
  )
}
