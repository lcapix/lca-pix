'use client'

// The open project's Compare (E09, E09b), or, with
// NEXT_PUBLIC_LCAPIX_SHELL=classic, the tabbed comparison it replaces.

import dynamic from 'next/dynamic'
import { ComparePage } from '@/components/lcapix/compare/compare-page'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicComparison = dynamic(() => import('./_components/classic-comparison'))

export default function ProjectComparePage() {
  return EDU_SHELL ? <ComparePage /> : <ClassicComparison />
}
