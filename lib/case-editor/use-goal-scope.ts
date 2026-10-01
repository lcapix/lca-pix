'use client'

// The Goal & scope card's data: load the study fields (project) and this
// case's reference flow and data basis, report them up (the run gate), open
// on request (openSignal), and save both. Saving the data basis also
// rewrites the product's quantity on the server (onSaved).

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import {
  goalScopeFromApi,
  goalScopeSave,
  toGoalScopeSummary,
  type GoalScopeForm,
  type GoalScopeSummary,
} from './goal-scope'

export function useGoalScope({
  projectId,
  caseId,
  openSignal = 0,
  onChange,
  onSaved,
}: {
  projectId: string
  caseId: string
  openSignal?: number
  onChange?: (summary: GoalScopeSummary | null) => void
  onSaved?: () => void
}) {
  const [saved, setSaved] = useState<GoalScopeForm | null>(null)
  const [form, setForm] = useState<GoalScopeForm | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Latest callback without re-running the load effect on every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [pr, cr] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/cases/${caseId}`),
        ])
        const p = (await pr.json())?.project ?? {}
        const c = (await cr.json())?.case ?? {}
        if (cancelled) return
        // No migrate-014 on this database: hide the card and block nothing.
        const s = goalScopeFromApi(p, c)
        if (!s) {
          onChangeRef.current?.(null)
          return
        }
        setSaved(s)
        setForm(s)
        onChangeRef.current?.(toGoalScopeSummary(s))
      } catch {
        // advisory: without it the page still works and nothing is blocked
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, caseId])

  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true)
      setTimeout(
        () => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        50,
      )
    }
  }, [openSignal])

  /** Change typed fields. */
  const set = (patch: Partial<GoalScopeForm>) => form && setForm({ ...form, ...patch })

  /** Edit / Close: closing drops unsaved edits. */
  const toggle = () => {
    if (open) setForm(saved)
    setOpen(!open)
  }

  const cancel = () => {
    setForm(saved)
    setOpen(false)
  }

  async function save() {
    if (!form) return
    const plan = goalScopeSave(form)
    if (!plan.ok) {
      toast.error(plan.error)
      return
    }
    setSaving(true)
    try {
      const put = (url: string, body: object) =>
        apiRequest(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      const [pr, cr] = await Promise.all([
        put(`/api/projects/${projectId}`, plan.project),
        put(`/api/cases/${caseId}`, plan.case),
      ])
      if (pr.status === 403) {
        throw new Error('Only the project owner can change the study goal & scope.')
      }
      for (const r of [pr, cr]) {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j?.error || 'Could not save goal & scope.')
        }
      }
      setSaved(plan.next)
      setForm(plan.next)
      setOpen(false)
      onChangeRef.current?.(toGoalScopeSummary(plan.next))
      onSaved?.()
      toast.success('Goal & scope saved')
    } catch (e: any) {
      toast.error(e?.message || 'Could not save goal & scope.')
    } finally {
      setSaving(false)
    }
  }

  return { saved, form, open, saving, rootRef, set, toggle, cancel, save }
}
