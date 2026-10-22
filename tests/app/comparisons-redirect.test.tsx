import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string) => {
  // next/navigation's redirect throws to stop rendering.
  throw Object.assign(new Error('NEXT_REDIRECT'), { url })
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

import ComparisonsPage from '@/app/project/[projectId]/comparisons/page'
import ComparisonDetailPage from '@/app/project/[projectId]/comparisons/[comparisonId]/page'

// The legacy Saved comparisons pages fold into Compare Cases (UX spec): both
// send the reader to the Compare page's saved list.
describe('legacy /project/[id]/comparisons pages', () => {
  beforeEach(() => {
    redirect.mockClear()
  })

  it('the list redirects to /project/[id]/comparison?tab=saved', async () => {
    await expect(ComparisonsPage({ params: Promise.resolve({ projectId: '7' }) })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/project/7/comparison?tab=saved')
  })

  it('a saved comparison redirects to the same list', async () => {
    await expect(
      ComparisonDetailPage({ params: Promise.resolve({ projectId: '7', comparisonId: '4' }) }),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/project/7/comparison?tab=saved')
  })

  it('keeps a hostile project id inside the path', async () => {
    await expect(ComparisonsPage({ params: Promise.resolve({ projectId: '//evil.example' }) })).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/project/%2F%2Fevil.example/comparison?tab=saved')
  })
})
