'use client'

// The public landing (F1.1), or, with NEXT_PUBLIC_LCAPIX_SHELL=classic, the
// landing it replaces. Both send a signed-in visitor to Home.

import dynamic from 'next/dynamic'
import { EduLanding } from '@/components/lcapix/landing/edu-landing'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicLanding = dynamic(() => import('./_components/classic-landing'))

export default function RootPage() {
  return EDU_SHELL ? <EduLanding /> : <ClassicLanding />
}
