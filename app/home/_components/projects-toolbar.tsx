'use client'

// Projects header: the title, filter chips, search box and grid/list toggle.

import { Icon } from '@/components/lcapix'
import type { FilterId, ViewMode } from '@/lib/home/projects'

export interface ProjectsToolbarProps {
  filter: FilterId
  setFilter: (filter: FilterId) => void
  search: string
  setSearch: (search: string) => void
  view: ViewMode
  setView: (view: ViewMode) => void
}

export function ProjectsToolbar({ filter, setFilter, search, setSearch, view, setView }: ProjectsToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        marginBottom: 20,
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="eyebrow"
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 11,
            letterSpacing: '0.16em',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          YOUR PROJECTS
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.015em',
            lineHeight: 1.15,
          }}
        >
          Active assessments
        </h2>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
        {(
          [
            { id: 'all', l: 'All' },
            { id: 'base', l: 'Single case' },
            { id: 'comp', l: 'Comparison' },
            { id: 'active', l: 'Active' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={
              'chip' + (filter === f.id ? ' chip-active' : '')
            }
            style={{
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {f.l}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '0 10px',
          height: 32,
          width: 220,
        }}
      >
        <Icon
          name="search"
          size={14}
          style={{ color: 'var(--text-tertiary)' }}
        />
        <input
          placeholder="Search projects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            flex: 1,
            fontFamily: 'var(--font-ui)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 2,
        }}
      >
        <button
          onClick={() => setView('grid')}
          aria-label="grid view"
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background:
              view === 'grid'
                ? 'var(--surface-overlay)'
                : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color:
              view === 'grid'
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="grid" size={14} />
        </button>
        <button
          onClick={() => setView('list')}
          aria-label="list view"
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background:
              view === 'list'
                ? 'var(--surface-overlay)'
                : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color:
              view === 'list'
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="list" size={14} />
        </button>
      </div>
    </div>
  )
}
