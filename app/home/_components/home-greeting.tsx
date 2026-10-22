'use client'

// Hero header: the greeting, how many projects are in flight, and New project.

import { Icon, SectionHeader } from '@/components/lcapix'

export function HomeGreeting({
  firstName,
  projectCount,
  isLoadingProjects,
  onNewProject,
}: {
  firstName: string
  projectCount: number
  isLoadingProjects: boolean
  onNewProject: () => void
}) {
  return (
    <div data-tour="home-greeting">
      <SectionHeader
        as="h1"
        eyebrow="DASHBOARD"
        title={`Welcome back, ${firstName}.`}
        sub={
          projectCount > 0
            ? `You have ${projectCount} ${projectCount === 1 ? 'project' : 'projects'} in flight${isLoadingProjects ? ' · loading…' : '.'}`
            : 'Run an LCA project end-to-end: model, assess, compare, defend.'
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              data-tour="home-new-project"
              className="btn btn-primary"
              onClick={onNewProject}
            >
              <Icon name="plus" size={14} /> New project
            </button>
          </div>
        }
        style={{ marginBottom: 40 }}
      />
    </div>
  )
}
