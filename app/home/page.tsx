'use client'

// Home: the education Home (the sample study's Overview first, then Continue,
// Needs attention and your projects), or, with NEXT_PUBLIC_LCAPIX_SHELL=classic,
// the earlier dashboard. The dashboard loads only on that rollback. The layout
// (SignedIn) already guards the page.

import dynamic from 'next/dynamic'
import { EduHome } from '@/components/lcapix/home/edu-home'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicHome = dynamic(() => import('./_components/classic-home'))

export default function HomePage() {
  return EDU_SHELL ? <EduHome /> : <ClassicHome />
}
