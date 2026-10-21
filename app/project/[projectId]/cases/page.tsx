'use client'

// The open project's Cases (E07 pipeline, E07b table), or, with
// NEXT_PUBLIC_LCAPIX_SHELL=classic, the project page's case list.

import dynamic from 'next/dynamic'
import { CasesPage } from '@/components/lcapix/project/cases-page'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicProject = dynamic(() => import('@/components/lcapix/project/project-overview-page'))

export default function ProjectCasesPage() {
  return EDU_SHELL ? <CasesPage /> : <ClassicProject />
}
