'use client'

// The project list's error, loading and empty states. Plain functions that
// return JSX, not components: ProjectsContent picks one of them (or a list
// view) for the same spot, and React keeps reconciling that spot's root
// element in place exactly as when they were inline.

import { Icon, NumberedRail, SectionHeader, TrustStrip } from '@/components/lcapix'
import { ISO_STEPS } from '@/lib/home/projects'

/** X-API-1: a failed /api/projects is an error with Retry, never "no projects". */
export function projectsErrorView({ projectsError, onRetry }: { projectsError: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="card"
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
        Couldn&apos;t load your projects
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {projectsError}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  )
}

/** Skeleton cards while the projects load. */
export function projectsSkeletonView() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="card"
          style={{ padding: 20, height: 196 }}
        >
          <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 10, width: '100%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: '92%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: '75%', marginBottom: 18 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ height: 14, width: 60 }} />
            <div className="skeleton" style={{ height: 14, width: 60 }} />
            <div className="skeleton" style={{ height: 14, width: 80 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** No projects yet: the ISO 14040 rail, create / worked example, trust strip. */
export function emptyProjectsView({
  onNewProject,
  onLoadExample,
  loadingExample,
}: {
  onNewProject: () => void
  onLoadExample: () => void
  loadingExample: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Empty hero — no card chrome, just a quiet headline */}
      <SectionHeader
        align="center"
        eyebrow="NOTHING HERE YET"
        title="Start your first assessment."
        sub="Below is the ISO 14040 path every project follows. You can move between phases as you learn."
        actions={undefined}
      />
      {/* ISO 14040 numbered rail */}
      <NumberedRail
        steps={ISO_STEPS}
        orientation="horizontal"
        eyebrow="ISO 14040 · 5 PHASES"
      />
      {/* CTA strip. An empty first screen teaches nothing, so the
          worked example sits beside "create your own". */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
          paddingTop: 8,
        }}
      >
        <button
          className="btn btn-primary btn-lg"
          onClick={onNewProject}
        >
          <Icon name="plus" size={14} /> Create your first project
        </button>
        <button
          className="btn btn-secondary btn-lg"
          onClick={onLoadExample}
          disabled={loadingExample}
          title="A three-step steel bracket you can take apart: illustrative quantities, real factors"
        >
          {loadingExample ? 'Building…' : 'Open the worked example'}
        </button>
      </div>
      {/* Trust strip — authority cues, calm and monochrome */}
      <TrustStrip
        caption="Methodology-grade calculations, traceable from inventory to result."
        style={{ marginTop: 8 }}
      />
    </div>
  )
}
