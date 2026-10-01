'use client'

// Data loading and actions for the dashboard (/home): the guided-tour signal,
// the onboarding gate, the project list (with Retry), the library counts, the
// list's view/filter/search, and the worked example.

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

  // Preserved: pull live integration KPIs
  useEffect(() => {
    if (!user) return
    Promise.all([
      apiRequest('/api/integrations/status')
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([status]) => {
      const counts = libraryCounts(status)
      if (counts) setKpiData(counts)
    })
  }, [user])

  const coerced: CoercedProject[] = useMemo(
    () => ((projects ?? []) as any[]).map((p) => coerceProject(p)),
    [projects],
  )

  const filtered = useMemo(() => filterProjects(coerced, filter, search), [coerced, filter, search])

  // The worked example, built in this account on demand.
  const [loadingExample, setLoadingExample] = useState(false)
  const handleLoadExample = async () => {
    setLoadingExample(true)
    try {
      const res = await apiRequest('/api/example-project', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.project_id) {
        toast.error('Could not build the example', {
          description: data?.error ?? 'Unknown error',
        })
        return
      }
      toast.success(data.existed ? 'You already have the example' : 'Example ready', {
        description: 'Quantities in it are illustrative; the factors and their sources are real.',
      })
      router.push(`/project/${data.project_id}`)
    } catch (e: any) {
      toast.error('Could not build the example', { description: e?.message ?? 'Unknown error' })
    } finally {
      setLoadingExample(false)
    }
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

  return {
    user,
    coerced,
    filtered,
    isLoadingProjects,
    projectsError,
    retryProjects: () => setProjectsReload((n) => n + 1),
    tourOpen,
    setTourOpen,
    kpiData,
    view,
    setView,
    filter,
    setFilter,
    search,
    setSearch,
    loadingExample,
    handleLoadExample,
    handleNewProject,
    handleOpenProject,
  }
}
