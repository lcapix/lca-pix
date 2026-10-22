'use client'

/**
 * "Make my own copy" (E02, E03): the case duplicated, named after the person
 * ("Elena Rivera's case"), with no runs. A name already used in the project
 * is answered 409, so the next number is tried ("Elena Rivera's case 2").
 */

import { apiRequest } from '@/lib/api-client'
import { useShellStore } from '@/lib/shell/use-shell'

export async function makeOwnCopy(caseId: number, ownName: string | null): Promise<number> {
  const base = ownName ? `${ownName}'s case` : 'My copy'
  for (let i = 0; i < 20; i++) {
    const name = i === 0 ? base : `${base} ${i + 1}`
    const res = await apiRequest(`/api/cases/${caseId}/duplicate`, { method: 'POST', body: JSON.stringify({ case_name: name }) })
    if (res.status === 409) continue
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
    // The sidebar's case count follows.
    void useShellStore.getState().refresh()
    return Number(d.case_id)
  }
  throw new Error('every name tried is taken; rename one of your copies')
}
