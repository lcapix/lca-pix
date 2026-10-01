'use client'

// What the project workspace can do: add, rename and delete cases, delete the
// project, clone an empty comparative from the base case, and run an
// assessment on the active case.

import { useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { useProjectStore } from '@/lib/store'
import { addCasePath, readRunPrefs, runAssessmentBody } from './workspace'

type Router = { push: (href: string) => void }

export function useProjectActions(args: {
  projectId: string
  router: Router
  project: any
  setProject: (update: (p: any) => any) => void
  activeCaseId: string | null
  setActiveCaseId: (update: string | null | ((id: string | null) => string | null)) => void
}) {
  const { projectId, router, project, setProject, activeCaseId, setActiveCaseId } = args
  const { deleteCase, updateCase } = useProjectStore()
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameBusy, setRenameBusy] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [isRunningAssessment, setIsRunningAssessment] = useState(false)

  const handleAddCase = () => {
    const baseCases = (project?.cases || []).filter((c: any) => c.type === 'base')
    router.push(addCasePath(projectId, baseCases.length))
  }

  const handleDeleteCase = async (caseId: string) => {
    if (
      !confirm('Are you sure you want to delete this case? This action cannot be undone.')
    ) {
      return
    }
    // This used to drop the case from the local store only and still report
    // success, so the case came back on the next load. It now deletes for real.
    try {
      const res = await apiRequest(`/api/cases/${caseId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Delete failed (${res.status})`)
      }
      deleteCase(caseId)
      setProject((p: any) =>
        p
          ? { ...p, cases: (p.cases || []).filter((c: any) => String(c.id) !== String(caseId)) }
          : p,
      )
      if (activeCaseId === caseId) setActiveCaseId(null)
      toast.success('Case deleted', { description: 'The case has been removed from your project.' })
    } catch (err: any) {
      toast.error('Could not delete case', { description: err?.message || 'Something went wrong. Please try again.' })
    }
  }

  const handleRenameCase = async (caseId: string, name: string) => {
    setRenameBusy(true)
    setRenameError(null)
    try {
      const res = await apiRequest(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_name: name }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Rename failed (${res.status})`)
      }
      updateCase(caseId, { name })
      setProject((p: any) =>
        p
          ? {
              ...p,
              cases: (p.cases || []).map((c: any) =>
                String(c.id) === String(caseId) ? { ...c, name } : c,
              ),
            }
          : p,
      )
      setRenameOpen(false)
      toast.success('Case renamed', { description: `Now called "${name}".` })
    } catch (err: any) {
      setRenameError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setRenameBusy(false)
    }
  }

  const cancelRename = () => {
    setRenameOpen(false)
    setRenameError(null)
  }

  const handleDeleteProject = async () => {
    // Owner-only, irreversible: removes the project and every case, component,
    // flow, cost and assessment under it (DB foreign-key cascade). This hits
    // the real DELETE endpoint so it actually persists.
    const name = project?.name ?? 'this project'
    if (
      !confirm(
        `Delete "${name}" and ALL of its cases, flows and assessments?\n\nThis cannot be undone.`,
      )
    ) {
      return
    }
    try {
      const res = await apiRequest(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Delete failed (${res.status})`)
      }
      toast.success('Project deleted', { description: `"${name}" and all its cases have been removed.` })
      router.push('/home')
    } catch (err: any) {
      toast.error('Could not delete project', { description: err?.message || 'Something went wrong. Please try again.' })
    }
  }

  // Copies the base case's steps and flows into an empty comparative case.
  const handleCloneFromBase = async (activeCase: any) => {
    const baseCase = project?.cases?.find(
      (c: any) => c.type === 'base',
    )
    if (!baseCase) return
    try {
      const r = await apiRequest(
        `/api/cases/${activeCase.id}/clone-from`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceCaseId: baseCase.id }),
        },
      )
      if (r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.success('Cloned from base', {
          description: `Copied ${j?.cloned ?? 'the'} steps and ${j?.flows_copied ?? 'their'} flows from ${baseCase.name}.`,
        })
        // re-trigger tree fetch by toggling activeCaseId
        setActiveCaseId((id) => {
          const next = id
          setTimeout(() => setActiveCaseId(next), 0)
          return null
        })
      } else {
        const j = await r.json().catch(() => ({}))
        toast.error('Clone failed', { description: j?.error || 'Could not copy the base case. Nothing was changed.' })
      }
    } catch {
      toast.error('Clone failed', { description: 'Network error while cloning.' })
    }
  }

  // Runs the active case, then opens its results — only after a run that
  // worked (PROJ-5): a failed run used to land on an empty or stale results page.
  const handleRunAssessment = async (activeCase: any) => {
    if (!activeCase) return
    setIsRunningAssessment(true)
    try {
      // Same per-case method/region memory as the case page and the run
      // modal, so a run from here matches that history.
      const remembered = readRunPrefs((key) => localStorage.getItem(key), activeCase.id)
      const r = await apiRequest(
        `/api/cases/${activeCase.id}/assessments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(runAssessmentBody(activeCase.name, remembered)),
        },
      )
      if (r.ok) {
        toast.success('Assessment complete', {
          description: `Calculated impacts for ${activeCase.name}.`,
        })
        router.push(
          `/project/${projectId}/case/${activeCase.id}/results`,
        )
      } else {
        const j = await r.json().catch(() => ({}))
        toast.error('Assessment failed', {
          description: j?.error || 'Could not run the assessment.',
        })
      }
    } catch {
      toast.error('Assessment failed', {
        description: 'Network error.',
      })
    } finally {
      setIsRunningAssessment(false)
    }
  }

  return {
    handleAddCase,
    handleDeleteCase,
    handleRenameCase,
    handleDeleteProject,
    handleCloneFromBase,
    handleRunAssessment,
    isRunningAssessment,
    renameOpen,
    setRenameOpen,
    renameBusy,
    renameError,
    cancelRename,
  }
}
