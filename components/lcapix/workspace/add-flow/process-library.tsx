'use client'

/**
 * The process library, in driver units.
 *
 * Pick the kind of process this step is, say how much of its driver it runs
 * (12 minutes of cutting, 0.4 m² coated), and the library lists what such a
 * process consumes. The amount per driver comes from the student's own machine;
 * the arithmetic driver quantity × amount per driver is shown as it is typed
 * and written onto the flow, so a number in the inventory can always be read
 * back as the two numbers behind it.
 *
 * That product is the patent's driver factor × driver value. It is also the
 * honest position on data: the library names what to look for and where the
 * number usually lives, instead of shipping invented per-minute figures.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'

type Line = {
  template_flow_id: number
  substance_id: number | null
  substance_hint: string | null
  substance_name: string | null
  substance_unit: string | null
  flow_type: string
  amount_per_driver: string | number | null
  unit: string
  note: string | null
}

type Template = {
  template_id: number
  template_name: string
  process_family: string | null
  driver_unit: string
  driver_label: string | null
  description: string | null
  source_reference: string | null
  lines: Line[]
}

export function ProcessLibrary({
  componentId,
  initialTemplateId = null,
  onAdded,
  onClose,
}: {
  componentId: string
  /** Preselected when the step was created with a process already chosen. */
  initialTemplateId?: number | null
  onAdded: () => void
  onClose: () => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [pickedId, setPickedId] = useState<number | null>(initialTemplateId)
  const [driverQty, setDriverQty] = useState('')
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  // Why the library could not be read. A database without it answers an empty
  // list; any other failure is said as such, not as an empty library.
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await apiRequest('/api/process-templates')
        const d = await r.json().catch(() => null)
        if (!r.ok || !Array.isArray(d?.templates)) throw new Error(d?.error || `the server answered ${r.status}`)
        setTemplates(d.templates)
      } catch (err: any) {
        setLoadError(String(err?.message || 'the request failed').replace(/\.\s*$/, ''))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (initialTemplateId) setPickedId(initialTemplateId)
  }, [initialTemplateId])

  const picked = useMemo(
    () => templates.find((t) => t.template_id === pickedId) ?? null,
    [templates, pickedId],
  )

  const qty = Number(driverQty)
  const qtyOk = driverQty.trim() !== '' && isFinite(qty) && qty > 0

  const total = (line: Line) => {
    const per = Number(amounts[line.template_flow_id] ?? line.amount_per_driver ?? NaN)
    if (!qtyOk || !isFinite(per) || per <= 0) return null
    return per * qty
  }

  const addAll = async () => {
    if (!picked || !qtyOk) return
    const ready = picked.lines.filter((l) => l.substance_id && total(l) !== null)
    if (ready.length === 0) {
      toast.error('Fill in at least one amount for a substance that is in the library')
      return
    }

    setSaving(true)
    let added = 0
    const failed: string[] = []
    try {
      for (const line of ready) {
        const per = Number(amounts[line.template_flow_id] ?? line.amount_per_driver)
        const value = total(line)!
        const name = line.substance_name ?? line.substance_hint
        // A dropped connection on one line is that line's failure, named below;
        // the lines already added are still reported and shown, so a retry
        // does not add them twice.
        let res: Response
        try {
          res = await apiRequest(`/api/components/${componentId}/flows`, {
            method: 'POST',
            body: JSON.stringify({
              substance_id: line.substance_id,
              flow_type: line.flow_type === 'output' ? 'output' : 'input',
              quantity: value,
              unit: line.unit,
              // The arithmetic, kept on the flow: a reader can check the number.
              driver_description:
                `${picked.template_name}: ${per} ${line.unit}/${picked.driver_unit} × ` +
                `${qty} ${picked.driver_unit}`,
            }),
          })
        } catch (err: any) {
          failed.push(`${name}: not sent (${err?.message ?? 'the connection failed'})`)
          continue
        }
        if (res.ok) added += 1
        else {
          const body = await res.json().catch(() => null)
          failed.push(`${name}: ${body?.error ?? res.status}`)
        }
      }
    } finally {
      setSaving(false)
    }

    if (added) {
      toast.success(`${added} flow${added === 1 ? '' : 's'} added from ${picked.template_name}`)
      onAdded()
    }
    // Never silent: a line the server refused is named, with its reason.
    failed.forEach((f) => toast.error(f))
    if (added && !failed.length) onClose()
  }

  return (
    <div className="ds-card af-sub" role="group" aria-label="Process library">
      <div className="af-head">
        <strong>Process library</strong>
        <button type="button" className="ds-btn ds-btn--small" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <p className="af-muted">Loading…</p>}

      {!loading && loadError && (
        <p role="alert" className="af-error">
          Could not load the process library: {loadError}. Close it and try again.
        </p>
      )}

      {!loading && !loadError && templates.length === 0 && <p className="af-muted">The process library is empty on this database.</p>}

      {!loading && templates.length > 0 && (
        <>
          <label>
            <span className="af-small">What kind of process is this step?</span>
            <select
              className="ds-input af-full"
              value={pickedId ?? ''}
              onChange={(e) => {
                setPickedId(e.target.value ? Number(e.target.value) : null)
                setAmounts({})
              }}
            >
              <option value="">Choose a process…</option>
              {templates.map((t) => (
                <option key={t.template_id} value={t.template_id}>
                  {t.template_name} (per {t.driver_unit})
                </option>
              ))}
            </select>
          </label>

          {picked && (
            <>
              {picked.description && <p className="af-muted">{picked.description}</p>}

              <label>
                <span className="af-small">{picked.driver_label ?? `How much of the driver (${picked.driver_unit})`}</span>
                <input
                  className="ds-input af-full"
                  value={driverQty}
                  onChange={(e) => setDriverQty(e.target.value)}
                  inputMode="decimal"
                  placeholder={`e.g. 12 (${picked.driver_unit})`}
                />
              </label>

              <div className="af-lines">
                {picked.lines.map((line) => {
                  const known = !!line.substance_id
                  const value = total(line)
                  return (
                    <div key={line.template_flow_id} className="af-line">
                      <div>
                        {line.substance_name ?? line.substance_hint}
                        {!known && <span className="af-muted"> not in the library: add it as a substance first</span>}
                      </div>
                      {line.note && <p className="af-muted">{line.note}</p>}
                      {known && (
                        <div className="af-line-amount">
                          <input
                            className="ds-input"
                            style={{ width: 110 }}
                            value={amounts[line.template_flow_id] ?? (line.amount_per_driver ?? '')}
                            onChange={(e) => setAmounts({ ...amounts, [line.template_flow_id]: e.target.value })}
                            inputMode="decimal"
                            placeholder="amount"
                            aria-label={`${line.substance_name} per ${picked.driver_unit}`}
                          />
                          <span className="af-muted">
                            {line.unit} per {picked.driver_unit}
                          </span>
                          {value !== null && (
                            <span className="ds-mono af-tkm">
                              = {Number(value.toPrecision(6))} {line.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="af-actions">
                <button type="button" className="ds-btn ds-btn--primary ds-btn--small" onClick={addAll} disabled={saving || !qtyOk}>
                  {saving ? 'Adding…' : 'Add these flows'}
                </button>
                <span className="af-muted">Each flow keeps the arithmetic behind it.</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
