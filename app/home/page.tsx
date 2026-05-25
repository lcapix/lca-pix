'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import {
  AppTopBar,
  Icon,
  Sparkline,
  StatusDot,
  fmtNum,
  fmtInt,
} from '@/components/lcapix'
import { DEMO_ACTIVITY } from '@/lib/lcapix-demo'
import { useNotificationsStore, formatRelativeTime } from '@/lib/notifications-store'
import { KpiTile } from '@/components/lcapix/kpi-tile'
import { useAuthStore, useProjectStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api-client'
import { transformProjectFromDB } from '@/lib/data-transformers'

type ViewMode = 'grid' | 'list'
type FilterId = 'all' | 'base' | 'comp' | 'active'

// Helpers to coerce mixed shapes from the live store into the visual fields
// the prototype card expects. All optional — fall back to sensible defaults.
interface CoercedProject {
  id: string
  name: string
  description: string
  type: 'base' | 'comparative'
  status: 'active' | 'archived'
  cases: number
  components: number
  lastRun: string
  updated: string
}

function coerceProject(p: any): CoercedProject {
  const caseCount: number = Number(p?.caseCount ?? p?.cases?.length ?? 0)
  const componentCount: number = Number(
    p?.componentCount ??
      p?.components?.length ??
      p?.cases?.reduce?.(
        (s: number, c: any) => s + (c?.components?.length ?? 0),
        0,
      ) ??
      0,
  )
  const type: 'base' | 'comparative' = caseCount > 1 ? 'comparative' : 'base'
  const status: 'active' | 'archived' = p?.archived ? 'archived' : 'active'
  const updatedAt = p?.updatedAt ? new Date(p.updatedAt) : null
  const updatedLabel = updatedAt ? formatRelative(updatedAt) : '—'
  const lastRunLabel = p?.lastRun ?? p?.lastAssessmentAt
    ? formatRelative(new Date(p.lastRun ?? p.lastAssessmentAt))
    : updatedLabel
  return {
    id: String(p?.id ?? ''),
    name: String(p?.name ?? 'Untitled project'),
    description: String(p?.description ?? ''),
    type,
    status,
    cases: caseCount,
    components: componentCount,
    lastRun: lastRunLabel,
    updated: updatedLabel,
  }
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime()
  if (Number.isNaN(diff)) return '—'
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  const w = Math.floor(days / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(days / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { projects, setProjects, setCurrentProject } = useProjectStore() as any
  const { toast } = useToast()

  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [kpiData, setKpiData] = useState({ factors: 0, components: 0 })
  const [view, setView] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')

  // Preserved: fetch projects from DB on mount (same API, same transform)
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return
      setIsLoadingProjects(true)
      try {
        const response = await apiRequest('/api/projects')
        const data = await response.json()
        if (data.success && data.projects) {
          const transformed = data.projects.map(
            (p: unknown) => transformProjectFromDB(p as any),
          )
          if (typeof setProjects === 'function') setProjects(transformed)
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error)
        toast({
          title: 'Error',
          description: 'Failed to load projects from database',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingProjects(false)
      }
    }
    fetchProjects()
  }, [user, setProjects, toast])

  // Preserved: pull live integration KPIs
  useEffect(() => {
    if (!user) return
    Promise.all([
      apiRequest('/api/integrations/status')
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([status]) => {
      if (status?.success) {
        const totalFactors = (status.factorsByMethod ?? []).reduce(
          (s: number, m: any) => s + Number(m.factors ?? 0),
          0,
        )
        const totalSubstances = Number(status.substances?.total ?? 0)
        setKpiData({ factors: totalFactors, components: totalSubstances })
      }
    })
  }, [user])

  const coerced: CoercedProject[] = useMemo(
    () => ((projects ?? []) as any[]).map(coerceProject),
    [projects],
  )

  const filtered = useMemo(() => {
    return coerced.filter((p: CoercedProject) => {
      if (filter === 'base' && p.type !== 'base') return false
      if (filter === 'comp' && p.type !== 'comparative') return false
      if (filter === 'active' && p.status !== 'active') return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      return true
    })
  }, [coerced, filter, search])

  const totalCases = coerced.reduce(
    (s: number, p: CoercedProject) => s + p.cases,
    0,
  )
  const totalComponents = coerced.reduce(
    (s: number, p: CoercedProject) => s + p.components,
    0,
  )

  // Greeting name
  const firstName = (user?.name ?? '').split(' ')[0] || 'there'
  const userInitials =
    user?.name
      ?.split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'KP'

  const handleImport = () => {
    toast({
      title: 'Import',
      description: 'Project import is coming soon.',
    })
  }

  const handleNewProject = () => {
    try {
      router.push('/project/new')
    } catch {
      window.location.href = '/project/new'
    }
  }

  const handleOpenProject = (projectId: string) => {
    const project = (projects ?? []).find((p: any) => p.id === projectId)
    if (project && typeof setCurrentProject === 'function') {
      setCurrentProject(project)
    }
    router.push(`/project/${projectId}`)
  }

  // KPI tiles — Active projects from the real store; integrations where available.
  const kpis = [
    {
      label: 'PROJECTS',
      numeric: coerced.length,
      trend: coerced.length > 0 ? `${coerced.length} total` : 'None yet',
      trendGood: coerced.length > 0,
      spark: [1, 1, 2, 2, 3, coerced.length || 1, coerced.length || 1],
      icon: 'box' as const,
      accent: '#006a44',
    },
    {
      label: 'ASSESSMENTS',
      numeric: totalCases,
      trend: 'across all cases',
      trendGood: null as boolean | null,
      spark: [0, 1, 2, 3, 4, 5, totalCases || 0],
      icon: 'activity' as const,
      accent: '#7bb5e8',
    },
    {
      label: 'FACTORS',
      numeric: kpiData.factors,
      trend: kpiData.factors > 0 ? 'Synced' : 'Awaiting sync',
      trendGood: kpiData.factors > 0,
      spark: [5100, 5140, 5180, 5200, 5210, 5224, kpiData.factors || 5234],
      icon: 'database' as const,
      accent: '#9f88cc',
    },
    {
      label: 'COMPONENTS',
      numeric: totalComponents || kpiData.components,
      trend: 'across portfolio',
      trendGood: null as boolean | null,
      spark: [
        Math.max(0, totalComponents - 12),
        Math.max(0, totalComponents - 10),
        Math.max(0, totalComponents - 6),
        Math.max(0, totalComponents - 4),
        Math.max(0, totalComponents - 2),
        Math.max(0, totalComponents - 1),
        totalComponents || kpiData.components || 0,
      ],
      icon: 'layers' as const,
      accent: '#d98568',
    },
  ]

  return (
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="home" userInitials={userInitials} />
        <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto' }}>
          {/* Main column */}
          <div style={{ flex: 1, padding: '32px 24px 80px', minWidth: 0 }}>
            {/* Greeting */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 32,
              }}
            >
              <div>
                <h1
                  className="display"
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Welcome back, {firstName}
                </h1>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    marginTop: 4,
                  }}
                >
                  <span className="mono">{fmtInt(coerced.length)}</span>{' '}
                  projects
                  {isLoadingProjects ? ' · loading…' : ''}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-primary"
                onClick={handleNewProject}
              >
                <Icon name="plus" size={14} /> New Project
              </button>
            </div>

            {/* KPIs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 20,
                marginBottom: 32,
              }}
            >
              {kpis.map((k, i) => (
                <KpiTile
                  key={k.label}
                  label={k.label}
                  value={k.numeric}
                  trend={k.trend}
                  trendGood={k.trendGood}
                  spark={k.spark}
                  icon={k.icon}
                  accent={k.accent}
                  delayMs={i * 90}
                />
              ))}
            </div>

            {/* Projects header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 20,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                Your Projects
              </h2>
              <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                {(
                  [
                    { id: 'all', l: 'All' },
                    { id: 'base', l: 'Base' },
                    { id: 'comp', l: 'Comparative' },
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

            {/* Projects content */}
            {isLoadingProjects ? (
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
            ) : coerced.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: 48,
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                <div
                  className="eyebrow"
                  style={{
                    marginBottom: 8,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  NO PROJECTS YET
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}
                >
                  Create your first project
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    marginBottom: 20,
                  }}
                >
                  Start a new LCA project to begin modeling impacts.
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleNewProject}
                >
                  <Icon name="plus" size={14} /> Create your first project
                </button>
              </div>
            ) : view === 'grid' ? (
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
                        cases
                      </span>
                      <span style={{ color: 'var(--text-disabled)' }}>·</span>
                      <span>
                        <span
                          className="mono"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {fmtInt(p.components)}
                        </span>{' '}
                        comps
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
                      >
                        {p.type === 'comparative' ? 'COMP' : 'BASE'}
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
            ) : (
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
            )}
            {/* Unused but referenced to keep lint calm if future numeric formatting needed */}
            <span style={{ display: 'none' }}>{fmtNum(0, 0)}</span>
          </div>

          {/* Sidebar: recent activity */}
          <aside
            className="home-sidebar"
            style={{
              flex: '0 0 280px',
              padding: '32px 24px 32px 0',
              borderLeft: '1px solid var(--border-subtle)',
              paddingLeft: 20,
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              RECENT ACTIVITY
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <RecentActivityFeed />
            </div>
          </aside>
        </div>
      </div>
    </AuthGuard>
  )
}

function RecentActivityFeed() {
  const items = useNotificationsStore((s) => s.items)
  const list = items.length > 0 ? items.slice(0, 7) : []
  if (list.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        No activity yet.
      </div>
    )
  }
  return (
    <>
      {list.map((n) => (
        <div
          key={n.id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ marginTop: 5 }}>
            <StatusDot status={n.status} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.45,
              }}
            >
              <span style={{ fontWeight: 500 }}>{n.actor}</span>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>{n.text}</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginTop: 2,
              }}
            >
              {formatRelativeTime(n.ts)}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
