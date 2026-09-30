// @vitest-environment jsdom
/**
 * /project/:id/class: only the owner may grant the admin role (the API
 * answers 403 to an admin member who tries), so the role picker offers
 * "Admin" only when GET /members says canManageAdmins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useParams: () => ({ projectId: '7' }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import ClassPage from '@/app/project/[projectId]/class/page'
import { apiRequest } from '@/lib/api-client'

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
