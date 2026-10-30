/**
 * The old new-case addresses (base, comparative, start) are redirects now:
 * New case does all three, opened on the matching choice (Task 12).
 */
import { describe, it, expect, vi } from 'vitest'

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`)
})
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))

import BasePage from '@/app/project/[projectId]/case/base/new/page'
import ComparativePage from '@/app/project/[projectId]/case/comparative/new/page'
import StartPage from '@/app/project/[projectId]/start/page'

const params = Promise.resolve({ projectId: '7' })

describe('old new-case addresses', () => {
  it('case/base/new opens New case on a base case', async () => {
    await expect(BasePage({ params })).rejects.toThrow('NEXT_REDIRECT /project/7/case/new?kind=base')
  })
  it('case/comparative/new opens New case on a what-if copy', async () => {
    await expect(ComparativePage({ params })).rejects.toThrow('NEXT_REDIRECT /project/7/case/new?kind=whatif')
  })
  it('start opens New case on building by hand', async () => {
    await expect(StartPage({ params })).rejects.toThrow('NEXT_REDIRECT /project/7/case/new?kind=hand')
  })
})
