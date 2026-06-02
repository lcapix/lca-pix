'use client'

// InspectorPanel + InspectorSection — right-pane editor.
// Mirrors LCAPIX/pages-app.jsx lines 907-986 but made generic enough to
// bind against real component edit state. When `editFormData` is passed
// along with `onChange`, fields become controlled; otherwise they render
// as read-only placeholders matching the prototype.

import { useState, type ReactNode } from 'react'
import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import { Icon } from '@/components/lcapix/icon'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface InspectorEditFormData {
  processName?: string
  processDescription?: string
  mass?: number
  massUnit?: string
  laborCost?: number
  energyCost?: number
  transportationCost?: number
  materialCost?: number
  equipmentCost?: number
  overheadCost?: number
}

export interface InspectorFlow {
  id: string
  substance: string
  dir: 'IN' | 'OUT'
  amount: number
  unit: string
}

export interface InspectorPanelProps {
  node: FlatCaseNode | null
  editFormData?: InspectorEditFormData
  onChange?: (patch: Partial<InspectorEditFormData>) => void
  onSave?: () => void
  onDelete?: () => void
  flows?: InspectorFlow[]
}

const COST_FIELDS: Array<[keyof InspectorEditFormData, string]> = [
  ['laborCost', 'Labor'],
  ['energyCost', 'Energy'],
  ['materialCost', 'Material'],
  ['transportationCost', 'Transport'],
  ['equipmentCost', 'Equipment'],
  ['overheadCost', 'Overhead'],
]

export function InspectorPanel({
  node,
  editFormData,
  onChange,
  onSave,
  onDelete,
  flows = [],
}: InspectorPanelProps) {
  if (!node) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
        Select a component on the left to inspect.
      </div>
    )
  }

  const t = HIERARCHY_TYPES.find((h) => h.id === node.type)
  const controlled = !!editFormData && !!onChange

  return (
    <div style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: t?.color,
              background: 'oklch(from ' + t?.color + ' l c h / 0.15)',
              padding: '2px 6px',
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {t?.label}
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {node.label}
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}
        >
          ID: {node.id}
        </div>
      </div>

      <InspectorSection title="Properties" defaultOpen={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="label">Quantity</label>
            <input
              className="input"
              style={{ height: 32, fontSize: 13 }}
              value={controlled ? editFormData!.mass ?? '' : '1'}
              onChange={(e) =>
                controlled &&
                onChange!({ mass: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              readOnly={!controlled}
            />
          </div>
          <div>
            <label className="label">Unit</label>
            <input
              className="input"
              style={{ height: 32, fontSize: 13 }}
              value={controlled ? editFormData!.massUnit ?? '' : 'unit'}
              onChange={(e) => controlled && onChange!({ massUnit: e.target.value })}
              readOnly={!controlled}
            />
          </div>
          <div style={{ gridColumn: '1/3' }}>
            <label className="label">Name</label>
            <input
              className="input"
              style={{ height: 32, fontSize: 13 }}
              value={controlled ? editFormData!.processName ?? '' : node.label}
              onChange={(e) => controlled && onChange!({ processName: e.target.value })}
              readOnly={!controlled}
            />
          </div>
          <div style={{ gridColumn: '1/3' }}>
            <label className="label">Description</label>
            <textarea
              className="input"
              style={{ height: 60, padding: 8, fontSize: 12, resize: 'vertical' }}
              value={controlled ? editFormData!.processDescription ?? '' : ''}
              onChange={(e) =>
                controlled && onChange!({ processDescription: e.target.value })
              }
              readOnly={!controlled}
              placeholder="Describe this component"
            />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Environmental Flows" count={flows.length}>
        {flows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
            No flows assigned.
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {flows.map((f, i) => (
              <div
                key={f.id}
                style={{
                  padding: '10px 12px',
                  borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background:
                      f.dir === 'IN'
                        ? 'oklch(from var(--signal-info) l c h / 0.18)'
                        : 'oklch(from var(--signal-warn) l c h / 0.18)',
                    color: f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)',
                    fontWeight: 600,
                  }}
                >
                  {f.dir}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {f.substance}
                </span>
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  {f.amount.toFixed(2)}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  {f.unit}
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
          type="button"
          disabled
        >
          <Icon name="plus" size={12} /> Add flow
        </button>
      </InspectorSection>

      <InspectorSection title="Costs">
        {controlled && (
          <InlineSuggestStrip
            componentType={(node?.type as string) ?? ''}
            quantity={(editFormData?.mass as number) ?? 1}
            region="US"
            onApply={(s) =>
              onChange!({
                laborCost: s.labor ?? editFormData!.laborCost,
                energyCost: s.energy ?? editFormData!.energyCost,
                materialCost: s.material ?? editFormData!.materialCost,
              })
            }
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {COST_FIELDS.map(([key, label]) => (
            <div key={key as string}>
              <label className="label" style={{ fontSize: 11 }}>
                {label}
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: 8,
                    color: 'var(--text-tertiary)',
                    fontSize: 13,
                  }}
                >
                  $
                </span>
                <input
                  className="input mono"
                  style={{ height: 30, fontSize: 12, paddingLeft: 22 }}
                  value={controlled ? (editFormData![key] as number | undefined) ?? '' : ''}
                  onChange={(e) =>
                    controlled &&
                    onChange!({
                      [key]: e.target.value === '' ? undefined : Number(e.target.value),
                    } as Partial<InspectorEditFormData>)
                  }
                  readOnly={!controlled}
                />
              </div>
            </div>
          ))}
        </div>
      </InspectorSection>

      {(onSave || onDelete) && (
        <div
          style={{
            padding: 16,
            borderTop: '1px solid var(--border-subtle)',
            marginTop: 'auto',
            display: 'flex',
            gap: 8,
            position: 'sticky',
            bottom: 0,
            background: 'var(--surface-base)',
          }}
        >
          {onDelete && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--signal-error)' }}
              type="button"
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onSave && (
            <button className="btn btn-primary btn-sm" type="button" onClick={onSave}>
              Save
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export interface InspectorSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}

export function InspectorSection({
  title,
  count,
  defaultOpen = true,
  children,
}: InspectorSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '12px 20px',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <Icon
          name="chevron-down"
          size={12}
          style={{
            color: 'var(--text-tertiary)',
            transform: open ? 'none' : 'rotate(-90deg)',
            transition: 'transform 140ms',
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            flex: 1,
            textAlign: 'left',
          }}
        >
          {title}
        </span>
        {count !== undefined && (
          <span className="mono chip" style={{ fontSize: 10, padding: '1px 6px' }}>
            {count}
          </span>
        )}
      </button>
      {open && <div style={{ padding: '4px 20px 16px' }}>{children}</div>}
    </div>
  )
}

// ─── Inline "Suggest from integrations" — compact version for the right pane ───
// Pulls BLS / EIA / Metals-API defaults and lets the user one-click apply.

function InlineSuggestStrip({
  componentType,
  quantity,
  region,
  onApply,
}: {
  componentType: string
  quantity: number
  region: string
  onApply: (s: { labor?: number; energy?: number; material?: number }) => void
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    sources: string[]
    payload: { labor?: number; energy?: number; material?: number }
  } | null>(null)

  const t = (componentType || '').toLowerCase()
  const wants = {
    labor: /machine|subprocess|operation/.test(t),
    energy: /operation|elemental/.test(t),
    material: /elemental|subprocess/.test(t),
  }
  const hasAnything = wants.labor || wants.energy || wants.material
  if (!hasAnything) return null

  async function suggest() {
    setLoading(true)
    setResult(null)
    const sources: string[] = []
    const payload: { labor?: number; energy?: number; material?: number } = {}
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = 'Bearer ' + token
    const q = Math.max(1, Number(quantity) || 1)
    try {
      if (wants.labor) {
        const r = await fetch('/api/integrations/bls/fetch-wage', {
          method: 'POST',
          headers,
          body: JSON.stringify({ occupation: '51-4121', state: region }),
        })
        if (r.ok) {
          const d = await r.json()
          const hourly = Number(d?.rate?.rateValue ?? d?.hourlyRate ?? 0)
          if (hourly > 0) {
            payload.labor = Math.round(hourly * 0.5 * q * 100) / 100
            sources.push(`BLS $${hourly.toFixed(2)}/hr`)
          }
        }
      }
      if (wants.energy) {
        // EIA expects `state` (2-letter code), not `region`.
        const r = await fetch('/api/integrations/eia/fetch-energy-price', {
          method: 'POST',
          headers,
          body: JSON.stringify({ fuel: 'electricity', state: region }),
        })
        if (r.ok) {
          const d = await r.json()
          const perKwh = Number(d?.rate?.rateValue ?? d?.pricePerKwh ?? 0)
          if (perKwh > 0) {
            payload.energy = Math.round(perKwh * 2 * q * 100) / 100
            sources.push(`EIA $${perKwh.toFixed(3)}/kWh`)
          }
        }
      }
      if (wants.material) {
        // Metals-API uses ISO-style 3-letter codes (STL, ALU, …).
        const r = await fetch('/api/integrations/metals/fetch-price', {
          method: 'POST',
          headers,
          body: JSON.stringify({ symbol: 'STL' }),
        })
        if (r.ok) {
          const d = await r.json()
          const perKg = Number(d?.rate?.rateValue ?? d?.pricePerKg ?? 0)
          if (perKg > 0) {
            payload.material = Math.round(perKg * q * 100) / 100
            sources.push(`Metals-API $${perKg.toFixed(2)}/kg`)
          }
        }
      }
      // Offline fallback so the affordance always works in demo mode.
      if (
        payload.labor == null &&
        payload.energy == null &&
        payload.material == null
      ) {
        if (wants.labor) {
          payload.labor = Math.round(24 * 0.5 * q * 100) / 100
          sources.push('BLS fallback $24/hr')
        }
        if (wants.energy) {
          payload.energy = Math.round(0.13 * 2 * q * 100) / 100
          sources.push('EIA fallback $0.13/kWh')
        }
        if (wants.material) {
          payload.material = Math.round(0.95 * q * 100) / 100
          sources.push('Metals-API fallback $0.95/kg')
        }
      }
      setResult({ sources, payload })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        marginBottom: 10,
        padding: 10,
        background:
          'color-mix(in oklab, var(--brand-primary) 5%, var(--surface-raised))',
        border:
          '1px solid color-mix(in oklab, var(--brand-primary) 18%, var(--border-subtle))',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background:
              'color-mix(in oklab, var(--brand-primary) 20%, transparent)',
            color: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ✦
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          Suggest cost defaults from
          {wants.labor && ' BLS,'}
          {wants.energy && ' EIA,'}
          {wants.material && ' Metals-API'}
          .
        </span>
        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          className="btn btn-ghost btn-sm"
          style={{
            fontSize: 11,
            padding: '4px 10px',
            flexShrink: 0,
          }}
        >
          {loading ? 'Fetching…' : result ? 'Refetch' : 'Fetch'}
        </button>
      </div>
      {result && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px dashed var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 11,
            }}
          >
            {result.payload.labor != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>L</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.labor.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.energy != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>E</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.energy.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.material != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>M</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.material.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {result.sources.join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => onApply(result.payload)}
            >
              Apply
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setResult(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
