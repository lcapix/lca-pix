'use client'

// Compare's data (E09): the project's cases, which ones are compared (the
// URL's ?cases= first, else the base case and your latest copy), the one
// read of GET /api/projects/[projectId]/compare, and running a case again
// under the base case's method and region so a failed check can pass.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { COMPARE_MAX_CASES } from './comparability'
import type { CompareResponse } from '@/components/lcapix/compare/types'

export interface CaseOption {
  id: string
  name: string
  type: 'base' | 'comparative'
  createdBy: number | null
  runs: number
}

/** The base case and the copy this person most likely means: their latest copy with a run, else any latest copy. */
export function defaultPick(cases: CaseOption[], me: number): string[] {
  const base = cases.find((c) => c.type === 'base')
  const copies = cases.filter((c) => c.type === 'comparative').sort((a, b) => Number(b.id) - Number(a.id))
  const mine = copies.filter((c) => c.createdBy === me)
  const pick = mine.find((c) => c.runs > 0) ?? mine[0] ?? copies.find((c) => c.runs > 0) ?? copies[0]
  return [base?.id, pick?.id].filter((x): x is string => !!x)
}

export function useCompare(projectId: number, me: number) {
  const [cases, setCases] = useState<CaseOption[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [data, setData] = useState<CompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}/cases`)
        if (!r.ok) throw new Error(r.status === 404 ? 'This project is not here, or it is not shared with you.' : `the cases answered ${r.status}`)
        const d = await r.json()
        if (cancelled) return
        const list: CaseOption[] = (d.cases ?? []).map((c: any) => ({
          id: String(c.case_id),
          name: c.case_name,
          type: c.case_type === 'base' ? 'base' : 'comparative',
          createdBy: c.created_by == null ? null : Number(c.created_by),
          runs: Number(c.run_count ?? 0),
        }))
        list.sort((a, b) => (a.type === b.type ? Number(a.id) - Number(b.id) : a.type === 'base' ? -1 : 1))
        setCases(list)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'the cases did not load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // The first selection, once: the address's ?cases= when it names cases
  // here, else the default, which waits for the profile (whose copy is "yours").
  const inited = useRef(false)
  useEffect(() => {
    if (inited.current || !cases) return
    const fromUrl = (new URLSearchParams(window.location.search).get('cases') ?? '').split(',').filter((id) => cases.some((c) => c.id === id))
    if (!fromUrl.length && me < 0) return
    inited.current = true
    setSelected(fromUrl.length ? fromUrl.slice(0, COMPARE_MAX_CASES) : defaultPick(cases, me))
  }, [cases, me])

  // Coming back from a run in another tab reads the comparison again.
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const key = selected.join(',')
  useEffect(() => {
    if (!key) {
      setData(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await apiRequest(`/api/projects/${projectId}/compare?cases=${key}`)
        const d = await r.json().catch(() => null)
        if (cancelled) return
        if (!r.ok || !d?.success) throw new Error(d?.error ?? `the comparison answered ${r.status}`)
        setData(d)
        setError(null)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'the comparison did not load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, key, tick])

  // Keep the address shareable.
  useEffect(() => {
    if (!cases || !inited.current) return
    window.history.replaceState(null, '', `/project/${projectId}/comparison${key ? `?cases=${key}` : ''}`)
  }, [cases, key, projectId])

  const toggle = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= COMPARE_MAX_CASES ? s : [...s, id]))
  }, [])

  /** Run a case again under the base case's method and region; the comparison reads again after. */
  const runAgain = useCallback(
    async (caseId: string, scope: { method: string | null; region: string | null }) => {
      const body: Record<string, string> = {}
      if (scope.method) body.calculation_method = scope.method
      if (scope.region) body.region_code = scope.region
      const res = await apiRequest(`/api/cases/${caseId}/assessments`, { method: 'POST', body: JSON.stringify(body) })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(res.status === 403 ? 'You can read this case but not run it.' : d?.error ?? `The run did not start (${res.status}).`)
      }
      setTick((t) => t + 1)
    },
    [],
  )

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const byId = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c])), [cases])
  return { cases, byId, selected, toggle, data, error, loading, runAgain, reload }
}
