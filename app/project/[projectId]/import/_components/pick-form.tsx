'use client'

// Add a file (F2.2): what kind of file it is (chips; an equipment list is
// locked until there is a case with steps; ITAC adds its Assessment ID; the
// planned kinds are one Coming soon line), where it goes, the drop zone with
// its size and type limits, a blank template, the chosen
// file's line, how many reads are left this hour, and Check what we read.

import { useRef, useState } from 'react'
import type { DocType } from '@/lib/ingest/doc-types'
import { DOC_TYPES, LIVE_DOC_TYPES } from '@/lib/ingest/doc-types'
import type { PlaceableStep } from '@/lib/ingest/placement'
import { TEMPLATE_HEADERS } from '@/lib/import/templates'
import type { ProjectCase } from '@/lib/import/apply-body'
import { TIER_LABEL } from '@/lib/import/display'
import { acceptsFile, fileSizeText } from '@/lib/import/file-rules'
import { uploadLimitMb, uploadTooLargeMessage } from '@/lib/upload-limits'
import { Button, ComingSoon } from '@/components/lcapix/ds'

export interface PickFormProps {
  connector: string
  onConnectorChange: (connector: string) => void
  doc: DocType | undefined
  isLLM: boolean
  projectCases: ProjectCase[]
  targetCaseId: number | null
  onTargetCaseChange: (caseId: number | null) => void
  attachComponentId: number | null
  onAttachComponentChange: (componentId: number | null) => void
  placeSteps: PlaceableStep[]
  file: File | null
  onFileChange: (file: File | null) => void
  plantId: string
  onPlantIdChange: (plantId: string) => void
  lotSize: string
  onLotSizeChange: (lotSize: string) => void
  previewing: boolean
  onPreview: () => void
  onDownloadTemplate: (conn: string) => void
  readsLeft?: { limit: number; remaining: number } | null
  onBack?: () => void
}

/** The chip words (F2.2); the registry keeps the long names for everything else. */
const CHIP: Record<string, string> = {
  bom: 'Bill of materials',
  routing: 'Routing',
  equipment: 'Equipment list',
  epd: 'EPD',
  sds: 'Safety data sheet',
  itac: 'ITAC assessment',
}
const ORDER = ['bom', 'routing', 'equipment', 'epd', 'sds', 'itac']

/** One plain line per kind (F2.2): what it gives the case, and how it is read. */
const EXPLAIN: Record<string, string> = {
  routing: 'A routing gives the steps in order and their hours. A PDF routing is read by AI, so you check every step.',
  bom: 'A bill of materials gives every material and part with its amount. You place each line on the step that uses it.',
  equipment: "An equipment list gives each machine's power. With the hours, it gives each step's electricity.",
  epd: "An EPD gives a supplier's own climate factor for a material it sells. It is read by AI, so you check it.",
  sds: 'A safety data sheet gives what a chemical or coating is made of. It is read by AI, so you check it.',
  itac: "A DOE ITAC assessment gives a plant's energy and utility use, read from its workbook.",
}

export function PickForm(p: PickFormProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  // An equipment list sizes the machines of existing steps: it needs a case with steps.
  const equipmentLocked = p.targetCaseId === null || p.placeSteps.length === 0
  const kinds = [...LIVE_DOC_TYPES].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  const planned = DOC_TYPES.filter((d) => d.status === 'planned')
  const isPdf = !!p.file && /\.pdf$/i.test(p.file.name)

  const take = (f: File | null) => {
    setFileError(null)
    if (!f) return p.onFileChange(null)
    if (!acceptsFile(f.name, p.doc?.accept)) {
      setFileError(`${f.name} is not a file this kind of document can be read from. Use ${p.doc?.accept.split(',').join(', ')}.`)
      return
    }
    const tooLarge = uploadTooLargeMessage(f)
    if (tooLarge) {
      setFileError(tooLarge)
      return
    }
    p.onFileChange(f)
  }

  const reason = !p.file ? 'Choose a file first' : p.connector === 'itac' && !p.plantId.trim() ? 'Enter the Assessment ID' : undefined

  return (
    <div className="np-card" style={{ maxWidth: 820 }}>
      <section className="np-section">
        <span className="edu-field-label" id="kind-label">
          What kind of file is it?
        </span>
        <div className="ip-chips" role="radiogroup" aria-labelledby="kind-label">
          {kinds.map((d) => {
            const locked = d.id === 'equipment' && equipmentLocked
            const on = p.connector === d.id
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-disabled={locked || undefined}
                className="ip-chip"
                data-on={on || undefined}
                data-locked={locked || undefined}
                onClick={() => !locked && p.onConnectorChange(d.id)}
              >
                {on && <span aria-hidden>✓</span>}
                {locked && <LockIcon />}
                {CHIP[d.id] ?? d.label}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 15 }}>{EXPLAIN[p.connector] ?? p.doc?.provides}</p>
        {equipmentLocked && (
          <p className="ip-note">
            <LockIcon /> Equipment list · Needs a case with steps first
          </p>
        )}
        {p.connector !== 'itac' && (
          <p className="ip-note">
            <InfoIcon /> ITAC assessment · Picking it adds an Assessment ID field
          </p>
        )}
        {planned.length > 0 && <ComingSoon>Utility bills, permits, transport records, cost sheets</ComingSoon>}
      </section>

      {p.projectCases.length > 0 && (
        <section className="np-section">
          <div className="np-grid" style={{ marginTop: 0 }}>
            <label className="np-field">
              <span className="edu-field-label">Into</span>
              <select className="edu-input" value={p.targetCaseId ?? ''} onChange={(e) => p.onTargetCaseChange(e.target.value ? Number(e.target.value) : null)}>
                <option value="">A new case</option>
                {p.projectCases.map((c) => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_name}
                  </option>
                ))}
              </select>
            </label>
            {p.targetCaseId !== null && (
              <label className="np-field">
                <span className="edu-field-label">Default step (optional)</span>
                <select className="edu-input" value={p.attachComponentId ?? ''} onChange={(e) => p.onAttachComponentChange(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">None: place each line when you check</option>
                  {p.placeSteps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({TIER_LABEL[s.tier] ?? s.tier})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>
      )}

      <section className="np-section">
        <label
          className="ip-drop"
          data-over={dragOver || undefined}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            take(e.dataTransfer.files?.[0] ?? null)
          }}
        >
          <input
            ref={input}
            type="file"
            className="ds-sr-only"
            accept={p.doc?.accept ?? '.xlsx'}
            aria-describedby="drop-limits"
            onChange={(e) => {
              take(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M12 16V4m-5 5 5-5 5 5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            Drop a file here, or <span style={{ color: 'var(--ds-green)' }}>choose one</span>
          </span>
          <span id="drop-limits" style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
            {limitsLine(p.doc)} · up to {uploadLimitMb()} MB · no scanned PDFs or Word files
          </span>
        </label>
        {fileError && (
          <span className="edu-error" role="alert">
            {fileError}
          </span>
        )}
        {TEMPLATE_HEADERS[p.connector] && (
          <span style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={() => p.onDownloadTemplate(p.connector)}>
              Download a blank template
            </button>
          </span>
        )}
      </section>

      {(p.connector === 'itac' || p.file) && (
        <section className="np-section">
          {p.file && (
            <div className="ip-file">
              <span className="ip-file-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" />
                  <path d="M9 12h6M9 16h6" strokeLinecap="round" />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 17, overflowWrap: 'anywhere' }}>{p.file.name}</strong>{' '}
                <span className="ds-mono" style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
                  · {fileSizeText(p.file.size)}
                </span>
                <span style={{ display: 'block', fontSize: 15, color: 'var(--ds-text-2)' }}>
                  Not read yet.{' '}
                  {isPdf && p.isLLM ? 'A PDF goes to the AI reader when you press Check what we read.' : 'It is read when you press Check what we read.'}
                </span>
              </span>
              <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={() => input.current?.click()}>
                Choose another
              </button>
            </div>
          )}
          {p.connector === 'itac' && (
            <label className="np-field" style={{ maxWidth: 320 }}>
              <span className="edu-field-label">Assessment ID</span>
              <input className="edu-input" value={p.plantId} placeholder="e.g. WV0661" onChange={(e) => p.onPlantIdChange(e.target.value)} />
            </label>
          )}
          {p.connector !== 'itac' && (
            <details>
              <summary className="ds-link" style={{ cursor: 'pointer', fontSize: 14 }}>
                More details (optional)
              </summary>
              <div className="np-grid">
                <label className="np-field">
                  <span className="edu-field-label">Product name</span>
                  <input className="edu-input" value={p.plantId} placeholder="e.g. Aluminium enclosure" onChange={(e) => p.onPlantIdChange(e.target.value)} />
                </label>
                {p.connector === 'routing' && (
                  <label className="np-field">
                    <span className="edu-field-label">Units per setup (lot size)</span>
                    <input className="edu-input ds-mono" type="number" min={1} value={p.lotSize} placeholder="e.g. 25" onChange={(e) => p.onLotSizeChange(e.target.value)} />
                    <span className="edu-hint">Setup time is spread over the lot. Leave it empty to keep setup out of the time per unit.</span>
                  </label>
                )}
              </div>
            </details>
          )}
        </section>
      )}

      <footer className="np-foot">
        <span style={{ flex: 1, minWidth: 220, fontSize: 15, color: 'var(--ds-text-2)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {p.readsLeft && (
            <>
              <ClockIcon />
              {p.readsLeft.remaining <= 0
                ? `No reads left this hour (${p.readsLeft.limit} an hour)`
                : p.readsLeft.remaining >= p.readsLeft.limit
                  ? `Uses 1 of your ${p.readsLeft.limit} reads this hour`
                  : `Uses 1 of the ${p.readsLeft.remaining} reads you have left this hour`}
            </>
          )}
        </span>
        {p.onBack && <Button onClick={p.onBack}>Back</Button>}
        <Button variant="primary" onClick={p.onPreview} busy={p.previewing} disabled={!!reason} disabledReason={reason}>
          Check what we read →
        </Button>
      </footer>
    </div>
  )
}

/** "XLSX, CSV, TXT or a text PDF" from the kind's accept list. */
function limitsLine(doc: DocType | undefined): string {
  const exts = (doc?.accept ?? '.xlsx').split(',').map((e) => e.trim().replace('.', '').toUpperCase())
  const words = exts.map((e) => (e === 'PDF' ? 'a text PDF' : e))
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : words[0]
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.5" strokeLinecap="round" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  )
}
