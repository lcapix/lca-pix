'use client'

/**
 * Start empty (F2.1 "Empty", F2.2b "Start empty instead", F2.5): the project's
 * Base case, made now with no steps; it opens on its tree. A project that
 * already has a case named "Base case" (409) opens that one instead.
 */

import { apiRequest } from '@/lib/api-client'

export async function startEmptyCase(projectId: number): Promise<number> {
  const res = await apiRequest(`/api/projects/${projectId}/cases`, {
    method: 'POST',
    body: JSON.stringify({ case_name: 'Base case', case_type: 'base' }),
  })
  const d = await res.json().catch(() => ({}))
  if (res.ok && d?.case?.case_id) return Number(d.case.case_id)
  if (res.status === 409) {
    const list = await apiRequest(`/api/projects/${projectId}/cases`).then((r) => (r.ok ? r.json() : null))
    const base = (list?.cases ?? []).find((c: any) => String(c.case_name).toLowerCase() === 'base case')
    if (base) return Number(base.case_id)
  }
  throw new Error(d?.error ?? `the case was not made (${res.status})`)
}
