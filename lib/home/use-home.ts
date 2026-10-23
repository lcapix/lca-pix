'use client'

// Data loading and actions for the dashboard (/home): the onboarding gate, the
// project list (with Retry), the library counts, and the list's
// view/filter/search.

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore, useProjectStore } from '@/lib/store'
import { ApiError, apiGet, apiRequest } from '@/lib/api-client'
import { transformProjectFromDB } from '@/lib/data-transformers'
import {
  coerceProject,
  filterProjects,
  libraryCounts,
  type CoercedProject,
  type FilterId,
  type ViewMode,
} from './projects'

type Router = { push: (href: string) => void; replace: (href: string) => void }

export function useHome(router: Router) {
  const { user } = useAuthStore()
  const { projects, setProjects, setCurrentProject } = useProjectStore() as any

  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  // X-API-1: a failed /api/projects is an error state, never "no projects".
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [projectsReload, setProjectsReload] = useState(0)

  // The library counts; null until read. A failed read is libraryError, never
  // a library of 0 factors.
  const [kpiData, setKpiData] = useState<{ factors: number; components: number } | null>(null)
  const [libraryError, setLibraryError] = useState<string | null>(null)
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

  // Fetch projects from the DB on mount and on Retry (same API, same
  // transform). apiGet throws ApiError on a non-2xx answer.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchProjects = async () => {
      setIsLoadingProjects(true)
      setProjectsError(null)
      try {
        const data = await apiGet<{ projects?: unknown[] }>('/api/projects')
        if (!Array.isArray(data?.projects)) {
          throw new Error('The server did not send a project list.')
        }
        const transformed = data.projects.map((p) => transformProjectFromDB(p as any))
        if (!cancelled && typeof setProjects === 'function') setProjects(transformed)
      } catch (error) {
        if (cancelled) return
        // A 401 is already on its way to the login page.
        if (error instanceof ApiError && error.status === 401) return
        const message = error instanceof Error ? error.message : 'Unknown error'
        setProjectsError(message)
        toast.error("Couldn't load your projects", { description: message })
      } finally {
        if (!cancelled) setIsLoadingProjects(false)
      }
    }
    fetchProjects()
    return () => {
      cancelled = true
    }
  }, [user, setProjects, projectsReload])

  // The factor and substance library counts for the KPI tiles.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiRequest('/api/integrations/status')
      .then(async (r) => {
        const status = await r.json().catch(() => null)
        const counts = r.ok ? libraryCounts(status) : null
        if (!counts) throw new Error(status?.error || `the server answered ${r.status}`)
        if (!cancelled) {
          setKpiData(counts)
          setLibraryError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) setLibraryError(error instanceof Error ? error.message : 'the request failed')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const coerced: CoercedProject[] = useMemo(
    () => ((projects ?? []) as any[]).map((p) => coerceProject(p)),
    [projects],
  )

  const filtered = useMemo(() => filterProjects(coerced, filter, search), [coerced, filter, search])

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

  return {
    user,
    coerced,
    filtered,
    isLoadingProjects,
    projectsError,
    retryProjects: () => setProjectsReload((n) => n + 1),
    kpiData,
    libraryError,
    view,
    setView,
    filter,
    setFilter,
    search,
    setSearch,
    handleNewProject,
    handleOpenProject,
  }
}
