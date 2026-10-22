'use client'

// The Continue card (E12): the case opened last on this device, read fresh:
// its steps, its inventory (with lines held from a file), its newest run and
// whether it changed after, its write-up. A case that is gone or no longer
// shared is forgotten, and the card does not show.

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { forgetLastCase, readLastCase, type LastCase } from './last-case'
import type { ContinueInput } from './home-view'

export interface ContinueCase extends ContinueInput {
  last: LastCase
  caseName: string
  projectId: number
  caseId: number
  /** The file it was built from, when there is one. */
  sourceFile: string | null
}

export function useContinueCase(): { data: ContinueCase | null; loading: boolean } {
  const [data, setData] = useState<ContinueCase | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const last = readLastCase()
    if (!last) {
      setLoading(false)
      return
    }
    let live = true
    ;(async () => {
      try {
        const id = last.case_id
        const kase = await apiRequest(`/api/cases/${id}`)
        if (kase.status === 404 || kase.status === 403) {
          forgetLastCase()
          return
        }
        if (!kase.ok) return
        const [c, comps, inv, held, docs] = await Promise.all([
          kase.json(),
          apiRequest(`/api/cases/${id}/components`).then((r) => (r.ok ? r.json() : null)),
          apiRequest(`/api/cases/${id}/inventory`).then((r) => (r.ok ? r.json() : null)),
          apiRequest(`/api/cases/${id}/held-lines`).then((r) => (r.ok ? r.json() : null)),
          apiRequest(`/api/cases/${id}/documents`).then((r) => (r.ok ? r.json() : null)),
        ])
        if (!live) return
        const counts = inv?.counts ?? { all: 0, counted: 0, no_factor: 0, needs_amount: 0, left_out: 0 }
        setData({
          last,
          caseName: c.case?.case_name ?? last.case_name,
          projectId: Number(c.case?.project_id ?? last.project_id),
          caseId: id,
          sourceFile: docs?.documents?.[0]?.filename ?? null,
          steps: (comps?.components ?? []).length,
          flowsIn: counts.counted + counts.no_factor,
          flowsTotal: counts.all,
          held: Number(held?.held ?? 0),
          needsAmount: counts.needs_amount,
          leftOut: counts.left_out,
          latestRunId: inv?.latest_run?.run_id ?? null,
          changedAfterRun: (inv?.latest_run?.changed_flows ?? 0) > 0,
          hasWriteUp: !!String(c.case?.interpretation ?? '').trim(),
          isFinal: !!c.case?.is_final,
        })
      } catch {
        /* the card simply does not show */
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [])
  return { data, loading }
}
