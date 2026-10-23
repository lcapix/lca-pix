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
  studyPartChanged,
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
      const reason = async (r: Response, fallback: string) => {
        const j = await r.json().catch(() => ({}))
        return j?.error || fallback
      }
      // The study part first, and only when it changed: a member who may not
      // change the study can still save this case's reference flow and data
      // basis. If the study part is refused, nothing is saved.
      const studySent = studyPartChanged(saved, plan.next)
      if (studySent) {
        const pr = await put(`/api/projects/${projectId}`, plan.project)
        if (pr.status === 403) throw new Error('Only the project owner can change the study goal & scope. Nothing was saved.')
        if (!pr.ok) throw new Error(`${await reason(pr, 'Could not save the study goal & scope.')} Nothing was saved.`)
      }
      const cr = await put(`/api/cases/${caseId}`, plan.case)
      if (!cr.ok) {
        const why = await reason(cr, 'the case refused the change')
        if (!studySent) throw new Error(`The reference flow and data basis were not saved: ${why}`)
        // The study part is saved: keep it as saved, and say exactly what was not.
        if (saved) {
          setSaved({ ...plan.next, referenceFlow: saved.referenceFlow, referenceFlowUnit: saved.referenceFlowUnit, modeledOutput: saved.modeledOutput })
        }
        onSaved?.()
        throw new Error(`The study goal & scope was saved; this case's reference flow and data basis were not: ${why}`)
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
