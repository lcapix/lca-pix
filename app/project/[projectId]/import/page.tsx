'use client'

// /project/[projectId]/import — document ingestion with a review gate.
//
// Upload a real document (DOE ITAC workbook for now) → the server returns an
// ingestion PLAN (tree, flows with match scores + named unit conversions,
// costs, needs-review list, provenance on every fact) → the user confirms or
// edits → apply creates the case atomically. The review screen is the trust
// mechanism: accuracy comes from the document, trust comes from showing the
// mapping before anything is written.

import * as React from 'react'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AuthGuard } from '@/components/auth-guard'
import { Icon } from '@/components/lcapix'
import type { IngestPlan, MappedFlow, SubstanceCandidate } from '@/lib/ingest/maplca'

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {}
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (t) h.Authorization = 'Bearer ' + t
  return h
}

const TIER_LABEL: Record<string, string> = {
  product: 'PRODUCT',
  machine_line: 'MACHINE/LINE',
  subprocess: 'SUBPROCESS',
  operation: 'OPERATION',
  elemental_task: 'ELEMENTAL TASK',
}

interface FlowEdit {
  include: boolean
  substance_id: number | null
  substance_name: string | null
}

export default function ImportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [plantId, setPlantId] = useState('')
  const [phase, setPhase] = useState<'pick' | 'previewing' | 'review' | 'applying' | 'done'>('pick')
  const [plan, setPlan] = useState<IngestPlan | null>(null)
  const [caseName, setCaseName] = useState('')
  const [edits, setEdits] = useState<Record<number, FlowEdit>>({})
  const [error, setError] = useState<string | null>(null)
  const [idHints, setIdHints] = useState<string[]>([])
  const [applied, setApplied] = useState<any>(null)

  const preview = async () => {
    if (!file || !plantId.trim()) {
      setError('Choose a file and enter an assessment ID (e.g. WV0661).')
      return
    }
    setPhase('previewing')
    setError(null)
    setIdHints([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('connector', 'itac')
      fd.append('plant_id', plantId.trim())
      const r = await fetch('/api/ingest/preview', {
        method: 'POST',
        headers: authHeaders(false), // browser sets the multipart boundary
        body: fd,
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d?.error || 'Preview failed')
        if (Array.isArray(d?.matching_ids)) setIdHints(d.matching_ids)
        setPhase('pick')
        return
      }
      const p: IngestPlan = d.plan
      setPlan(p)
      setCaseName(p.case_name)
      const init: Record<number, FlowEdit> = {}
      p.flows.forEach((f, i) => {
        init[i] = {
          include: f.substance_id !== null,
          substance_id: f.substance_id,
          substance_name: f.substance_name,
        }
      })
      setEdits(init)
      setPhase('review')
    } catch (e: any) {
      setError(e?.message || 'Preview failed')
      setPhase('pick')
    }
  }

  const apply = async () => {
    if (!plan) return
    setPhase('applying')
    setError(null)
    try {
      const flows = plan.flows
        .map((f, i) => ({ f, e: edits[i] }))
        .filter(({ e }) => e?.include && e.substance_id !== null)
        .map(({ f, e }) => ({
          ...f,
          substance_id: e.substance_id,
          substance_name: e.substance_name,
        }))
      const r = await fetch('/api/ingest/apply', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          project_id: Number(projectId),
          case_name: caseName.trim() || plan.case_name,
          nodes: plan.nodes,
          flows,
          costs: plan.costs,
          notes: plan.notes,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d?.error || 'Apply failed')
        setPhase('review')
        return
      }
      setApplied(d)
      setPhase('done')
      toast.success(`Case created: ${d.case_name}`)
    } catch (e: any) {
      setError(e?.message || 'Apply failed')
      setPhase('review')
    }
  }

  const scoreColor = (s: number) =>
    s >= 0.9 ? 'var(--signal-success, #16a34a)' : s >= 0.55 ? 'var(--signal-warn, #d97706)' : 'var(--signal-error, #dc2626)'

  return (
    <AuthGuard>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
        <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>
          DATA INGESTION
        </div>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: '0 0 6px' }}>
          Import a document
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.55 }}>
          Upload a real document and review the extracted process model before anything is created.
          Every value keeps a pointer to where in the document it came from; nothing uncertain is
          applied silently.
        </p>

        {error && (
          <div
            className="card"
            style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--signal-error, #dc2626)', fontSize: 13 }}
          >
            {error}
            {idHints.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                Matching IDs in this workbook: {idHints.join(', ')}
              </div>
            )}
          </div>
        )}

        {(phase === 'pick' || phase === 'previewing') && (
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                CONNECTOR
              </label>
              <select className="input" value="itac" disabled style={{ maxWidth: 420 }}>
                <option value="itac">DOE ITAC assessment workbook (.xlsx) — deterministic</option>
              </select>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                More connectors (utility bills, BOM, routing sheets, SDS) follow the same
                upload → review → apply path.
              </div>
            </div>
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                DOCUMENT
              </label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13 }}
              />
            </div>
            <div>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                ASSESSMENT ID
              </label>
              <input
                className="input"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                placeholder="WV0661"
                style={{ maxWidth: 220 }}
              />
            </div>
            <div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={phase === 'previewing'}
                onClick={preview}
              >
                {phase === 'previewing' ? 'Reading document…' : 'Preview extraction'}
              </button>
            </div>
          </div>
        )}

        {plan && (phase === 'review' || phase === 'applying') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
                CASE NAME
              </label>
              <input
                className="input"
                value={caseName}
                onChange={(e) => setCaseName(e.target.value)}
                style={{ maxWidth: 560 }}
              />
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                HIERARCHY · {plan.nodes.length} NODES
              </div>
              {plan.nodes.map((n) => {
                const depth =
                  n.tier === 'product' ? 0 : n.tier === 'machine_line' ? 1 : n.tier === 'subprocess' ? 2 : n.tier === 'operation' ? 3 : 4
                return (
                  <div
                    key={n.name}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', marginLeft: depth * 22, fontSize: 12.5 }}
                  >
                    <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>
                      {TIER_LABEL[n.tier]}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{n.name}</span>
                    {n.quantity != null && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {Number(n.quantity).toLocaleString()} {n.unit}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                FLOWS · {plan.flows.length} EXTRACTED
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10.5 }}>
                      <th style={{ padding: '6px 8px' }}>APPLY</th>
                      <th style={{ padding: '6px 8px' }}>DOCUMENT SAYS</th>
                      <th style={{ padding: '6px 8px' }}>DIR</th>
                      <th style={{ padding: '6px 8px' }}>QUANTITY (CONVERTED)</th>
                      <th style={{ padding: '6px 8px' }}>MAPS TO SUBSTANCE</th>
                      <th style={{ padding: '6px 8px' }}>MATCH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.flows.map((f: MappedFlow, i: number) => {
                      const e = edits[i]
                      if (!e) return null
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="checkbox"
                              checked={e.include}
                              disabled={e.substance_id === null}
                              onChange={(ev) =>
                                setEdits({ ...edits, [i]: { ...e, include: ev.target.checked } })
                              }
                              aria-label={`Apply flow ${f.substance_text}`}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div>{f.substance_text}</div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {f.provenance}
                            </div>
                          </td>
                          <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: 10.5 }}>{f.direction}</td>
                          <td style={{ padding: '8px' }}>
                            <span className="mono">
                              {Number(f.quantity).toLocaleString()} {f.unit}
                            </span>
                            {f.conversion_note && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {f.conversion_note}
                              </div>
                            )}
                            {f.unit_compatible === false && (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: 'var(--signal-error, #dc2626)',
                                  fontWeight: 600,
                                  marginTop: 2,
                                }}
                              >
                                ⚠ unit won't convert to this substance — will be held
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select
                              className="input"
                              style={{ fontSize: 12, padding: '4px 8px', minWidth: 200 }}
                              value={e.substance_id ?? ''}
                              onChange={(ev) => {
                                const sid = ev.target.value ? Number(ev.target.value) : null
                                const cand = f.candidates.find((c: SubstanceCandidate) => c.substance_id === sid)
                                setEdits({
                                  ...edits,
                                  [i]: {
                                    include: sid !== null,
                                    substance_id: sid,
                                    substance_name: cand?.substance_name ?? null,
                                  },
                                })
                              }}
                            >
                              <option value="">— hold for review (not applied) —</option>
                              {f.candidates.map((c: SubstanceCandidate) => (
                                <option key={c.substance_id} value={c.substance_id}>
                                  {c.substance_name} · match {(c.score * 100).toFixed(0)}%
                                  {c.factor_count === 0 ? ' · NO IMPACT DATA' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span
                              className="mono"
                              style={{ fontSize: 11, fontWeight: 600, color: scoreColor(f.match_score) }}
                            >
                              {(f.match_score * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {plan.costs.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                  COSTS · {plan.costs.length} LINES
                </div>
                {plan.costs.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', fontSize: 12.5, alignItems: 'baseline' }}>
                    <span className="mono" style={{ minWidth: 110 }}>
                      ${Number(c.amount).toLocaleString()}
                    </span>
                    <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>{c.category}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.node}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.basis})</span>
                  </div>
                ))}
              </div>
            )}

            {plan.review.length > 0 && (
              <div
                className="card"
                style={{ padding: 20, borderLeft: '3px solid var(--signal-warn, #d97706)' }}
              >
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
                  NEEDS HUMAN REVIEW · {plan.review.length}
                </div>
                {plan.review.map((r, i) => (
                  <div key={i} style={{ fontSize: 12.5, padding: '3px 0', color: 'var(--text-secondary)' }}>
                    ! {r}
                  </div>
                ))}
              </div>
            )}

            {plan.notes.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {plan.notes.map((n, i) => (
                  <div key={i}>NOTE: {n}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-primary" disabled={phase === 'applying'} onClick={apply}>
                {phase === 'applying' ? 'Creating case…' : 'Apply — create this case'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPlan(null)
                  setPhase('pick')
                }}
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && applied && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="check" size={16} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Case created from document</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {applied.components_created} components · {applied.flows_applied} flows applied ·{' '}
              {applied.flows_held_for_review} held for review · {applied.cost_nodes} cost nodes
            </div>
            {Array.isArray(applied.held_details) && applied.held_details.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {applied.held_details.map((h: string, i: number) => (
                  <div key={i}>held: {h}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push(`/project/${projectId}/case/${applied.case_id}`)}
              >
                Open case
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPlan(null)
                  setApplied(null)
                  setPhase('pick')
                }}
              >
                Import another
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
