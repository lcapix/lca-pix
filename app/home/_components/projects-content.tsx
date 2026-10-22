'use client'

// Projects content: the load error, the skeleton, the empty state, or the
// projects as a grid or a list. One spot, one of five views.

import type { CoercedProject, ViewMode } from '@/lib/home/projects'
import { emptyProjectsView, projectsErrorView, projectsSkeletonView } from './project-states'
import { projectGridView, projectListView } from './project-list-views'

export interface ProjectsContentProps {
  projectsError: string | null
  onRetry: () => void
  isLoadingProjects: boolean
  projectCount: number
  view: ViewMode
  filtered: CoercedProject[]
  handleOpenProject: (projectId: string) => void
  onNewProject: () => void
  onLoadExample: () => void
  loadingExample: boolean
}

export function ProjectsContent({
  projectsError,
  onRetry,
  isLoadingProjects,
  projectCount,
  view,
  filtered,
  handleOpenProject,
  onNewProject,
  onLoadExample,
  loadingExample,
}: ProjectsContentProps) {
  return projectsError
    ? projectsErrorView({ projectsError, onRetry })
    : isLoadingProjects
      ? projectsSkeletonView()
      : projectCount === 0
        ? emptyProjectsView({ onNewProject, onLoadExample, loadingExample })
        : view === 'grid'
          ? projectGridView({ filtered, handleOpenProject })
          : projectListView({ filtered, handleOpenProject })
}
