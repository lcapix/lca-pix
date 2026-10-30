'use client'

// A project's Overview: the design-system hub for every project, the sample
// study included (P01). The sample opens read-only, with Make my own copy.

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EmptyState } from '@/components/lcapix/ds'
import { ProjectHub } from '@/components/lcapix/workspace/project-hub'
import { useShellData } from '@/lib/shell/use-shell'

export default function ProjectPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { projects, status } = useShellData()
  const here = projects.find((p) => p.project_id === projectId)
  // Wait for the projects the shell loads, so "not here" is said only once known.
  if (status !== 'ready' && status !== 'error' && !here) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the project…
      </div>
    )
  }
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
  return <ProjectHub />
}
