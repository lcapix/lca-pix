// @vitest-environment jsdom
/**
 * Home, commercial version: with no project, the two ways in (a file or
 * empty) and nothing about a sample; with projects, the list and no sample
 * row. Home never asks the server to build a sample.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
}))

import { EduHome } from '@/components/lcapix/home/edu-home'
import { useShellStore } from '@/lib/shell/use-shell'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const own = { project_id: 5, project_name: 'Aluminium enclosure', owner_id: 1, case_count: 1, people: 1, member_count: 0 }

let projects: any[] = []
const calls: string[] = []

beforeEach(() => {
  projects = []
  calls.length = 0
  localStorage.setItem('auth_token', 'token-abc')
  useShellStore.getState().reset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).split('?')[0]
      calls.push(`${init?.method ?? 'GET'} ${path}`)
      if (path === '/api/projects') return json({ success: true, projects })
      if (path === '/api/auth/profile') return json({ success: true, profile: { id: 1, fullName: 'Ada Lovelace', email: 'ada@example.com' } })
      return json({ success: true })
    }),
  )
})

describe('Home', () => {
  it('with no project: two ways in, no sample', async () => {
    const { container } = render(<EduHome />)
    expect(await screen.findByText('Start one of two ways.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Start from a file' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Start empty' })).toBeTruthy()
    expect(container.textContent).not.toMatch(/\b(sample|student|teach|class\b)/i)
  })

  it('with projects: the list, no sample row, and no sample is ever built', async () => {
    projects = [own]
    const { container } = render(<EduHome />)
    expect(await screen.findByText('Aluminium enclosure')).toBeTruthy()
    expect(screen.getByText('Your projects · 1')).toBeTruthy()
    expect(container.textContent).not.toMatch(/\b(sample|student|hand-in|teach)/i)
    await waitFor(() => expect(calls).toContain('GET /api/projects'))
    expect(calls.some((c) => c.includes('/api/example-project'))).toBe(false)
  })
})
