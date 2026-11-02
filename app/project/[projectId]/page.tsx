'use client'

// A project's own address (C1). There is no Overview page any more: a project
// opens on its Cases board, and the address is replaced so browser back never
// lands here again. The sample opens on its study page (read-only, with
// "Open my copy" once there is one).

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { EmptyState } from '@/components/lcapix/ds'
import { SampleOverview } from '@/components/lcapix/home/sample-overview'
import { useShellData } from '@/lib/shell/use-shell'

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = Number(params.projectId)
  const { projects, profile, status } = useShellData()
  const here = projects.find((p) => p.project_id === projectId)
  const toCases = !!here && !here.is_sample
  useEffect(() => {
    if (toCases) router.replace(`/project/${projectId}/cases`)
  }, [toCases, projectId, router])

  // Not among the projects the shell loaded: missing, or not shared with this
  // person. Say so (the server answers 404 and sends none of its data).
  if (status === 'ready' && !here) {
    return (
      <div className="np">
        <h1 className="ds-title" style={{ margin: '0 0 12px' }}>
          Project not found
        </h1>
        <EmptyState
          line="This project is not here. It may have been deleted, or it is not shared with you."
          action={
            <Link className="ds-btn" href="/home">
              Go to Home
            </Link>
          }
        />
      </div>
    )
  }
  if (here?.is_sample) {
    const userId = profile?.id ?? -1
    const ownsProject = projects.some((p) => !p.is_sample && Number(p.owner_id) === userId)
    return <SampleOverview projectId={projectId} ownName={profile?.fullName?.trim() || null} ownsProject={ownsProject} />
  }
  return (
    <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
      Loading the project…
    </div>
  )
}
