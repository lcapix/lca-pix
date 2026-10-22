'use client'

// The open project's People (E08, E08b), or, with
// NEXT_PUBLIC_LCAPIX_SHELL=classic, the class page (members and the privacy switch).

import dynamic from 'next/dynamic'
import { PeoplePage } from '@/components/lcapix/project/people-page'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicClass = dynamic(() => import('../class/page'))

export default function ProjectPeoplePage() {
  return EDU_SHELL ? <PeoplePage /> : <ClassicClass />
}
