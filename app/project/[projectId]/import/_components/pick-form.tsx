'use client'

import type { DocType } from '@/lib/ingest/doc-types'
import { LIVE_DOC_TYPES } from '@/lib/ingest/doc-types'
import type { PlaceableStep } from '@/lib/ingest/placement'
import { SAMPLE_DOCS } from '@/lib/ingest/sample-docs'
import type { ProjectCase } from '@/lib/import/apply-body'
import { TIER_LABEL } from '@/lib/import/display'
import { akaHint } from '@/lib/import/preview'

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
  onLoadSample: (conn: string) => void
  onViewSample: (conn: string) => void
  onDownloadTemplate: (conn: string) => void
}

/** The pick step: document type, where it goes, the file (or a sample), the ID / product name, lot size, preview. */
export function PickForm({
  connector,
  onConnectorChange,
  doc,
  isLLM,
  projectCases,
  targetCaseId,
  onTargetCaseChange,
  attachComponentId,
  onAttachComponentChange,
  placeSteps,
  file,
  onFileChange,
  plantId,
  onPlantIdChange,
  lotSize,
  onLotSizeChange,
  previewing,
  onPreview,
  onLoadSample,
  onViewSample,
  onDownloadTemplate,
}: PickFormProps) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
          DOCUMENT TYPE
        </label>
        <select
          className="input"
          value={connector}
          onChange={(e) => onConnectorChange(e.target.value)}
          style={{ maxWidth: 460 }}
        >
          {LIVE_DOC_TYPES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({d.mode === 'structured' ? 'deterministic' : 'AI-structured'})
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {doc?.provides}
          {akaHint(doc)}
          {isLLM && ' Uses an open model via Hugging Face (needs HF_TOKEN); still human-reviewed before apply.'}
        </div>
      </div>

      {/* Guided assembly: create a new case, or add this document to an
          existing one so a single case is built from several documents. */}
      <div>
        <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
          ADD TO
        </label>
        <select
          className="input"
          value={targetCaseId ?? ''}
          onChange={(e) => onTargetCaseChange(e.target.value ? Number(e.target.value) : null)}
          style={{ maxWidth: 460 }}
        >
          <option value="">Create a new case</option>
          {projectCases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              Add to: {c.case_name}
            </option>
          ))}
        </select>
        {targetCaseId !== null && (
          <div style={{ marginTop: 8 }}>
            <label
              className="label"
              style={{ display: 'block', fontSize: 11, marginBottom: 6 }}
              title="Each line is placed on its own step on the review screen, with a suggested step and the reason. A default step here is only used for lines you leave unplaced."
            >
              DEFAULT STEP (OPTIONAL)
            </label>
            <select
              className="input"
              value={attachComponentId ?? ''}
              onChange={(e) =>
                onAttachComponentChange(e.target.value ? Number(e.target.value) : null)
              }
              style={{ maxWidth: 460 }}
            >
              <option value="">— none: place each line on the review screen —</option>
              {placeSteps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({TIER_LABEL[s.tier] ?? s.tier})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
          DOCUMENT
        </label>
        <input
          type="file"
          accept={doc?.accept ?? '.xlsx'}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13 }}
        />
        {file && (
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            Selected: <strong>{file.name}</strong>
          </div>
        )}
        {SAMPLE_DOCS[connector] && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              No document of your own?
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onLoadSample(connector)}
            >
              Load a sample
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onViewSample(connector)}
              title="Read the sample document itself, so you can see what is being ingested"
            >
              View sample
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDownloadTemplate(connector)}
              title="Download a blank CSV with the columns we expect"
            >
              Download blank template
            </button>
          </div>
        )}
      </div>
      <div>
        <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
          {connector === 'itac' ? 'ASSESSMENT ID' : 'PRODUCT NAME (OPTIONAL)'}
        </label>
        <input
          className="input"
          value={plantId}
          onChange={(e) => onPlantIdChange(e.target.value)}
          placeholder={connector === 'itac' ? 'WV0661' : 'e.g. product name'}
          style={{ maxWidth: 280 }}
        />
      </div>
      {connector === 'routing' && (
        <div>
          <label
            className="label"
            style={{ display: 'block', fontSize: 11, marginBottom: 6 }}
            title="How many units are made per setup. Setup time is per lot, so it is spread over the lot (setup ÷ lot size). Leave blank to keep setup out of the per-unit labor."
          >
            LOT SIZE (OPTIONAL)
          </label>
          <input
            className="input mono"
            type="number"
            min={1}
            value={lotSize}
            onChange={(e) => onLotSizeChange(e.target.value)}
            placeholder="units per setup, e.g. 25"
            style={{ maxWidth: 220 }}
          />
        </div>
      )}
      <div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={previewing}
          onClick={onPreview}
        >
          {previewing ? 'Reading document…' : 'Preview extraction'}
        </button>
      </div>
    </div>
  )
}
