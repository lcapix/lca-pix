/**
 * The sidebar and project switcher (design/education/specs/sidebar.md), as
 * pure rules over the projects list (GET /api/projects). The open project is
 * nested; every other project is one line; the full list is in the switcher.
 */

export interface NavProject {
  project_id: number
  project_name: string
  owner_id: number
  owner_name?: string | null
  /** The caller's member role; null when they only own it. */
  permission_name?: string | null
  case_count?: number | string | null
  member_count?: number | string | null
  /** The owner plus every member (the projects list's `people`). */
  people?: number | string | null
  pinned?: boolean
  pinned_at?: string | null
  last_case_update?: string | null
  last_run_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}

/** sidebar.md "Project tints": in order, then repeat. */
export const PROJECT_TINTS = ['#A7D3B8', '#F0A68A', '#F5C971', '#7BB5E8', '#C8B5E8'] as const

/** A stable tint: the project's position among the caller's projects by id. */
export function projectTint(p: NavProject, all: NavProject[]): string {
  const ids = all.map((x) => x.project_id).sort((a, b) => a - b)
  const i = ids.indexOf(p.project_id)
  return PROJECT_TINTS[(i < 0 ? 0 : i) % PROJECT_TINTS.length]
}

/** "Steel bracket · LCA 301" → "SB"; one word → its first two letters. */
export function projectInitials(name: string): string {
  const words = String(name ?? '')
    .replace(/[·|/,:;()\-–]+/g, ' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export const caseCount = (n: unknown): string => {
  const k = Number(n ?? 0) || 0
  return `${k} ${k === 1 ? 'case' : 'cases'}`
}

export type Relation = 'owner' | 'admin' | 'member'

/** How the caller relates to a project. */
export function relationOf(p: NavProject, userId: number | null | undefined): Relation {
  if (userId != null && Number(p.owner_id) === Number(userId)) return 'owner'
  if (p.permission_name === 'owner') return 'owner'
  if (p.permission_name === 'admin') return 'admin'
  return 'member'
}

/** The switcher card's meta line: "34 cases · you own it", "From Dr. Elena Rivera", "3 cases". */
export function projectMeta(p: NavProject, userId: number | null | undefined): string {
  const rel = relationOf(p, userId)
  if (rel === 'owner') return `${caseCount(p.case_count)} · you own it`
  if (p.owner_name) return `From ${p.owner_name}`
  return caseCount(p.case_count)
}

export interface SwitcherGroups {
  pinned: NavProject[]
  yours: NavProject[]
  shared: NavProject[]
}

const activity = (p: NavProject) =>
  Math.max(
    ...[p.last_run_at, p.last_case_update, p.updated_at, p.created_at].map((d) => (d ? Date.parse(d) || 0 : 0)),
  )

/**
 * The switcher's groups (PINNED, YOUR PROJECTS, SHARED WITH YOU),
 * filtered by what was typed (name, or the owner's name for a shared project).
 * A pinned project shows under PINNED only. Each group: pinned by pin time,
 * the others by latest activity.
 */
export function switcherGroups(projects: NavProject[], userId: number | null | undefined, query = ''): SwitcherGroups {
  const q = query.trim().toLowerCase()
  const match = (p: NavProject) =>
    !q || p.project_name.toLowerCase().includes(q) || (p.owner_name ?? '').toLowerCase().includes(q)
  const seen = projects.filter(match)
  const byActivity = (a: NavProject, b: NavProject) => activity(b) - activity(a) || a.project_name.localeCompare(b.project_name)
  const pinned = seen
    .filter((p) => p.pinned)
    .sort((a, b) => (Date.parse(b.pinned_at ?? '') || 0) - (Date.parse(a.pinned_at ?? '') || 0))
  const rest = seen.filter((p) => !p.pinned)
  return {
    pinned,
    yours: rest.filter((p) => ['owner', 'admin'].includes(relationOf(p, userId))).sort(byActivity),
    shared: rest.filter((p) => relationOf(p, userId) === 'member').sort(byActivity),
  }
}

/** The switcher's rows in display order, for the arrow keys. */
export function switcherOrder(groups: SwitcherGroups): NavProject[] {
  return [...groups.pinned, ...groups.yours, ...groups.shared]
}

/**
 * RECENT: at most `max` other projects, most recently opened on this device
 * first, then by latest activity; never the open one.
 */
export function recentProjects(
  projects: NavProject[],
  recentIds: number[],
  openId: number | null | undefined,
  max = 3,
): NavProject[] {
  const byId = new Map(projects.map((p) => [p.project_id, p]))
  const out: NavProject[] = []
  for (const id of recentIds) {
    const p = byId.get(id)
    if (p && p.project_id !== openId && !out.includes(p)) out.push(p)
    if (out.length >= max) return out
  }
  const rest = projects
    .filter((p) => p.project_id !== openId && !out.includes(p))
    .sort((a, b) => activity(b) - activity(a))
  return [...out, ...rest].slice(0, max)
}

/** Put a just-opened project first in this device's recent list (max 10, unique). */
export function pushRecent(ids: number[], id: number): number[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, 10)
}

export type Place = 'home' | 'findings' | 'reports'

/** Places (sidebar.md 2): Home, Findings, Reports, the same for everyone. */
export function placesFor(): Place[] {
  return ['home', 'findings', 'reports']
}

export type ProjectPage = 'overview' | 'cases' | 'compare' | 'people'

/** The open project's nested pages: People for the owner and admins only. */
export function projectPagesFor(open: NavProject, userId: number | null | undefined): ProjectPage[] {
  const rel = relationOf(open, userId)
  return rel === 'owner' || rel === 'admin' ? ['overview', 'cases', 'compare', 'people'] : ['overview', 'cases', 'compare']
}

/** People on a project, the owner counted once: what its People page heads with. */
export function peopleOn(p: { people?: number | string | null; member_count?: number | string | null }): number {
  return p.people != null ? Number(p.people) : Number(p.member_count ?? 0) + 1
}
