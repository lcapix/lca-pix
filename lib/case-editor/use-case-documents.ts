'use client'

// The reference pane's data: the case's own documents (list, open, attach,
// remove — GET/POST/DELETE /api/cases/:id/documents), the one open beside
// the editor (a case document or a bundled sample), and the search inside it.

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'

export type CaseDocumentRow = {
  document_id: number
  filename: string
  doc_type: string | null
  created_at?: string
  char_count?: number
}

export type OpenDocument = { key: string; filename: string; content: string; source: 'case' | 'sample' }

export type DocumentLine = { n: number; text: string; hit: boolean }

/**
 * Lines that match, with their line numbers kept, so a value can be quoted
 * back to the line it came from. A blank search shows every line.
 */
export function matchingLines(content: string, needle: string): DocumentLine[] {
  const all = content.split('\n')
  const q = needle.trim().toLowerCase()
  const rows = all.map((text, i) => ({ n: i + 1, text, hit: !!q && text.toLowerCase().includes(q) }))
  return q ? rows.filter((r) => r.hit) : rows
}

export function useCaseDocuments(caseId: string | number) {
  const [docs, setDocs] = useState<CaseDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<OpenDocument | null>(null)
  const [needle, setNeedle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('routing')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    try {
      const res = await apiRequest(`/api/cases/${caseId}/documents`)
      const data = await res.json().catch(() => ({}))
      setDocs(Array.isArray(data?.documents) ? data.documents : [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  const openCaseDoc = async (row: CaseDocumentRow) => {
    setOpen({ key: `case-${row.document_id}`, filename: row.filename, content: 'Loading…', source: 'case' })
    try {
      const res = await apiRequest(`/api/cases/${caseId}/documents?id=${row.document_id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.document) {
        toast.error(data?.error || 'Could not open that document')
        setOpen(null)
        return
      }
      setOpen({
        key: `case-${row.document_id}`,
        filename: data.document.filename,
        content: data.document.content ?? '',
        source: 'case',
      })
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not open that document')
      setOpen(null)
    }
  }

  const attach = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('doc_type', docType)
      const res = await apiRequest(`/api/cases/${caseId}/documents`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        toast.error(data?.error || `Could not attach (${res.status})`)
        return
      }
      toast.success(data?.truncated ? 'Attached (long file, kept the first part)' : 'Attached')
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not attach')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (row: CaseDocumentRow) => {
    try {
      const res = await apiRequest(`/api/cases/${caseId}/documents?id=${row.document_id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error(`Could not remove (${res.status})`)
        return
      }
      if (open?.key === `case-${row.document_id}`) setOpen(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not remove')
    }
  }

  const lines = useMemo(() => {
    if (!open) return [] as DocumentLine[]
    return matchingLines(open.content, needle)
  }, [open, needle])

  const hitCount = useMemo(
    () => (needle.trim() && open ? lines.length : 0),
    [needle, lines, open],
  )

  return {
    docs,
    loading,
    open,
    setOpen,
    needle,
    setNeedle,
    uploading,
    docType,
    setDocType,
    fileRef,
    openCaseDoc,
    attach,
    remove,
    lines,
    hitCount,
  }
}
