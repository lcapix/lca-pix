'use client'

import Link from 'next/link'

// The Documents panel (E21): the case's own source documents (a routing, a
// bill of materials, an equipment list, an EPD, a safety data sheet, an ITAC
// report) open beside the tree, so a student reads amounts off them while
// modelling. It lists them with their type, opens one to read, searches
// inside it, adds one with its type, and deletes one after a confirm. The
// bundled samples are listed too. Adding and deleting are hidden when the
// case is read-only for this person. Closed by default; the tab row's
// Documents button opens it.

import { useEffect, useId, useRef, useState } from 'react'
import { Button, ConfirmDialog, ErrorCard, IconButton, SavedLine, SearchField } from '@/components/lcapix/ds'
import { DOC_TYPES, docTypeLabel, highlightParts, hitSummary, importableKind } from '@/lib/case-editor/case-documents'
import { useCaseDocuments, type CaseDocumentRow } from '@/lib/case-editor/use-case-documents'
import { SAMPLE_DOCS, SAMPLE_LABELS } from '@/lib/ingest/sample-docs'

const ACCEPT = '.csv,.tsv,.xls,.xlsx,.pdf,.txt,.html,.htm,.md'

export function DocumentsPanel({
  caseId,
  projectId,
  readOnly,
  onClose,
}: {
  caseId: number
  /** For "Import into this case": the importer lives under the project. */
  projectId: number
  /** A person who can only read this case reads the documents but cannot add or delete one. */
  readOnly: boolean
  onClose: () => void
}) {
  const d = useCaseDocuments(caseId)
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [asked, setAsked] = useState<CaseDocumentRow | null>(null)

  // Opening the panel moves focus into it, so a keyboard user lands on what opened.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <>
      <aside id="ws-docs" className="ws-docs" aria-labelledby={titleId}>
        <div className="ws-docs-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className="ws-docs-title">
              Documents
            </h2>
            <div className="ws-docs-sub">
              Read your amounts off the files this case was built from. Adding a file here keeps it for reading; to put its lines in the
              case, use Import into this case.
            </div>
          </div>
          <IconButton label="Close documents" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>

        {d.open ? (
          <Reader d={d} />
        ) : (
          <div className="ws-docs-body">
            <section aria-labelledby={`${titleId}-case`} className="ws-docs-section">
              <h3 id={`${titleId}-case`} className="ds-section-label" style={{ margin: 0 }}>
                This case
              </h3>
              {d.loadError ? (
                <ErrorCard title="The documents did not load" cause={d.loadError} onRetry={d.reload} retrying={d.loading} />
              ) : d.docs === null ? (
                <p className="ws-docs-note" role="status">
                  Loading the documents…
                </p>
              ) : d.docs.length === 0 ? (
                <p className="ws-docs-note">
                  {readOnly
                    ? 'No document is kept for this case yet. Open a sample below to see what a real one looks like.'
                    : 'No document is kept for this case yet. Add the one you are reading from, or open a sample below to see what a real one looks like.'}
                </p>
              ) : (
                <ul className="ws-docs-list">
                  {d.docs.map((row) => (
                    <li key={row.document_id} className="ws-docs-row">
                      <button
                        type="button"
                        className="ws-docs-open"
                        aria-label={`Open ${row.filename}, ${docTypeLabel(row.doc_type)}`}
                        onClick={() => void d.openCaseDoc(row)}
                      >
                        <span className="ws-docs-name">{row.filename}</span>
                        <span className="ws-docs-type">{docTypeLabel(row.doc_type)}</span>
                      </button>
                      {!readOnly && importableKind(row.doc_type) && (
                        // A routing, BOM or equipment list read in the panel can also go into the case: the importer opens with it loaded.
                        <Link
                          className="ds-btn ds-btn--small"
                          aria-label={`Import ${row.filename} into this case`}
                          href={`/project/${projectId}/import?case=${caseId}&doc=${row.document_id}&kind=${importableKind(row.doc_type)}`}
                        >
                          Import into this case
                        </Link>
                      )}
                      {!readOnly && (
                        <Button size="small" variant="danger-quiet" aria-label={`Delete ${row.filename}`} onClick={() => setAsked(row)}>
                          Delete
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {d.removeError && <ErrorCard title="The document was not deleted" cause={d.removeError} />}
            </section>

            {!readOnly && <AddForm d={d} titleId={titleId} />}

            <section aria-labelledby={`${titleId}-samples`} className="ws-docs-section">
              <h3 id={`${titleId}-samples`} className="ds-section-label" style={{ margin: 0 }}>
                Sample documents
              </h3>
              <ul className="ws-docs-list">
                {Object.entries(SAMPLE_DOCS).map(([key, doc]) => (
                  <li key={key} className="ws-docs-row">
                    <button
                      type="button"
                      className="ws-docs-open"
                      aria-label={`Open the sample ${doc.filename}`}
                      onClick={() => d.openSample(key, doc)}
                    >
                      <span className="ws-docs-name">{doc.filename}</span>
                      <span className="ws-docs-type">{SAMPLE_LABELS[key] ?? 'Sample document'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </aside>

      {/* Outside the panel: the panel is sticky, so it is its own stacking layer and would hold the dialog under the tree. */}
      <ConfirmDialog
        open={!!asked}
        title="Delete this document?"
        consequence={asked ? `${asked.filename} is taken off this case. The steps and flows you built from it stay as they are.` : ''}
        confirmLabel="Delete document"
        busy={d.removing}
        onCancel={() => setAsked(null)}
        onConfirm={async () => {
          if (!asked) return
          const gone = await d.remove(asked)
          setAsked(null)
          // The Delete button that opened the confirm has left with its row: focus goes to the panel's heading.
          if (gone) requestAnimationFrame(() => headingRef.current?.focus())
        }}
      />
    </>
  )
}

type Docs = ReturnType<typeof useCaseDocuments>

/** Add a document: what kind it is, the file, then Add document. */
function AddForm({ d, titleId }: { d: Docs; titleId: string }) {
  const typeId = useId()
  const fileId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const send = async () => {
    if (!file) return
    if (await d.attach(file)) {
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section aria-labelledby={`${titleId}-add`} className="ws-docs-section">
      <h3 id={`${titleId}-add`} className="ds-section-label" style={{ margin: 0 }}>
        Add a document
      </h3>
      <div>
        <label htmlFor={typeId} className="ds-label">
          Document type
        </label>
        <select id={typeId} className="ds-input" style={{ width: '100%' }} value={d.docType} onChange={(e) => d.setDocType(e.target.value)}>
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={fileId} className="ds-label">
          File to add
        </label>
        <input
          id={fileId}
          ref={fileRef}
          type="file"
          className="ws-docs-file"
          accept={ACCEPT}
          disabled={d.uploading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="ws-docs-note" style={{ marginTop: 6 }}>
          A spreadsheet, PDF or text file. Its text is kept for reading; a scanned image has no text to keep.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button size="small" variant="primary" onClick={() => void send()} busy={d.uploading} disabled={!file}>
          Add document
        </Button>
        {d.added && (
          <SavedLine>
            {d.added.truncated ? `Added ${d.added.filename}. It is long, so the first part was kept.` : `Added ${d.added.filename}`}
          </SavedLine>
        )}
      </div>
      {d.uploadError && <ErrorCard title="The document was not added" cause={d.uploadError} />}
    </section>
  )
}

/** One document open for reading: its lines, numbered, and a search that keeps only the lines that match. */
function Reader({ d }: { d: Docs }) {
  const open = d.open!
  const summary = hitSummary(d.needle, d.lines.length)
  const retry = () => {
    if (open.documentId != null) void d.openCaseDoc({ document_id: open.documentId, filename: open.filename, doc_type: open.docType })
  }
  return (
    <div className="ws-docs-reader">
      <div className="ws-docs-readhead">
        <Button
          size="small"
          onClick={d.close}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          All documents
        </Button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ws-docs-name" title={open.filename}>
            {open.filename}
          </div>
          <div className="ws-docs-type">{open.source === 'sample' ? 'Sample document' : docTypeLabel(open.docType)}</div>
        </div>
      </div>
      {d.openError ? (
        <div style={{ padding: 16 }}>
          <ErrorCard title="The document did not open" cause={d.openError} onRetry={open.source === 'case' ? retry : undefined} />
        </div>
      ) : open.content === null ? (
        <p className="ws-docs-note" role="status" style={{ padding: 16 }}>
          Opening the document…
        </p>
      ) : (
        <>
          <div className="ws-docs-search">
            <SearchField
              value={d.needle}
              onChange={d.setNeedle}
              label="Search this document"
              placeholder="Find a line: a part number, a step, a material"
            />
            <p className="ws-docs-note" role="status" aria-live="polite" style={{ marginTop: 6, minHeight: 18 }}>
              {summary ?? ''}
            </p>
          </div>
          <div className="ws-docs-text" role="region" aria-label={`Text of ${open.filename}`} tabIndex={0}>
            {d.lines.map((l) => (
              <div key={l.n} className="ws-docs-line" data-hit={l.hit || undefined}>
                <span className="ws-docs-ln">{l.n}</span>
                <span className="ws-docs-lt">
                  {l.text
                    ? highlightParts(l.text, d.needle).map((p, i) =>
                        p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
                      )
                    : ' '}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
