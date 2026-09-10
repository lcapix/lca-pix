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
  SectionHeader,
  MetricBlock,
  NumberedRail,
  TrustStrip,
} from '@/components/lcapix'
// (DEMO_ACTIVITY import removed — was never used and pulled phantom data
// into the bundle.)
import { useNotificationsStore, formatRelativeTime } from '@/lib/notifications-store'
import { GuidedTour } from '@/components/global/guided-tour'
import { LCAPIX_TOUR_STEPS } from '@/lib/lcapix-tour-steps'
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
  const [tourOpen, setTourOpen] = useState(false)

  // The global navbar "Tour" button signals us either via sessionStorage
  // (when it triggered a page navigation) or via a same-page custom event.
  // Honor both — clear the flag after consuming it so a refresh doesn't
  // re-trigger the tour.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lcapix:start-tour") === "1") {
        sessionStorage.removeItem("lcapix:start-tour")
        setTourOpen(true)
      }
    } catch {}
    const handler = () => setTourOpen(true)
    window.addEventListener("lcapix:start-tour", handler)
    return () => window.removeEventListener("lcapix:start-tour", handler)
  }, [])
  const [kpiData, setKpiData] = useState({ factors: 0, components: 0 })
  const [view, setView] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')

  // Defense-in-depth onboarding gate. The OAuth callback already routes
  // brand-new Google users to /auth/onboarding, and the email signup page
  // routes new email accounts the same way — but if someone bails halfway
  // through and later signs in via email, the API redirect path is bypassed.
  // We catch that here and nudge them back to the form.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiRequest('/api/auth/profile')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success && data.profile?.needsOnboarding) {
          router.replace('/auth/onboarding')
        }
      })
      .catch(() => {
        /* non-fatal: just stay on /home */
      })
    return () => {
      cancelled = true
    }
  }, [user, router])

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

  // KPI metrics — enfos discipline: no per-tile accent colors, no sparklines,
  // hairline borders only. Green is the only accent anywhere on the page;
  // hover surfaces a brand-color CTA on interactive tiles.
  const kpis = [
    {
      label: 'PROJECTS',
      numeric: coerced.length,
      sub: coerced.length > 0 ? `${coerced.length} total` : 'None yet',
      icon: 'box' as const,
    },
    {
      label: 'ASSESSMENTS',
      numeric: totalCases,
      sub: 'Across all cases',
      icon: 'activity' as const,
    },
    {
      label: 'FACTORS',
      numeric: kpiData.factors,
      sub: kpiData.factors > 0 ? 'In factor library' : 'Awaiting sync',
      icon: 'database' as const,
      href: '/library/factors',
      hrefHint: 'Browse factor library',
    },
    {
      label: 'COMPONENTS',
      numeric: totalComponents || kpiData.components,
      sub:
        totalComponents > 0
          ? 'Across your projects'
          : 'In substance catalog',
      icon: 'layers' as const,
      href: '/library/substances',
      hrefHint:
        totalComponents > 0 ? 'View components' : 'Browse substance catalog',
    },
  ]

  // ISO 14040 phases — the methodology rail shown to users without projects
  // (and in /project/new). Borrowed posture: enfos's 01–05 numbered strip.
  const isoSteps = [
    {
      title: 'Goal & scope',
      description:
        'Define what you\'re assessing and the boundaries of your study.',
    },
    {
      title: 'Inventory',
      description:
        'List the inputs and outputs at every stage — materials, energy, emissions.',
    },
    {
      title: 'Impact assessment',
      description:
        'Convert inventory flows into impact category scores using a chosen methodology.',
    },
    {
      title: 'Interpretation',
      description:
        'Examine results, run sensitivity checks, and identify what drives the totals.',
    },
    {
      title: 'Report',
      description:
        'Produce a defensible record of method, assumptions, and outcomes.',
    },
  ]

  return (
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="home" userInitials={userInitials} />
        <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto' }}>
          {/* Main column */}
          <div style={{ flex: 1, padding: '40px 28px 96px', minWidth: 0 }}>
            {/* Hero header */}
            <div data-tour="home-greeting">
              <SectionHeader
                as="h1"
                eyebrow="DASHBOARD"
                title={`Welcome back, ${firstName}.`}
                sub={
                  coerced.length > 0
                    ? `You have ${coerced.length} ${coerced.length === 1 ? 'project' : 'projects'} in flight${isLoadingProjects ? ' · loading…' : '.'}`
                    : 'Run an LCA project end-to-end — model, assess, compare, defend.'
                }
                actions={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setTourOpen(true)}
                      title="Take the guided tour"
                    >
                      <Icon name="sparkle" size={14} /> Walk me through
                    </button>
                    <button
                      data-tour="home-new-project"
                      className="btn btn-primary"
                      onClick={handleNewProject}
                    >
                      <Icon name="plus" size={14} /> New project
                    </button>
                  </div>
                }
                style={{ marginBottom: 40 }}
              />
            </div>

            {/* KPIs — calm, neutral, hairline-bordered */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 48,
              }}
            >
              {kpis.map((k, i) => (
                <div key={k.label} data-tour={i === 0 ? 'home-kpi-projects' : undefined}>
                <MetricBlock
                  label={k.label}
                  value={k.numeric}
                  sub={k.sub}
                  icon={k.icon}
                  delayMs={i * 80}
                  href={(k as any).href}
                  hrefHint={(k as any).hrefHint}
                />
                </div>
              ))}
            </div>

            {/* Projects header */}
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
                  steps={isoSteps}
                  orientation="horizontal"
                  eyebrow="ISO 14040 · 5 PHASES"
                />
                {/* CTA strip */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    paddingTop: 8,
                  }}
                >
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleNewProject}
                  >
                    <Icon name="plus" size={14} /> Create your first project
                  </button>
                </div>
                {/* Trust strip — authority cues, calm and monochrome */}
                <TrustStrip
                  caption="Methodology-grade calculations, traceable from inventory to result."
                  style={{ marginTop: 8 }}
                />
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
              flex: '0 0 300px',
              padding: '40px 28px 40px 0',
              borderLeft: '1px solid var(--border-subtle)',
              paddingLeft: 28,
            }}
          >
            <div
              className="eyebrow"
              style={{
                marginBottom: 18,
                color: 'var(--text-tertiary)',
                fontSize: 11,
                letterSpacing: '0.16em',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              RECENT ACTIVITY
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <RecentActivityFeed />
            </div>
          </aside>
        </div>
      </div>
      <GuidedTour
        steps={LCAPIX_TOUR_STEPS}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
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
