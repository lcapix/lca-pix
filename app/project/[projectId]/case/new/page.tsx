'use client'

// New case (E18): a what-if copy or a new base case, in one form. ?from=
// picks the case to copy.

import { Suspense } from 'react'
import { NewCaseForm } from '@/components/lcapix/project/new-case-form'

export default function NewCasePage() {
  return (
    <Suspense fallback={null}>
      <NewCaseForm />
    </Suspense>
  )
}
