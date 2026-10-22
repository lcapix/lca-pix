'use client'

// Duplicate this case (CaseNameDialog): ask for the copy's name, copy the
// tree, flows and costs on the server, and open the copy.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Router = { push: (href: string) => void; replace: (href: string, opts?: { scroll?: boolean }) => void }

export function useDuplicateCase({
  projectId,
  caseId,
  router,
  currentCase,
  searchParams,
}: {
  projectId: string
  caseId: string
  router: Router
  /** The loaded case (null until it loads): the dialog waits for it. */
  currentCase: object | null
  searchParams: { get: (k: string) => string | null; toString: () => string }
}) {
  const [dupOpen, setDupOpen] = useState(false)
  const [dupBusy, setDupBusy] = useState(false)
  const [dupError, setDupError] = useState<string | null>(null)

  // ?duplicate=1 (the results page's "Duplicate and change one thing") opens
  // the Duplicate dialog once the case has loaded, then drops the param so a
  // reload or Back does not open it again (RES-6).
  const wantsDuplicate = searchParams.get('duplicate') === '1'
  const duplicateFromUrlHandled = useRef(false)
  useEffect(() => {
    if (!wantsDuplicate || !currentCase || duplicateFromUrlHandled.current) return
    duplicateFromUrlHandled.current = true
    setDupOpen(true)
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('duplicate')
    const qs = rest.toString()
    router.replace(`/project/${projectId}/case/${caseId}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [wantsDuplicate, currentCase, searchParams, router, projectId, caseId])

  const openDuplicate = () => setDupOpen(true)

  const cancelDuplicate = () => {
    setDupOpen(false)
    setDupError(null)
  }

  const submitDuplicate = async (name: string) => {
    setDupBusy(true)
    setDupError(null)
    try {
      const r = await fetch(`/api/cases/${caseId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token')
            ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
            : {}),
        },
        body: JSON.stringify({ case_name: name }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.case_id) {
        toast.success(`Created "${j.case_name}": ${j.components_copied} nodes and ${j.flows_copied} flows copied`)
        setDupOpen(false)
        router.push(`/project/${projectId}/case/${j.case_id}`)
      } else {
        setDupError(j?.error || 'Could not duplicate case')
      }
    } catch {
      setDupError('Could not duplicate case')
    } finally {
      setDupBusy(false)
    }
  }

  return { dupOpen, dupBusy, dupError, openDuplicate, cancelDuplicate, submitDuplicate }
}
