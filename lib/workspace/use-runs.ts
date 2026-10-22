'use client'

// A case's runs for the Results tab (E05): every run with what it froze, the
// one being read (?run= opens an older one, read-only), and the total of the
// case this one is measured against (the case it was copied from, else the
// Base case; the Base case itself against its previous run).

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { toAssessmentResult, type AssessmentResult } from '@/lib/results/assessment'
import { isCompletedRun } from '@/lib/results/run-math'
import { runClimate, type RunStep } from './results-view'

export type WorkspaceRun = AssessmentResult & { run_steps?: RunStep[] }

const toRun = (a: any): WorkspaceRun => ({ ...toAssessmentResult(a), run_steps: Array.isArray(a.run_steps) ? a.run_steps : undefined })

export interface CompareTarget {
  caseId: number
  /** "Base case", or the source case's name. */
  label: string
}

export function useCaseRuns(caseId: number, target: CompareTarget | null) {
  const [runs, setRuns] = useState<WorkspaceRun[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [against, setAgainst] = useState<{ label: string; run_id: number; total: number } | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const mine = ++seq.current
    // No case picked yet (Reports before its list loads): nothing to read.
    if (!(caseId > 0)) {
      setRuns([])
      setStatus('loading')
      return
    }
    try {
      const res = await apiRequest(`/api/cases/${caseId}/assessments`)
      const d = await res.json().catch(() => ({}))
      if (mine !== seq.current) return
      if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
      setRuns(((d.assessments ?? []) as any[]).map(toRun))
      setStatus('ready')
      setError(null)
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.message ?? 'the runs did not load')
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
    }
  }, [caseId])

  useEffect(() => {
    load()
  }, [load])

  // The other case's newest completed run (one row, not its history).
  const targetId = target?.caseId ?? null
  const targetLabel = target?.label ?? ''
  useEffect(() => {
    setAgainst(null)
    if (targetId == null || targetId === caseId) return
    let live = true
    apiRequest(`/api/cases/${targetId}/assessments?latest=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const run = d?.assessments?.[0] ? toRun(d.assessments[0]) : null
        const total = run ? runClimate(run)?.value : undefined
        if (live && run && total !== undefined) setAgainst({ label: targetLabel, run_id: Number(run.run_id), total })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [targetId, targetLabel, caseId])

  const completed = runs.filter(isCompletedRun)
  return { runs, completed, status, error, reload: load, against }
}

/** The run to read: ?run= when it is a completed run of this case, else the newest. */
export function pickRun(completed: WorkspaceRun[], requested: string | null): { run: WorkspaceRun | null; older: boolean } {
  const latest = completed[0] ?? null
  const asked = requested ? completed.find((r) => String(r.run_id) === requested) : undefined
  const run = asked ?? latest
  return { run, older: !!run && !!latest && run.run_id !== latest.run_id }
}
