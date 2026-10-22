// @vitest-environment jsdom
/**
 * E12's promise: after the sample is removed, Home offers it again ("You can
 * add the sample again"), and adding it calls the sample builder.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
}))

import { EduHome } from '@/components/lcapix/home/edu-home'
import { useShellStore } from '@/lib/shell/use-shell'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const own = { project_id: 5, project_name: 'Aluminium enclosure', owner_id: 1, is_sample: 0, case_count: 1, people: 1, member_count: 0 }
const sample = { project_id: 9, project_name: 'Painted steel bracket', owner_id: 1, is_sample: 1, case_count: 2, people: 1, member_count: 0 }

let projects: any[] = [own]
const calls: string[] = []

beforeEach(() => {
  projects = [own]
  calls.length = 0
  localStorage.setItem('auth_token', 'token-abc')
  useShellStore.getState().reset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).split('?')[0]
      calls.push(`${init?.method ?? 'GET'} ${path}`)
      if (path === '/api/projects') return json({ success: true, projects })
      if (path === '/api/auth/profile') return json({ success: true, profile: { id: 1, full_name: 'Ada Lovelace', email: 'ada@example.com', use_case: 'teaching' } })
      if (path === '/api/example-project') {
        projects = [own, sample]
        return json({ success: true, project_id: 9 })
      }
      return json({ success: true })
    }),
  )
})

describe('Home without the sample', () => {
  it('offers the sample study again and builds it', async () => {
    render(<EduHome />)
    const add = await screen.findByRole('button', { name: 'Add the sample study' })
    fireEvent.click(add)
    await waitFor(() => expect(calls).toContain('POST /api/example-project'))
    // The shell reads the projects again, and the row becomes the sample's own.
    expect(await screen.findByText('Remove the sample')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add the sample study' })).toBeNull()
  })
})
