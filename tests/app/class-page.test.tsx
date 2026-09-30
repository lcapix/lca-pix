// @vitest-environment jsdom
/**
 * /project/:id/class: only the owner may grant the admin role (the API
 * answers 403 to an admin member who tries), so the role picker offers
 * "Admin" only when GET /members says canManageAdmins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useParams: () => ({ projectId: '7' }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import ClassPage from '@/app/project/[projectId]/class/page'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as any

function serve(flags: { canManage: boolean; canManageAdmins: boolean }) {
  vi.mocked(apiRequest).mockImplementation(async (url: string) => {
    if (url === '/api/projects/7/members') {
      return json({
        success: true,
        owner: { user_id: 1, username: 'olivia', email: 'olivia@lcapix.test' },
        members: [{ member_id: 3, user_id: 2, username: 'ada', email: 'ada@lcapix.test', permission_name: 'admin' }],
        ...flags,
      })
    }
    return json({ success: true, cases: [] })
  })
}

const roleOptions = () => Array.from(screen.getByRole('combobox').querySelectorAll('option')).map((o) => o.textContent)

describe('class page role picker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('the owner can grant Viewer, Editor and Admin', async () => {
    serve({ canManage: true, canManageAdmins: true })
    render(<ClassPage />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy())
    expect(roleOptions()).toEqual(['Viewer, can read', 'Editor, can change', 'Admin, can share'])
  })

  it('an admin member is not offered Admin', async () => {
    serve({ canManage: true, canManageAdmins: false })
    render(<ClassPage />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy())
    expect(roleOptions()).toEqual(['Viewer, can read', 'Editor, can change'])
  })

  it('a viewer sees no add form at all', async () => {
    serve({ canManage: false, canManageAdmins: false })
    render(<ClassPage />)
    await waitFor(() => expect(screen.getByText('ada@lcapix.test')).toBeTruthy())
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

const CASES = [
  { case_id: 11, case_name: 'Mug study', author: 'Student A', created_by: 5, steps: 3, flows: 2, runs: 1, has_interpretation: false, has_assumptions: false, lessons_total: 6, lessons_answered: [], prediction_made: false, is_final: false, updated_at: null },
  { case_id: 12, case_name: 'Mug study', author: 'Student B', created_by: 6, steps: 1, flows: 0, runs: 0, has_interpretation: false, has_assumptions: false, lessons_total: 6, lessons_answered: [], prediction_made: false, is_final: false, updated_at: null },
]

/** members + progress, and PUT /api/projects/7 answering `putStatus`. */
function serveClass(opts: { canManage: boolean; ownOnly: boolean; putStatus?: number }) {
  let ownOnly = opts.ownOnly
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (url === '/api/projects/7/members') {
      return json({ success: true, owner: { username: 'olivia', email: 'olivia@lcapix.test' }, members: [], canManage: opts.canManage, canManageAdmins: opts.canManage })
    }
    if (url === '/api/projects/7/progress') return json({ success: true, members_see_own_cases: ownOnly, cases: CASES })
    if (url === '/api/projects/7' && init?.method === 'PUT') {
      const status = opts.putStatus ?? 200
      if (status !== 200) return { ok: false, status, json: async () => ({ error: 'Access denied' }) } as any
      ownOnly = JSON.parse(init.body).members_see_own_cases
      return json({ success: true, project: { members_see_own_cases: ownOnly } })
    }
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`)
  })
}

const ownOnlySwitch = () => screen.getByRole('switch', { name: /students see only their own case/i }) as HTMLInputElement

describe('class page: students see only their own case (B-A1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('the instructor sees the switch, off by default, with what it does', async () => {
    serveClass({ canManage: true, ownOnly: false })
    render(<ClassPage />)
    await waitFor(() => expect(ownOnlySwitch()).toBeTruthy())
    expect(ownOnlySwitch().checked).toBe(false)
    expect(screen.getByText(/editors and viewers open only the cases they created/i)).toBeTruthy()
  })

  it('turning it on saves the setting on the project and shows it on', async () => {
    serveClass({ canManage: true, ownOnly: false })
    render(<ClassPage />)
    await waitFor(() => expect(ownOnlySwitch()).toBeTruthy())
    fireEvent.click(ownOnlySwitch())
    await waitFor(() => expect(ownOnlySwitch().checked).toBe(true))
    const put = vi.mocked(apiRequest).mock.calls.find(([u, i]) => u === '/api/projects/7' && (i as any)?.method === 'PUT')!
    expect(JSON.parse((put[1] as any).body)).toEqual({ members_see_own_cases: true })
  })

  it('a refused change says so and leaves the switch as it was', async () => {
    serveClass({ canManage: true, ownOnly: true, putStatus: 403 })
    render(<ClassPage />)
    await waitFor(() => expect(ownOnlySwitch().checked).toBe(true))
    fireEvent.click(ownOnlySwitch())
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(ownOnlySwitch().checked).toBe(true)
  })

  it('someone who cannot manage the project gets no switch, only the state when it is on', async () => {
    serveClass({ canManage: false, ownOnly: true })
    render(<ClassPage />)
    await waitFor(() => expect(screen.getAllByText('Mug study').length).toBe(2))
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByText(/each student sees only their own case/i)).toBeTruthy()
  })

  it('each case row shows who made it, so two cases with one name can be told apart', async () => {
    serveClass({ canManage: true, ownOnly: true })
    render(<ClassPage />)
    await waitFor(() => expect(screen.getByText('Student A')).toBeTruthy())
    expect(screen.getByText('Student B')).toBeTruthy()
    expect(screen.getByText('Author')).toBeTruthy()
  })
})
