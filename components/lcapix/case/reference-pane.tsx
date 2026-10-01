'use client'

/**
 * The document a person reads values off while they model.
 *
 * Building a case by hand means copying quantities from somewhere: a routing,
 * a bill of materials, an equipment list, an EPD. Until now the app read those
 * files once at import and dropped them, so the one thing a student needs open
 * while typing was the one thing the app could not show. This pane holds the
 * case's own documents, plus the bundled samples, and searches inside them.
 */

import { SAMPLE_DOCS, SAMPLE_LABELS } from '@/lib/ingest/sample-docs'
import { useCaseDocuments } from '@/lib/case-editor/use-case-documents'

const DOC_TYPES = [
  { value: 'routing', label: 'Routing' },
  { value: 'bom', label: 'Bill of materials' },
  { value: 'equipment', label: 'Equipment list' },
  { value: 'epd', label: 'EPD / datasheet' },
  { value: 'sds', label: 'Safety data sheet' },
  { value: 'itac', label: 'ITAC report' },
  { value: 'other', label: 'Other' },
]

export function ReferencePane({
  caseId,
  onClose,
}: {
  caseId: string | number
  onClose: () => void
}) {
  const {
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
  } = useCaseDocuments(caseId)

  return (
    <aside
      style={{
        width: 420,
        maxWidth: '92vw',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border-subtle)',
        background: 'var(--surface-raised)',
        height: '100%',
      }}
      aria-label="Reference documents"
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }}>Reference</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            Read your quantities off the document
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} title="Close the reference pane">
          Close
        </button>
      </header>

      {!open && (
        <div style={{ overflowY: 'auto', padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            This case
          </div>
          {loading && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Loading…</div>}
          {!loading && docs.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
              No document kept for this case yet. Attach the one you are typing from, or open a sample
              below to see the shape of a real one.
            </div>
          )}
          {docs.map((d) => (
            <div
              key={d.document_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                marginBottom: 6,
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-base)',
              }}
            >
              <button
                type="button"
                onClick={() => openCaseDoc(d)}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                }}
                title="Open this document"
              >
                {d.filename}
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  {d.doc_type ?? 'document'}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => remove(d)}
                title="Remove this document from the case"
              >
                Remove
              </button>
            </div>
          ))}

          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              Attach a document to read from
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{
                  fontSize: 12.5,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-base)',
                  color: 'var(--text-primary)',
                }}
                title="What kind of document this is"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.xls,.xlsx,.pdf,.txt,.html,.htm,.md"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) attach(f)
                }}
                style={{ fontSize: 12 }}
                disabled={uploading}
              />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {uploading ? 'Reading the file…' : 'Text is kept for reading. Scanned images are not read.'}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              Sample documents
            </div>
            {Object.entries(SAMPLE_DOCS).map(([key, doc]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setOpen({ key: `sample-${key}`, filename: doc.filename, content: doc.content, source: 'sample' })
                }
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  marginBottom: 6,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-base)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                }}
                title={SAMPLE_LABELS[key] ?? doc.filename}
              >
                {doc.filename}
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  {SAMPLE_LABELS[key] ?? 'Sample document'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(null); setNeedle('') }}>
              ← Back
            </button>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={open.filename}
            >
              {open.filename}
            </div>
          </div>

          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder="Find a line: a part number, a step, a material"
              style={{
                width: '100%',
                fontSize: 12.5,
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-base)',
                color: 'var(--text-primary)',
              }}
              aria-label="Search this document"
            />
            {needle.trim() && (
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 5 }}>
                {hitCount === 0 ? 'No line matches' : `${hitCount} line${hitCount === 1 ? '' : 's'}`}
              </div>
            )}
          </div>

          <div style={{ overflow: 'auto', flex: 1, padding: '10px 0' }}>
            {lines.map((l) => (
              <div
                key={l.n}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '2px 14px',
                  background: l.hit ? 'var(--surface-accent, rgba(29,120,72,0.08))' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    minWidth: 32,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {l.n}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {l.text || ' '}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

export default ReferencePane
