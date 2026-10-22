'use client'

/**
 * The shell's data: the caller's projects (GET /api/projects) and profile
 * (GET /api/auth/profile), loaded once and shared by every signed-in page, so
 * moving between pages does not refetch. Pages that add, remove or pin a
 * project call `refresh()`. Plus one thing kept per device: the projects
 * opened recently.
 */

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { apiRequest } from '@/lib/api-client'
import { pushRecent, type NavProject } from './project-nav'

export interface ShellProfile {
  id: number
  fullName: string | null
  email: string
  company: string | null
}

interface ShellState {
  projects: NavProject[]
  profile: ShellProfile | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  load: (force?: boolean) => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
}

let inFlight: Promise<void> | null = null

export const useShellStore = create<ShellState>()((set, get) => ({
  projects: [],
  profile: null,
  status: 'idle',
  load: async (force = false) => {
    if (!force && (get().status === 'ready' || get().status === 'loading')) return inFlight ?? undefined
    set({ status: 'loading' })
    inFlight = (async () => {
      try {
        const [pr, me] = await Promise.all([apiRequest('/api/projects'), apiRequest('/api/auth/profile')])
        if (!pr.ok || !me.ok) throw new Error(`projects ${pr.status}, profile ${me.status}`)
        const projects = ((await pr.json()).projects ?? []) as NavProject[]
        const profile = (await me.json()).profile ?? null
        set({
          projects: projects.map((p) => ({ ...p, project_id: Number(p.project_id), owner_id: Number(p.owner_id) })),
          profile: profile && {
            id: Number(profile.id),
            fullName: profile.fullName ?? null,
            email: profile.email,
            company: profile.company ?? null,
          },
          status: 'ready',
        })
      } catch {
        set({ status: 'error' })
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  },
  refresh: () => get().load(true),
  reset: () => set({ projects: [], profile: null, status: 'idle' }),
}))

/** Load the shell's data once; any component can read the store after. */
export function useShellData() {
  const state = useShellStore()
  useEffect(() => {
    state.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

const RECENT_KEY = 'lcapix-recent-projects'

function readRecent(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
  } catch {
    return []
  }
}

/** This device's recently opened projects; opening one moves it first. */
export function useRecentProjects(openId: number | null) {
  const [ids, setIds] = useState<number[]>([])
  useEffect(() => {
    const now = openId ? pushRecent(readRecent(), openId) : readRecent()
    if (openId) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(now))
      } catch {}
    }
    setIds(now)
  }, [openId])
  return ids
}

