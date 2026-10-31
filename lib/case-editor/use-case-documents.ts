'use client'

// The Documents panel's data (E21): the case's own documents (list, open,
// add, delete through GET/POST/DELETE /api/cases/:id/documents), the one open
// for reading (a case document or a bundled sample), and the search inside
// it. A read or a write that fails says so with its reason; a failed list is
// never shown as an empty one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { uploadTooLargeMessage } from '@/lib/upload-limits'
import { documentsError, matchingLines, type DocumentLine } from './case-documents'

export type CaseDocumentRow = {
  document_id: number
  filename: string
  doc_type: string | null
  created_at?: string
  char_count?: number
}

export type OpenDocument = {
  key: string
  filename: string
  docType: string | null
  /** Null while a case document's text is on its way. */
  content: string | null
  source: 'case' | 'sample'
  /** The case document's id, so Try again can ask for it again. */
  documentId?: number
}

/** The last add that worked, for the saved line under the form. */
export type Added = { filename: string; truncated: boolean }

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export function useCaseDocuments(caseId: string | number) {
  // Null until the list has loaded once: an empty array means "none kept".
  const [docs, setDocs] = useState<CaseDocumentRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [open, setOpen] = useState<OpenDocument | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [needle, setNeedle] = useState('')

  const [docType, setDocType] = useState('routing')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [added, setAdded] = useState<Added | null>(null)

  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // A newer request wins: an answer for a case left behind is dropped.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const mine = ++seq.current
    setLoading(true)
    setLoadError(null)
    try {
      const res = await apiRequest(`/api/cases/${caseId}/documents`)
      const data = await res.json().catch(() => null)
      if (mine !== seq.current) return
      if (!res.ok) throw new Error(documentsError(res.status, data))
      if (!Array.isArray(data?.documents)) throw new Error('The list came back in a form this page cannot read.')
      setDocs(data.documents)
    } catch (e) {
      if (mine !== seq.current) return
      setLoadError(message(e, 'The request did not reach the server.'))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    setDocs(null)
    setOpen(null)
    setNeedle('')
    void load()
  }, [load])

  const openCaseDoc = useCallback(
    async (row: CaseDocumentRow) => {
      const key = `case-${row.document_id}`
      setOpenError(null)
      setNeedle('')
      setOpen({ key, filename: row.filename, docType: row.doc_type, content: null, source: 'case', documentId: row.document_id })
      try {
        const res = await apiRequest(`/api/cases/${caseId}/documents?id=${row.document_id}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.document) throw new Error(documentsError(res.status, data))
        setOpen((cur) =>
          cur?.key === key
            ? { ...cur, filename: data.document.filename ?? row.filename, content: String(data.document.content ?? '') }
            : cur,
        )
      } catch (e) {
        setOpenError(message(e, 'The request did not reach the server.'))
      }
    },
    [caseId],
  )

  const openSample = useCallback((key: string, doc: { filename: string; content: string }) => {
    setOpenError(null)
    setNeedle('')
    setOpen({ key: `sample-${key}`, filename: doc.filename, docType: key, content: doc.content, source: 'sample' })
  }, [])

  const close = useCallback(() => {
    setOpen(null)
    setOpenError(null)
    setNeedle('')
  }, [])

  /** Sends the file with the chosen type. True when it was kept. */
  const attach = useCallback(
    async (file: File): Promise<boolean> => {
      setUploadError(null)
      setAdded(null)
      // Over the hosting limit the platform refuses the upload unexplained; say why first.
      const tooLarge = uploadTooLargeMessage(file)
      if (tooLarge) {
        setUploadError(tooLarge)
        return false
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('doc_type', docType)
        const res = await apiRequest(`/api/cases/${caseId}/documents`, { method: 'POST', body: form })
        const data = await res.json().catch(() => null)
        if (!res.ok || data?.success === false) throw new Error(documentsError(res.status, data))
        setAdded({ filename: file.name, truncated: !!data?.truncated })
        await load()
        return true
      } catch (e) {
        setUploadError(message(e, 'The file did not reach the server.'))
        return false
      } finally {
        setUploading(false)
      }
    },
    [caseId, docType, load],
  )

  /** Deletes one document. True when it is gone. */
  const remove = useCallback(
    async (row: CaseDocumentRow): Promise<boolean> => {
      setRemoveError(null)
      setRemoving(true)
      try {
        const res = await apiRequest(`/api/cases/${caseId}/documents?id=${row.document_id}`, { method: 'DELETE' })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(documentsError(res.status, data))
        setOpen((cur) => (cur?.key === `case-${row.document_id}` ? null : cur))
        setAdded(null)
        await load()
        return true
      } catch (e) {
        setRemoveError(message(e, 'The request did not reach the server.'))
        return false
      } finally {
        setRemoving(false)
      }
    },
    [caseId, load],
  )

  const lines = useMemo<DocumentLine[]>(() => (open?.content == null ? [] : matchingLines(open.content, needle)), [open, needle])

  return {
    docs,
    loading,
    loadError,
    reload: load,
    open,
    openError,
    openCaseDoc,
    openSample,
    close,
    needle,
    setNeedle,
    lines,
    docType,
    setDocType,
    uploading,
    uploadError,
    added,
    attach,
    removing,
    removeError,
    clearRemoveError: () => setRemoveError(null),
    remove,
  }
}
