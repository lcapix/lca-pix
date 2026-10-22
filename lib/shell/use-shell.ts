'use client'

/**
 * The shell's data: the caller's projects (GET /api/projects) and profile
 * (GET /api/auth/profile), loaded once and shared by every signed-in page, so
 * moving between pages does not refetch. Pages that add, remove or pin a
 * project call `refresh()`. Plus two things kept per device: the projects
 * opened recently, and the Guided mode switch (BETA; saving it to the account
 * is Coming soon).
 */

import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import { apiRequest } from '@/lib/api-client'
import { pushRecent, type NavProject } from './project-nav'

export interface ShellProfile {
  id: number
  fullName: string | null
  email: string
  company: string | null
  /** teaching, lab, own_study (or an older value): Home says "student" for teaching. */
  useCase: string | null
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
            useCase: profile.useCase ?? null,
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

const GUIDED_KEY = 'lcapix-guided-mode'
const GUIDED_EVENT = 'lcapix:guided-mode'

/**
 * Guided mode (BETA): off by default, kept on this device only. Every
 * listener hears a change made anywhere (the sidebar switch, "Turn off").
 */
/** Turn Guided mode on for this device, from outside a component (Docs' button). */
export function turnOnGuidedMode(): void {
  try {
    localStorage.setItem(GUIDED_KEY, '1')
  } catch {}
  window.dispatchEvent(new Event(GUIDED_EVENT))
}

export function useGuidedMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const read = () => {
      try {
        setOn(localStorage.getItem(GUIDED_KEY) === '1')
      } catch {
        setOn(false)
      }
    }
    read()
    window.addEventListener(GUIDED_EVENT, read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(GUIDED_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [])
  const set = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(GUIDED_KEY, '1')
      else localStorage.removeItem(GUIDED_KEY)
    } catch {}
    setOn(next)
    window.dispatchEvent(new Event(GUIDED_EVENT))
  }, [])
  return [on, set]
}
