import { describe, it, expect, vi } from 'vitest'

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  }),
}))
vi.mock('next/navigation', () => ({ redirect }))

import EditComponentPage from '@/app/project/[projectId]/case/[caseId]/component/[componentId]/edit/page'

describe('old full-page component edit route (FLOW-8)', () => {
  it('redirects to the case editor with that component selected', async () => {
    await expect(
      EditComponentPage({ params: Promise.resolve({ projectId: '7', caseId: '10', componentId: '4' }) } as any),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/project/7/case/10?componentId=4')
  })
})
