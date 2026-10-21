'use client'

// New case (E18): a what-if copy or a new base case, in one form. ?from=
// picks the case to copy. With NEXT_PUBLIC_LCAPIX_SHELL=classic, the two
// older pages (comparative/new and base/new) stay reachable from the project.

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { NewCaseForm } from '@/components/lcapix/project/new-case-form'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicNewCase = dynamic(() => import('../comparative/new/page'))

export default function NewCasePage() {
  return EDU_SHELL ? (
    <Suspense fallback={null}>
      <NewCaseForm />
    </Suspense>
  ) : (
    <ClassicNewCase />
  )
}
