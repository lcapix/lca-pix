'use client'

// A project's Overview. The sample study's is its read-only Overview (E02):
// seven sections in research order. Other projects keep the classic overview:
// no education screen designs one (open for Shreya and Kavish; Cases, E07, is
// the project's working page).

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EmptyState } from '@/components/lcapix/ds'
import ProjectOverviewPage from '@/components/lcapix/project/project-overview-page'
import { SampleOverview } from '@/components/lcapix/home/sample-overview'
import { useShellData } from '@/lib/shell/use-shell'
import { EDU_SHELL } from '@/lib/ui-flags'

export default function ProjectPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { projects, profile, status } = useShellData()
  const here = projects.find((p) => p.project_id === projectId)
  // Which overview to show depends on the projects the shell loads, so wait
  // for them: rendering the classic overview first let its own 404 handler
  // redirect to Home before "not here" could be said.
  if (EDU_SHELL && status !== 'ready' && status !== 'error' && !here) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the project…
      </div>
    )
  }
  // Not among the projects the shell loaded: missing, or not shared with this
  // person. Say so (the server answers 404 and sends none of its data).
  if (EDU_SHELL && status === 'ready' && !here) {
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
  if (EDU_SHELL && here?.is_sample) {
    const owns = projects.some((p) => !p.is_sample && p.owner_id === profile?.id)
    return <SampleOverview projectId={projectId} ownName={profile?.fullName?.trim() || null} ownsProject={owns} />
  }
  return <ProjectOverviewPage />
}
