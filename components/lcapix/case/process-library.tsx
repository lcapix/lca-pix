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
  onAdded,
  onClose,
}: {
  componentId: string
  onAdded: () => void
  onClose: () => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [driverQty, setDriverQty] = useState('')
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await apiRequest('/api/process-templates')
        const d = await r.json().catch(() => ({}))
        setTemplates(Array.isArray(d?.templates) ? d.templates : [])
      } catch {
        setTemplates([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
      toast.error('Fill in at least one amount for a substance that is in the catalog')
      return
    }

    setSaving(true)
    let added = 0
    const failed: string[] = []
    try {
      for (const line of ready) {
        const per = Number(amounts[line.template_flow_id] ?? line.amount_per_driver)
        const value = total(line)!
        const res = await apiRequest(`/api/components/${componentId}/flows`, {
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
        if (res.ok) added += 1
        else {
          const body = await res.json().catch(() => null)
          failed.push(`${line.substance_name ?? line.substance_hint}: ${body?.error ?? res.status}`)
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

  const box: React.CSSProperties = {
    fontSize: 12,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-base)',
    color: 'var(--text-primary)',
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
        border: '1px solid color-mix(in oklab, var(--brand-primary) 35%, transparent)',
        background: 'var(--surface-base)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 12.5 }}>Process library</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading…</div>}

      {!loading && templates.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          The library is empty: the database needs migrations 022 and 023.
        </div>
      )}

      {!loading && templates.length > 0 && (
        <>
          <label style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
            What kind of process is this step?
            <select
              style={{ ...box, width: '100%', marginTop: 4 }}
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
              {picked.description && (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {picked.description}
                </div>
              )}

              <label style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {picked.driver_label ?? `How much of the driver (${picked.driver_unit})`}
                <input
                  style={{ ...box, width: '100%', marginTop: 4 }}
                  value={driverQty}
                  onChange={(e) => setDriverQty(e.target.value)}
                  inputMode="decimal"
                  placeholder={`e.g. 12 (${picked.driver_unit})`}
                />
              </label>

              <div style={{ display: 'grid', gap: 8 }}>
                {picked.lines.map((line) => {
                  const known = !!line.substance_id
                  const value = total(line)
                  return (
                    <div
                      key={line.template_flow_id}
                      style={{
                        display: 'grid',
                        gap: 4,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                        {line.substance_name ?? line.substance_hint}
                        {!known && (
                          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                            not in the catalog — add it as a substance first
                          </span>
                        )}
                      </div>
                      {line.note && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                          {line.note}
                        </div>
                      )}
                      {known && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            style={{ ...box, width: 110 }}
                            value={amounts[line.template_flow_id] ?? (line.amount_per_driver ?? '')}
                            onChange={(e) =>
                              setAmounts({ ...amounts, [line.template_flow_id]: e.target.value })
                            }
                            inputMode="decimal"
                            placeholder="amount"
                            aria-label={`${line.substance_name} per ${picked.driver_unit}`}
                          />
                          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                            {line.unit} per {picked.driver_unit}
                          </span>
                          {value !== null && (
                            <span style={{ fontSize: 11.5, color: 'var(--brand-primary, #1d7848)' }}>
                              = {Number(value.toPrecision(6))} {line.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={addAll}
                  disabled={saving || !qtyOk}
                >
                  {saving ? 'Adding…' : 'Add these flows'}
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Each flow keeps the arithmetic behind it.
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default ProcessLibrary
