'use client'

import { getDocType } from '@/lib/ingest/doc-types'
import type { SampleView } from '@/lib/import/use-sample-docs'

/** The sample document itself in a panel: load it, download it, or copy it. Clicking outside closes it. */
export function SampleDialog({
  sampleView,
  onClose,
  onLoad,
  onDownload,
  onCopy,
}: {
  sampleView: SampleView
  onClose: () => void
  onLoad: (conn: string) => void
  onDownload: (conn: string) => void
  onCopy: (content: string) => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Sample document ${sampleView.filename}`}
      onClick={() => onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(900px, 100%)', maxHeight: '82vh', padding: '18px 20px', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{sampleView.filename}</span>
          <span className="chip" style={{ fontSize: 10 }}>
            {getDocType(sampleView.conn)?.label ?? sampleView.conn}
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onClose()}>
            Close
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.5 }}>
          {getDocType(sampleView.conn)?.provides ?? 'This is the document the importer reads.'}
        </div>
        <pre
          className="mono"
          style={{
            flex: 1,
            overflow: 'auto',
            margin: 0,
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
            fontSize: 11.5,
            lineHeight: 1.55,
            whiteSpace: 'pre',
          }}
        >
          {sampleView.content}
        </pre>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              onLoad(sampleView.conn)
              onClose()
            }}
          >
            Load this sample
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDownload(sampleView.conn)}>
            Download it
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onCopy(sampleView.content)}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
