/**
 * P31: /project/:id/class is the old Class page's address. Class progress
 * lives on Cases, so the address redirects there on the server, before any
 * of the old page renders.
 */
import { describe, it, expect, vi } from 'vitest'

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`)
})
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))

import ClassPage from '@/app/project/[projectId]/class/page'

describe('/project/:id/class', () => {
  it('P31 redirects to the project\'s Cases', async () => {
    await expect(ClassPage({ params: Promise.resolve({ projectId: '7' }) })).rejects.toThrow('NEXT_REDIRECT /project/7/cases')
    expect(redirect).toHaveBeenCalledWith('/project/7/cases')
  })
})
