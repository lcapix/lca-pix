// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { matchingLines, useCaseDocuments } from '@/lib/case-editor/use-case-documents'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any
const ROW = { document_id: 3, filename: 'routing.csv', doc_type: 'routing' }

let docs: any[]
beforeEach(() => {
  vi.clearAllMocks()
  docs = [ROW]
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (init?.method === 'POST') return json({ success: true, truncated: true })
    if (init?.method === 'DELETE') {
      docs = []
      return json({ success: true })
    }
    if (url.includes('?id=3')) return json({ document: { filename: 'routing.csv', content: 'Op,Hours\nCut,0.2\nWeld,0.5' } })
    return json({ documents: docs })
  })
})

describe('matchingLines', () => {
  it('keeps line numbers and filters by a case-insensitive search', () => {
    expect(matchingLines('a\nWeld 0.5\nb', 'weld')).toEqual([{ n: 2, text: 'Weld 0.5', hit: true }])
    expect(matchingLines('a\nb', ' ')).toEqual([
      { n: 1, text: 'a', hit: false },
      { n: 2, text: 'b', hit: false },
    ])
  })
})

describe('useCaseDocuments', () => {
  it('lists, opens, searches and removes a case document', async () => {
    const { result } = renderHook(() => useCaseDocuments('10'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.docs).toEqual([ROW])

    await act(async () => result.current.openCaseDoc(ROW))
    expect(result.current.open).toMatchObject({ key: 'case-3', filename: 'routing.csv', source: 'case' })
    expect(result.current.lines).toHaveLength(3)
    act(() => result.current.setNeedle('weld'))
    expect(result.current.hitCount).toBe(1)

    await act(async () => result.current.remove(ROW))
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/api/cases/10/documents?id=3', { method: 'DELETE' })
    expect(result.current.open).toBeNull()
    expect(result.current.docs).toEqual([])
  })

  it('attaches a file with its document type', async () => {
    const { result } = renderHook(() => useCaseDocuments('10'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setDocType('bom'))
    await act(async () => result.current.attach(new File(['x'], 'bom.csv')))
    const post = vi.mocked(apiRequest).mock.calls.find(([, i]) => (i as any)?.method === 'POST') as any
    expect(post[0]).toBe('/api/cases/10/documents')
    expect((post[1].body as FormData).get('doc_type')).toBe('bom')
    expect(toast.success).toHaveBeenCalledWith('Attached (long file, kept the first part)')
    expect(result.current.uploading).toBe(false)
  })

  it('a document that cannot be opened says so and closes', async () => {
    vi.mocked(apiRequest).mockImplementation(async (url: string) =>
      url.includes('?id=') ? json({ error: 'Not found' }, 404) : json({ documents: [ROW] }),
    )
    const { result } = renderHook(() => useCaseDocuments('10'))
    await act(async () => result.current.openCaseDoc(ROW))
    expect(toast.error).toHaveBeenCalledWith('Not found')
    expect(result.current.open).toBeNull()
  })
})
