'use client'

// A project's cases with their latest answers (the case summaries route), the
// project's method and region, and its people. Read by the Cases list (E07),
// New case and Reports.

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import type { CaseSummary } from './cases-view'

export interface ProjectCasesData {
  project: { project_id: number; project_name: string; lcia_method: string | null; region_code: string | null; functional_unit: string | null; owner_id: number; my_role: string | null }
  cases: Array<CaseSummary & { runs: number; steps: number; flows: number; flows_missing_amount: number; has_interpretation: boolean; copied_from: number | null; updated_at: string | null }>
  members: Array<{ user_id: number; full_name: string | null; username: string; email: string; permission_name: string | null }>
}

export function useProjectCases(projectId: number) {
  const [data, setData] = useState<ProjectCasesData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, g, m] = await Promise.all([
        apiRequest(`/api/projects/${projectId}`),
        apiRequest(`/api/projects/${projectId}/case-summaries`),
        apiRequest(`/api/projects/${projectId}/members`),
      ])
      if (!p.ok) throw new Error(p.status === 404 ? 'This project is not here, or it is not shared with you.' : `the project answered ${p.status}`)
      if (!g.ok) throw new Error(`the cases answered ${g.status}`)
      const pj = (await p.json()).project
      const gj = await g.json()
      const mj = m.ok ? await m.json() : { members: [] }
      setData({
        project: {
          project_id: Number(pj.project_id),
          project_name: pj.project_name,
          lcia_method: pj.lcia_method ?? null,
          region_code: pj.region_code ?? null,
          functional_unit: pj.functional_unit ?? null,
          owner_id: Number(pj.owner_id),
          my_role: pj.my_role ?? null,
        },
        cases: (gj.cases ?? []).map((c: any) => ({
          ...c,
          case_id: Number(c.case_id),
          created_by: c.created_by == null ? null : Number(c.created_by),
          runs: Number(c.runs ?? 0),
          steps: Number(c.steps ?? 0),
          flows: Number(c.flows ?? 0),
          has_interpretation: !!c.has_interpretation,
        })),
        members: (mj.members ?? []).map((x: any) => ({ ...x, user_id: Number(x.user_id) })),
      })
    } catch (e: any) {
      setError(e?.message ?? 'the cases did not load')
    }
  }, [projectId])
  useEffect(() => {
    void load()
  }, [load])
  return { data, error, reload: load }
}
