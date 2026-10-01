'use client'

// The projects as cards (grid) or rows (list). Plain functions that return
// JSX, for the same reason as project-states.tsx.

import { Icon, fmtInt } from '@/components/lcapix'
import type { CoercedProject } from '@/lib/home/projects'

/** One card per project. */
export function projectGridView({
  filtered,
  handleOpenProject,
}: {
  filtered: CoercedProject[]
  handleOpenProject: (projectId: string) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}
    >
      {filtered.map((p) => (
        <div
          key={p.id}
          className="card card-hover"
          onClick={() => handleOpenProject(p.id)}
          style={{ padding: 20, cursor: 'pointer' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {p.description || '—'}
              </div>
            </div>
            <div
              className={
                'chip ' +
                (p.status === 'active' ? 'chip-emerald' : '')
              }
              style={{ fontSize: 11, marginLeft: 8 }}
            >
              {p.status === 'active' && (
                <span
                  className="badge-dot"
                  style={{ background: 'var(--signal-success)' }}
                />
              )}
              {p.status}
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            <span>
              <span
                className="mono"
                style={{ color: 'var(--text-secondary)' }}
              >
                {fmtInt(p.cases)}
              </span>{' '}
              {p.cases === 1 ? 'case' : 'cases'}
            </span>
            <span style={{ color: 'var(--text-disabled)' }}>·</span>
            <span title="Process steps (products, lines, operations) across all cases">
              <span
                className="mono"
                style={{ color: 'var(--text-secondary)' }}
              >
                {fmtInt(p.components)}
              </span>{' '}
              {p.components === 1 ? 'step' : 'steps'}
            </span>
            <span style={{ color: 'var(--text-disabled)' }}>·</span>
            <span>{p.lastRun}</span>
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              className="chip chip-mono"
              style={{ fontSize: 10 }}
              title={
                p.type === 'comparative'
                  ? 'More than one case: alternatives compared against the same functional unit'
                  : 'One case so far: duplicate it to compare an alternative'
              }
            >
              {p.type === 'comparative' ? 'COMPARISON' : 'SINGLE CASE'}
            </div>
            <div
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              Updated {p.updated}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** One row per project, under a header row. */
export function projectListView({
  filtered,
  handleOpenProject,
}: {
  filtered: CoercedProject[]
  handleOpenProject: (projectId: string) => void
}) {
  return (
    <div
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            '2fr 100px 80px 100px 120px 100px 40px',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '12px 16px',
          background: 'var(--surface-overlay)',
        }}
      >
        <div>Name</div>
        <div>Type</div>
        <div>Cases</div>
        <div>Comps</div>
        <div>Last run</div>
        <div>Updated</div>
        <div></div>
      </div>
      {filtered.map((p) => (
        <div
          key={p.id}
          onClick={() => handleOpenProject(p.id)}
          style={{
            display: 'grid',
            gridTemplateColumns:
              '2fr 100px 80px 100px 120px 100px 40px',
            padding: '14px 16px',
            borderTop: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            fontSize: 13,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              color: 'var(--text-primary)',
              fontWeight: 500,
            }}
          >
            {p.name}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {p.type}
          </div>
          <div
            className="mono"
            style={{ color: 'var(--text-secondary)' }}
          >
            {fmtInt(p.cases)}
          </div>
          <div
            className="mono"
            style={{ color: 'var(--text-secondary)' }}
          >
            {fmtInt(p.components)}
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            {p.lastRun}
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            {p.updated}
          </div>
          <div>
            <Icon
              name="more"
              size={14}
              style={{ color: 'var(--text-tertiary)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
