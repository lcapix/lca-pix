// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCaseDocuments } from '@/lib/case-editor/use-case-documents'

const answer = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const ROW = { document_id: 7, filename: 'small-routing.csv', doc_type: 'routing' }

let fetchMock: ReturnType<typeof vi.fn>
const path = (url: string) => url.replace(/[?&]_t=\d+/, '')

beforeEach(() => {
  // Node 25 brings its own localStorage, which hides jsdom's: a plain one stands in.
  const store = new Map<string, string>([['auth_token', 'tok']])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
  fetchMock = vi.fn(async (url: string, init?: any) => {
    const p = path(url)
    if (p === '/api/cases/5/documents' && !init?.method) return answer({ success: true, documents: [ROW] })
    if (p === '/api/cases/5/documents?id=7' && !init?.method)
      return answer({ success: true, document: { ...ROW, content: 'Op No,Operation\n20,Weld frame' } })
    return answer({ success: true })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useCaseDocuments', () => {
  it('lists the case documents', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.docs).toEqual([ROW])
    expect(result.current.loadError).toBeNull()
  })

  it('shows a failed list as an error, never as an empty list', async () => {
    fetchMock.mockImplementationOnce(async () => answer({ error: 'Failed to load documents' }, 500))
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.docs).toBeNull()
    expect(result.current.loadError).toBe('Failed to load documents')
    // Try again loads it.
    await act(() => result.current.reload())
    expect(result.current.docs).toEqual([ROW])
    expect(result.current.loadError).toBeNull()
  })

  it('treats a list in the wrong shape as an error too', async () => {
    fetchMock.mockImplementationOnce(async () => answer({ success: true }))
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.docs).toBeNull()
    expect(result.current.loadError).toMatch(/cannot read/)
  })

  it('opens a document and searches inside it', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.openCaseDoc(ROW))
    expect(result.current.open?.content).toBe('Op No,Operation\n20,Weld frame')
    expect(result.current.lines).toHaveLength(2)
    act(() => result.current.setNeedle('weld'))
    expect(result.current.lines).toEqual([{ n: 2, text: '20,Weld frame', hit: true }])
  })

  it('says why a document did not open', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockImplementationOnce(async () => answer({ error: 'Document not found' }, 404))
    await act(() => result.current.openCaseDoc(ROW))
    expect(result.current.openError).toBe('Document not found')
    expect(result.current.open?.content).toBeNull()
  })

  it('sends the file with its type, then reloads the list', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setDocType('bom'))
    const file = new File(['Item,Qty\nA,1'], 'small-bom.csv', { type: 'text/csv' })
    let kept = false
    await act(async () => {
      kept = await result.current.attach(file)
    })
    expect(kept).toBe(true)
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(path(post[0])).toBe('/api/cases/5/documents')
    const form = post[1].body as FormData
    expect(form.get('doc_type')).toBe('bom')
    expect((form.get('file') as File).name).toBe('small-bom.csv')
    expect(result.current.added).toEqual({ filename: 'small-bom.csv', truncated: false })
    expect(result.current.uploadError).toBeNull()
  })

  it('says why a file was not added', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockImplementationOnce(async () => answer({ error: 'No readable text in that file. Scanned images are not read.' }, 400))
    let kept = true
    await act(async () => {
      kept = await result.current.attach(new File(['x'], 'scan.pdf'))
    })
    expect(kept).toBe(false)
    expect(result.current.uploadError).toMatch(/No readable text/)
    expect(result.current.added).toBeNull()
  })

  it('deletes a document, closing it when it was open', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.openCaseDoc(ROW))
    let gone = false
    await act(async () => {
      gone = await result.current.remove(ROW)
    })
    expect(gone).toBe(true)
    const del = fetchMock.mock.calls.find(([, i]) => i?.method === 'DELETE')!
    expect(path(del[0])).toBe('/api/cases/5/documents?id=7')
    expect(result.current.open).toBeNull()
  })

  it('says why a delete failed and keeps the list', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockImplementationOnce(async () => answer({ error: 'Forbidden' }, 403))
    let gone = true
    await act(async () => {
      gone = await result.current.remove(ROW)
    })
    expect(gone).toBe(false)
    expect(result.current.removeError).toBe('Forbidden')
    expect(result.current.docs).toEqual([ROW])
  })

  it('opens a bundled sample without asking the server', async () => {
    const { result } = renderHook(() => useCaseDocuments(5))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = fetchMock.mock.calls.length
    act(() => result.current.openSample('routing', { filename: 'sample-routing.csv', content: 'a\nb' }))
    expect(result.current.open).toMatchObject({ source: 'sample', filename: 'sample-routing.csv', content: 'a\nb' })
    expect(fetchMock.mock.calls.length).toBe(before)
  })
})
