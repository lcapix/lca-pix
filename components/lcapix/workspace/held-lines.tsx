'use client'

// Lines held from a file (E12 "3 lines held · Fix", Continue "give the held
// lines a value"): what the file said, why it was held (no confirmed match,
// no step, a unit that can't convert), and two ways out. Put it on a step:
// the server makes it a flow (or a cost) exactly as a new one is checked. Or
// dismiss it: it leaves the inventory, and its record stays.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { announceComponentsChanged, useSubstanceCatalog } from '@/lib/case-editor/use-flows'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'

interface HeldLine {
  held_id: number
  line_kind: 'flow' | 'cost'
  reason: string
  reason_text: string
  step_name: string | null
  substance_text: string | null
  substance_id: number | null
  substance_name: string | null
  direction: string | null
  quantity: number | null
  unit: string | null
  cost_category: string | null
  amount: number | null
  provenance: string | null
}

export function HeldLines({ caseId, steps, readOnly }: { caseId: number; steps: WorkspaceStep[]; readOnly: boolean }) {
  const [lines, setLines] = useState<HeldLine[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  // The library list, loaded once for every row's substance picker.
  const { substances } = useSubstanceCatalog()
  const load = useCallback(async () => {
    const r = await apiRequest(`/api/cases/${caseId}/held-lines`)
    const d = r.ok ? await r.json().catch(() => null) : null
    setLines((d?.lines ?? []) as HeldLine[])
  }, [caseId])
  useEffect(() => {
    void load()
  }, [load])
  if (!lines.length && !saved) return null
  return (
    <section className="ws-held" aria-labelledby="held-h">
      <h2 id="held-h" className="np-h2" style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        Held from the file <span className="ds-count">{lines.length}</span>
      </h2>
      <p className="np-sub" style={{ marginTop: 2 }}>
        These lines were not saved as flows. Give each one what it lacks and put it on a step, or dismiss it.
      </p>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
        {lines.map((l) => (
          <HeldRow
            key={l.held_id}
            line={l}
            steps={steps}
            substances={substances}
            readOnly={readOnly}
            onDone={(line) => {
              setSaved(line)
              announceComponentsChanged()
              void load()
            }}
          />
        ))}
      </ul>
      {saved && (
        <p role="status" className="ds-saved-line" style={{ marginTop: 8 }}>
          {saved}
        </p>
      )}
    </section>
  )
}

function HeldRow({
  line,
  steps,
  substances,
  readOnly,
  onDone,
}: {
  line: HeldLine
  steps: WorkspaceStep[]
  substances: any[]
  readOnly: boolean
  onDone: (savedLine: string) => void
}) {
  const byName = useMemo(() => new Map(substances.map((s: any) => [String(s.substance_name).toLowerCase(), s])), [substances])
  // The step the file named, when the case has it.
  const named = steps.find((s) => s.name.toLowerCase() === (line.step_name ?? '').toLowerCase())
  const [stepId, setStepId] = useState<number | ''>(named?.id ?? '')
  const [substance, setSubstance] = useState(line.substance_name ?? '')
  const [unit, setUnit] = useState(line.unit ?? '')
  const [qty, setQty] = useState(line.quantity == null ? '' : String(line.quantity))
  const [busy, setBusy] = useState<'resolve' | 'dismiss' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const what = line.line_kind === 'cost' ? `${line.cost_category ?? 'Cost'} ${line.amount ?? ''}` : line.substance_text ?? 'A line'
  const listId = `held-subs-${line.held_id}`

  const act = async (body: Record<string, unknown>, kind: 'resolve' | 'dismiss') => {
    setBusy(kind)
    setError(null)
    const res = await apiRequest(`/api/held-lines/${line.held_id}`, { method: 'PUT', body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return setError(d?.error ?? `Not done (${res.status}).`)
    onDone(kind === 'dismiss' ? `Dismissed · ${what}` : `Saved · ${what} on ${steps.find((s) => s.id === stepId)?.name ?? 'its step'}`)
  }

  const resolve = () => {
    if (stepId === '') return setError('Pick the step that uses it.')
    const body: Record<string, unknown> = { action: 'resolve', component_id: stepId }
    if (line.line_kind === 'flow') {
      const s = byName.get(substance.trim().toLowerCase()) as any
      if (!s && !line.substance_id) return setError('Pick the substance from the library list.')
      if (s && s.substance_id !== line.substance_id) body.substance_id = Number(s.substance_id)
      if (unit.trim() && unit.trim() !== line.unit) body.unit = unit.trim()
      if (qty.trim() !== '' && Number(qty) !== line.quantity) {
        if (!Number.isFinite(Number(qty)) || Number(qty) < 0) return setError('Enter an amount of 0 or more.')
        body.quantity = Number(qty)
      }
    }
    void act(body, 'resolve')
  }

  return (
    <li className="ws-held-row">
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 15 }}>{what}</strong>
        <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
          Held: {line.reason_text}
          {line.step_name ? ` · the file says ${line.step_name}` : ''}
          {line.quantity != null ? ` · ${line.quantity} ${line.unit ?? ''}` : ''}
        </span>
      </span>
      {!readOnly && (
        <span className="ws-held-form">
          <select className="ds-input" aria-label={`Step for ${what}`} value={stepId} onChange={(e) => setStepId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Choose a step</option>
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {line.line_kind === 'flow' && (
            <>
              <input className="ds-input" list={listId} aria-label={`Substance for ${what}`} placeholder="Substance" value={substance} onChange={(e) => setSubstance(e.target.value)} style={{ width: 200 }} />
              <datalist id={listId}>
                {substances.slice(0, 500).map((s: any) => (
                  <option key={s.substance_id} value={s.substance_name} />
                ))}
              </datalist>
              <input className="ds-input ds-mono" aria-label={`Amount of ${what}`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 90 }} />
              <input className="ds-input ds-mono" aria-label={`Unit of ${what}`} value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 70 }} />
            </>
          )}
          <Button size="small" variant="dark" busy={busy === 'resolve'} onClick={resolve}>
            Put on the step
          </Button>
          <button type="button" className="ds-link" disabled={!!busy} onClick={() => void act({ action: 'dismiss' }, 'dismiss')}>
            Dismiss
          </button>
        </span>
      )}
      {error && (
        <span role="alert" style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
    </li>
  )
}
