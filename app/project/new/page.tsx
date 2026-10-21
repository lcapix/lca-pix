'use client'

// Start your own project (F2.1), or, with NEXT_PUBLIC_LCAPIX_SHELL=classic,
// the earlier form. The earlier form loads only on that rollback.

import dynamic from 'next/dynamic'
import { NewProjectForm } from '@/components/lcapix/project/new-project-form'
import { EDU_SHELL } from '@/lib/ui-flags'

const ClassicNewProject = dynamic(() => import('./_components/classic-new-project'))

export default function NewProjectPage() {
  return EDU_SHELL ? <NewProjectForm /> : <ClassicNewProject />
}
