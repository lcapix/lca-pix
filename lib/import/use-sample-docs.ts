'use client'

// The bundled sample documents on the import page: load one as the chosen
// file, read it in a panel, download it, download its blank template, copy it.

import { useState } from 'react'
import { toast } from 'sonner'

import { SAMPLE_DOCS } from '@/lib/ingest/sample-docs'
import { sampleProductName, templateCsv, templateFilename } from '@/lib/import/preview'

/** The sample document open in the panel. */
export interface SampleView {
  conn: string
  filename: string
  content: string
}

/** The pick-form state a loaded sample writes to. */
export interface SampleDocsDeps {
  plantId: string
  setFile: (file: File | null) => void
  setPlantId: (plantId: string) => void
  setError: (error: string | null) => void
}

/** Sample-document panel state and the sample actions. */
export function useSampleDocs({ plantId, setFile, setPlantId, setError }: SampleDocsDeps) {
  // The sample document shown in a panel (View sample).
  const [sampleView, setSampleView] = useState<SampleView | null>(null)

  // Load a bundled sample so a student with no document can still run the flow.
  const loadSample = (conn: string) => {
    const s = SAMPLE_DOCS[conn]
    if (!s) return
    setFile(new File([s.content], s.filename, { type: 'text/csv' }))
    const productName = sampleProductName(conn, plantId)
    if (productName) setPlantId(productName)
    setError(null)
    toast.success('Sample loaded — now click "Preview extraction"')
  }
  // Read the document before trusting what came out of it: opens the sample
  // CSV in a new tab, rows and all.
  // Browsers block a pop-up to a blob: URL, so the sample opens in a panel
  // here instead of a new tab.
  const viewSample = (conn: string) => {
    const sample = SAMPLE_DOCS[conn]
    if (!sample) return
    setSampleView({ conn, filename: sample.filename, content: sample.content })
  }
  const downloadSample = (conn: string) => {
    const sample = SAMPLE_DOCS[conn]
    if (!sample) return
    const url = URL.createObjectURL(new Blob([sample.content], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = sample.filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  // Download the blank template (header row) for the selected connector, so a
  // student can fill in their own data in the shape we expect.
  const downloadTemplate = (conn: string) => {
    const s = SAMPLE_DOCS[conn]
    if (!s) return
    const header = templateCsv(s.content)
    const url = URL.createObjectURL(new Blob([header], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = templateFilename(conn)
    a.click()
    URL.revokeObjectURL(url)
  }
  const copySample = (content: string) => navigator.clipboard?.writeText(content)
  const closeSample = () => setSampleView(null)

  return {
    sampleView,
    loadSample,
    viewSample,
    downloadSample,
    downloadTemplate,
    copySample,
    closeSample,
  }
}
