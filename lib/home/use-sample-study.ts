'use client'

// The sample study for its Overview (E02): the project's question, the Base
// case's tree, inventory and newest run, and the what-if's inventory and
// newest run. Every number the Overview shows comes from these answers. Also
// the person's own copies (C3), newest first, so Home opens the copy they have
// instead of offering to make another.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { toAssessmentResult } from '@/lib/results/assessment'
import { perFunctionalUnit } from '@/lib/workspace/per-fu'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'
import { orderSteps, toStep, type WorkspaceInventory, type WorkspaceStep } from '@/lib/workspace/use-workspace'

export interface SampleProject {
  project_id: number
  project_name: string
  goal_statement: string | null
  functional_unit: string | null
  system_boundary: string | null
  boundary_notes: string | null
  lcia_method: string | null
  region_code: string | null
  is_sample: boolean
}

export interface SampleCase {
  case_id: number
  case_name: string
  reference_flow: number | null
  reference_flow_unit: string | null
}

/** A copy the person made of the sample (editable, theirs). */
export interface SampleCopy {
  case_id: number
  case_name: string
  run_count: number
}

/** Their own copies: cases in the sample they made, not its read-only two. Newest first. */
export function ownCopies(cases: any[], userId: number | null): SampleCopy[] {
  if (userId == null) return []
  return cases
    .filter((x) => Number(x.created_by) === userId && !Number(x.read_only))
    .map((x) => ({ case_id: Number(x.case_id), case_name: String(x.case_name), run_count: Number(x.run_count ?? 0) }))
    .sort((a, b) => b.case_id - a.case_id)
}

const json = async (path: string) => {
  const r = await apiRequest(path)
  if (!r.ok) throw new Error(`${path.split('?')[0]} answered ${r.status}`)
  return r.json()
}
const toRun = (a: any): WorkspaceRun | null =>
  a ? perFunctionalUnit({ ...toAssessmentResult(a), run_steps: Array.isArray(a.run_steps) ? a.run_steps : undefined }) : null

export function useSampleStudy(projectId: number | null, userId: number | null = null) {
  const [project, setProject] = useState<SampleProject | null>(null)
  const [base, setBase] = useState<SampleCase | null>(null)
  const [whatIf, setWhatIf] = useState<SampleCase | null>(null)
  const [steps, setSteps] = useState<WorkspaceStep[]>([])
  const [inventory, setInventory] = useState<WorkspaceInventory | null>(null)
  const [run, setRun] = useState<WorkspaceRun | null>(null)
  const [whatIfInventory, setWhatIfInventory] = useState<WorkspaceInventory | null>(null)
  const [whatIfRun, setWhatIfRun] = useState<WorkspaceRun | null>(null)
  // The raw case list; the copies are read from it once the person is known, so a late
  // profile never starts a second load (C3).
  const [cases, setCases] = useState<any[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (projectId == null) return
    const mine = ++seq.current
    setStatus((s) => (s === 'ready' ? s : 'loading'))
    try {
      const [p, c] = await Promise.all([json(`/api/projects/${projectId}`), json(`/api/projects/${projectId}/cases`)])
      // The sample's own two cases are its first base and first comparative
      // (copies a person makes come later), as the sample route describes them.
      const cases: any[] = [...(c.cases ?? [])].sort((x, y) => Number(x.case_id) - Number(y.case_id))
      const toCase = (x: any): SampleCase | null =>
        x
          ? {
              case_id: Number(x.case_id),
              case_name: x.case_name,
              reference_flow: x.reference_flow == null ? null : Number(x.reference_flow),
              reference_flow_unit: x.reference_flow_unit ?? null,
            }
          : null
      // The sample's own two are read-only; a copy someone made never is.
      const own = cases.filter((x) => Number(x.read_only) === 1)
      const b = toCase(own.find((x) => x.case_type === 'base') ?? cases.find((x) => x.case_type === 'base'))
      const w = toCase(own.find((x) => x.case_type === 'comparative') ?? cases.find((x) => x.case_type === 'comparative'))
      const [comps, inv, runs, wInv, wRuns] = await Promise.all([
        b ? json(`/api/cases/${b.case_id}/components`) : null,
        b ? json(`/api/cases/${b.case_id}/inventory`) : null,
        b ? json(`/api/cases/${b.case_id}/assessments?latest=1`) : null,
        w ? json(`/api/cases/${w.case_id}/inventory`) : null,
        w ? json(`/api/cases/${w.case_id}/assessments?latest=1`) : null,
      ])
      if (mine !== seq.current) return
      const pr = p.project
      setProject({
        project_id: Number(pr.project_id),
        project_name: pr.project_name,
        goal_statement: pr.goal_statement ?? null,
        functional_unit: pr.functional_unit ?? null,
        system_boundary: pr.system_boundary ?? null,
        boundary_notes: pr.boundary_notes ?? null,
        lcia_method: pr.lcia_method ?? null,
        region_code: pr.region_code ?? null,
        is_sample: Number(pr.is_sample ?? 0) === 1 || pr.is_sample === true,
      })
      setBase(b)
      setWhatIf(w)
      setSteps(orderSteps(((comps?.components ?? []) as any[]).map(toStep)))
      setInventory(inv as WorkspaceInventory | null)
      setRun(toRun(runs?.assessments?.[0]))
      setWhatIfInventory(wInv as WorkspaceInventory | null)
      setWhatIfRun(toRun(wRuns?.assessments?.[0]))
      setCases(cases)
      setStatus('ready')
      setError(null)
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.message ?? 'the study did not load')
      setStatus('error')
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const copies = useMemo(() => ownCopies(cases, userId), [cases, userId])

  return { project, base, whatIf, steps, inventory, run, whatIfInventory, whatIfRun, copies, status, error, reload: load }
}
