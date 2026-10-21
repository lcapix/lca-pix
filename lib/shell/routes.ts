// Where each place and project page lives, in one place (stage 7 repoints
// pages here, not in the sidebar).

import type { Place, ProjectPage } from './project-nav'

export function placeHref(place: Place, openId: number | null): string {
  switch (place) {
    case 'home':
      return '/home'
    case 'findings':
      return '/findings'
    case 'reports':
      return openId ? `/reports?project=${openId}` : '/reports'
    case 'analytics':
      return openId ? `/project/${openId}/analytics` : '/home'
  }
}

export function projectHref(projectId: number, page: ProjectPage = 'overview'): string {
  switch (page) {
    case 'overview':
      return `/project/${projectId}`
    case 'cases':
      return `/project/${projectId}/cases`
    case 'compare':
      return `/project/${projectId}/comparison`
    case 'people':
      return `/project/${projectId}/people`
  }
}

/** Which of the open project's pages a path is (a case page counts as Cases). */
export function projectPageOf(pathname: string, projectId: number): ProjectPage | null {
  const base = `/project/${projectId}`
  if (pathname === base || pathname === `${base}/`) return 'overview'
  const rest = pathname.slice(base.length)
  if (!pathname.startsWith(base + '/')) return null
  if (/^\/(cases|case\/|import|start)/.test(rest)) return 'cases'
  if (/^\/(comparison|comparisons)/.test(rest)) return 'compare'
  if (/^\/(people|class)/.test(rest)) return 'people'
  return null
}

export function placeOf(pathname: string): Place | null {
  if (pathname === '/home' || pathname.startsWith('/home/')) return 'home'
  if (pathname.startsWith('/findings')) return 'findings'
  if (pathname.startsWith('/reports')) return 'reports'
  if (/^\/project\/\d+\/analytics/.test(pathname)) return 'analytics'
  return null
}

export const PLACE_LABEL: Record<Place, string> = {
  home: 'Home',
  findings: 'Findings',
  reports: 'Reports',
  analytics: 'Analytics',
}
export const PLACE_ICON: Record<Place, string> = { home: 'home', findings: 'pin', reports: 'report', analytics: 'analytics' }
export const PAGE_LABEL: Record<ProjectPage, string> = { overview: 'Overview', cases: 'Cases', compare: 'Compare', people: 'People' }
