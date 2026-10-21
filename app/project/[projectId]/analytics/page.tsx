'use client'

// The open project's Analytics (E10: how far the class got), or, with
// NEXT_PUBLIC_LCAPIX_SHELL=classic, the case-by-case analytics it replaces.

import dynamic from 'next/dynamic'
import { AnalyticsPage } from '@/components/lcapix/project/analytics-page'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicAnalytics = dynamic(() => import('./_components/classic-analytics'))

export default function ProjectAnalyticsPage() {
  return EDU_SHELL ? <AnalyticsPage /> : <ClassicAnalytics />
}
