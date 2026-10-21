'use client'

// A case: the education workspace (Tree, Inventory, Results, Write-up), or,
// with NEXT_PUBLIC_LCAPIX_WORKSPACE=classic, the earlier case editor. The
// editor loads only on that rollback, so it never weighs on the workspace.

import dynamic from 'next/dynamic'
import { CaseWorkspace } from '@/components/lcapix/workspace/case-workspace'
import { EDU_WORKSPACE } from '@/lib/ui-flags'

const CaseEditorPage = dynamic(() => import('@/components/lcapix/case/editor/case-editor-page'))

export default function CasePage() {
  return EDU_WORKSPACE ? <CaseWorkspace /> : <CaseEditorPage />
}
