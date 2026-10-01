// Pure helpers behind the dashboard (/home): the project card shape coerced
// from the store, relative times, the filter/search, the KPI tiles, the
// greeting and the ISO 14040 rail.

/** How the project list is shown. */
export type ViewMode = 'grid' | 'list'
/** The project list filter chips. */
export type FilterId = 'all' | 'base' | 'comp' | 'active'

/** The visual fields a project card or row needs, coerced from the live store. */
export interface CoercedProject {
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

/** "just now", "5m ago", "3h ago", "2d ago", "1w ago", "4mo ago", "2y ago"; '—' for an invalid date. */
export function formatRelative(d: Date, now: number = Date.now()): string {
  const diff = now - d.getTime()
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

/**
 * A store project as a card. Counts fall back from the API's totals to the
 * loaded cases; more than one case reads as a comparison.
 */
export function coerceProject(p: any, now: number = Date.now()): CoercedProject {
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
  const updatedLabel = updatedAt ? formatRelative(updatedAt, now) : '—'
  const lastRunLabel = p?.lastRun ?? p?.lastAssessmentAt
    ? formatRelative(new Date(p.lastRun ?? p.lastAssessmentAt), now)
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

/** The projects shown under the active filter chip and search text (name or description). */
export function filterProjects(projects: CoercedProject[], filter: FilterId, search: string): CoercedProject[] {
  return projects.filter((p: CoercedProject) => {
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
}

/** Total cases and process steps across every project. */
export function projectTotals(projects: CoercedProject[]): { totalCases: number; totalComponents: number } {
  return {
    totalCases: projects.reduce((s: number, p: CoercedProject) => s + p.cases, 0),
    totalComponents: projects.reduce((s: number, p: CoercedProject) => s + p.components, 0),
  }
}

/** The greeting's first name ("there" when unknown). */
export function greetingName(name: string | undefined | null): string {
  return (name ?? '').split(' ')[0] || 'there'
}

/** Up to two initials for the top bar avatar ('KP' when unknown). */
export function initialsOf(name: string | undefined | null): string {
  return (
    name
      ?.split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'KP'
  )
}

/** The library counts the dashboard shows, from /api/integrations/status; null when it did not succeed. */
export function libraryCounts(status: any): { factors: number; components: number } | null {
  if (!status?.success) return null
  const totalFactors = (status.factorsByMethod ?? []).reduce(
    (s: number, m: any) => s + Number(m.factors ?? 0),
    0,
  )
  const totalSubstances = Number(status.substances?.total ?? 0)
  return { factors: totalFactors, components: totalSubstances }
}

/** One KPI tile on the dashboard. */
export interface HomeKpi {
  label: string
  numeric: number
  sub: string
  icon: 'box' | 'activity' | 'database' | 'layers'
  href?: string
  hrefHint?: string
}

/**
 * The KPI tiles. Enfos discipline: no per-tile accent colours, no sparklines;
 * the library tiles link to the factor and substance browsers.
 */
export function homeKpis(args: {
  projectCount: number
  totalCases: number
  totalComponents: number
  factors: number
  substances: number
  fmtInt: (n: number) => string
}): HomeKpi[] {
  const { projectCount, totalCases, totalComponents, factors, substances, fmtInt } = args
  return [
    {
      label: 'PROJECTS',
      numeric: projectCount,
      sub: projectCount > 0 ? `${projectCount} total` : 'None yet',
      icon: 'box' as const,
    },
    {
      // A case is one design alternative; runs are counted per case elsewhere.
      label: 'CASES',
      numeric: totalCases,
      sub: totalComponents > 0 ? `${fmtInt(totalComponents)} process steps` : 'Designs being assessed',
      icon: 'activity' as const,
    },
    {
      label: 'FACTORS',
      numeric: factors,
      sub: factors > 0 ? 'In factor library' : 'Awaiting sync',
      icon: 'database' as const,
      href: '/library/factors',
      hrefHint: 'Browse factor library',
    },
    {
      label: 'SUBSTANCES',
      numeric: substances,
      sub: 'In substance catalog',
      icon: 'layers' as const,
      href: '/library/substances',
      hrefHint: 'Browse substance catalog',
    },
  ]
}

/**
 * ISO 14040 phases — the methodology rail shown to users without projects
 * (and in /project/new). Borrowed posture: enfos's 01–05 numbered strip.
 */
export const ISO_STEPS: Array<{ title: string; description: string }> = [
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
