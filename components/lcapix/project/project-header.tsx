'use client'

// Project header card: name, comparison chip, description and the project
// actions (Analytics, Compare Cases, Class, Import Data, Add Case, Delete).

import { Trash2 } from 'lucide-react'
import { Icon } from '@/components/lcapix'

export interface ProjectHeaderProps {
  project: any
  projectId: string
  projectTypeLabel: 'comparative' | 'base'
  activeCase: any | null
  cases: any[]
  router: { push: (href: string) => void }
  onAddCase: () => void
  onDeleteProject: () => void
}

export function ProjectHeader({
  project,
  projectId,
  projectTypeLabel,
  activeCase,
  cases,
  router,
  onAddCase,
  onDeleteProject,
}: ProjectHeaderProps) {
  return (
    <div
      className="card"
      style={{
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h1
            data-tour="project-header"
            className="display"
            style={{
              fontSize: 26,
              fontWeight: 600,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            {project.name}
          </h1>
          {projectTypeLabel === 'comparative' && (
            <span
              className="chip chip-active"
              style={{ fontSize: 11 }}
              title="This project compares alternatives: every case is measured against the same functional unit"
            >
              comparison
            </span>
          )}
        </div>
        {project.description && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {project.description}
          </p>
        )}
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() =>
          router.push(
            activeCase
              ? `/project/${projectId}/analytics?caseId=${activeCase.id}`
              : `/project/${projectId}/analytics`,
          )
        }
      >
        <Icon name="chart-bar" size={14} /> Analytics
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => router.push(`/project/${projectId}/comparison`)}
        disabled={cases.length < 2}
        title={
          cases.length < 2
            ? 'Needs two cases. Duplicate a case, change one thing, run both, then compare.'
            : 'Compare the cases of this project side by side'
        }
      >
        <Icon name="layers" size={14} /> Compare Cases
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => router.push(`/project/${projectId}/class`)}
        title="Who can open this project, and how far each case got"
      >
        <Icon name="target" size={14} /> Class
      </button>
      {/* Two ways to start a case, offered as equals: read it from a
          document, or build it by hand. */}
      <button
        type="button"
        className={`btn ${cases.length === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
        onClick={() => router.push(`/project/${projectId}/import`)}
        title="Build or extend a case from a real document (upload, review, apply)"
      >
        <Icon name="file" size={14} /> Import Data
      </button>
      <button
        data-tour="project-add-case"
        type="button"
        className={`btn ${cases.length === 0 ? 'btn-secondary' : 'btn-primary'} btn-sm`}
        onClick={onAddCase}
        title="Create an empty case and build its steps by hand"
      >
        <Icon name="plus" size={14} /> Add Case
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onDeleteProject}
        title="Delete this project and all of its cases (cannot be undone)"
        style={{ color: '#c0392b' }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  )
}
