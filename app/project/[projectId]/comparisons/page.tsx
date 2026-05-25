'use client'

// Redirect /project/[id]/comparisons → /project/[id]/analytics
// The analytics page is now the unified comparison view so numbers and
// visuals stay consistent across the app.

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ComparisonsRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  useEffect(() => {
    router.replace(`/project/${projectId}/analytics`)
  }, [projectId, router])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        color: 'var(--text-tertiary)',
        fontSize: 13,
      }}
    >
      Opening analytics…
    </div>
  )
}
