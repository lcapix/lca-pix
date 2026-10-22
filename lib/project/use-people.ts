'use client'

// The People page's data (E08): the project (its name, owner), who is on it
// with their access (the members route), and how many cases each made (the
// case summaries route). Add or change access is POST /members, remove is
// DELETE /members.

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { useShellData } from '@/lib/shell/use-shell'
import { chunks, type Access, type AddResult, type Person } from './people-view'

/** The route takes at most this many emails per request (BULK_MAX). */
const PER_REQUEST = 100

export interface PeopleData {
  project: { project_id: number; project_name: string }
  owner: Person
  members: Person[]
  canManage: boolean
  canManageAdmins: boolean
  cases: Array<{ created_by: number | null }>
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  const d = await res.json().catch(() => null)
  return d?.error || `${fallback} (${res.status})`
}

export function usePeople(projectId: number) {
  const { refresh } = useShellData()
  const [data, setData] = useState<PeopleData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, m, g] = await Promise.all([
        apiRequest(`/api/projects/${projectId}`),
        apiRequest(`/api/projects/${projectId}/members`),
        apiRequest(`/api/projects/${projectId}/case-summaries`),
      ])
      if (!p.ok) throw new Error(p.status === 404 ? 'This project is not here, or it is not shared with you.' : `the project answered ${p.status}`)
      if (!m.ok) throw new Error(`the people answered ${m.status}`)
      const pj = (await p.json()).project
      const mj = await m.json()
      const gj = g.ok ? await g.json() : { cases: [] }
      const person = (x: any): Person => ({
        user_id: Number(x.user_id),
        full_name: x.full_name ?? null,
        username: x.username ?? null,
        email: x.email ?? null,
        permission_name: x.permission_name ?? null,
      })
      setData({
        project: { project_id: Number(pj.project_id), project_name: pj.project_name },
        owner: person({ ...(mj.owner ?? {}), permission_name: 'owner' }),
        members: (mj.members ?? []).map(person),
        canManage: !!mj.canManage,
        canManageAdmins: !!mj.canManageAdmins,
        cases: (gj.cases ?? []).map((c: any) => ({ created_by: c.created_by == null ? null : Number(c.created_by) })),
      })
    } catch (e: any) {
      setError(e?.message ?? 'the people did not load')
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Add a list of emails (or change their access): what happened to each one.
   * A long list goes in parts; when a part fails, the parts before it
   * still stand and are reported, with the error and how many were not sent.
   */
  const addPeople = useCallback(
    async (emails: string[], role: Access): Promise<{ results: AddResult[]; error: string | null }> => {
      const results: AddResult[] = []
      let error: string | null = null
      const parts = chunks(emails, PER_REQUEST)
      for (let i = 0; i < parts.length; i++) {
        const res = await apiRequest(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ emails: parts[i], role }) })
        if (!res.ok) {
          const left = parts.slice(i).reduce((n, p) => n + p.length, 0)
          error = `${await errorOf(res, 'Not added')}. ${left} ${left === 1 ? 'email was' : 'emails were'} not sent.`
          break
        }
        results.push(...((await res.json()).results ?? []))
      }
      if (results.length) await Promise.all([load(), refresh()])
      return { results, error }
    },
    [projectId, load, refresh],
  )

  /** Change one person's access (the route treats an existing member's email as a change). */
  const changeAccess = useCallback(
    async (person: Person, role: Access) => {
      if (!person.email) throw new Error('This person has no email on their account.')
      const res = await apiRequest(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email: person.email, role }) })
      if (!res.ok) throw new Error(await errorOf(res, 'Their access did not change'))
      await load()
    },
    [projectId, load],
  )

  const remove = useCallback(
    async (person: Person) => {
      const res = await apiRequest(`/api/projects/${projectId}/members?user_id=${person.user_id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await errorOf(res, 'They were not removed'))
      await Promise.all([load(), refresh()])
    },
    [projectId, load, refresh],
  )

  return { data, error, reload: load, addPeople, changeAccess, remove }
}
