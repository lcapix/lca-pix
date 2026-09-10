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
import {
  getLaborRate,
  getEnergyRate,
  pickMaterialRate,
} from '@/lib/integrations/reference-rates'
import { EnvironmentalFlowsEditor } from '@/components/lcapix/case/environmental-flows-editor'

export interface InspectorEditFormData {
  processName?: string
  processDescription?: string
  parentId?: string
  mass?: number
  massUnit?: string
  laborCost?: number
  energyCost?: number
  transportationCost?: number
  materialCost?: number
  equipmentCost?: number
  overheadCost?: number
}

/** Candidate re-parent target for the inspector's Parent selector. */
export interface ParentOption {
  id: string
  label: string
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
  /** Candidate parents for re-parenting (excludes self + descendants). */
  parentOptions?: ParentOption[]
  /** Apply suggested costs AND persist them in one action. */
  onApplyCosts?: (patch: Partial<InspectorEditFormData>) => void
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
  parentOptions = [],
  onApplyCosts,
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

      {/* Placement — re-parent any non-product node anywhere in the tree, or
          make it independent. Products are always roots, so this is hidden for
          them. */}
      {controlled && node.type !== 'Product' && (
        <InspectorSection title="Placement" defaultOpen={true}>
          <label
            className="mono"
            style={{
              fontSize: 9,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
            }}
          >
            Parent
          </label>
          <div style={{ position: 'relative', marginTop: 6 }}>
            <select
              className="input"
              style={{ appearance: 'none', paddingRight: 32, width: '100%' }}
              value={editFormData?.parentId ?? 'none'}
              onChange={(e) => {
                const v = e.target.value
                onChange!({ parentId: v === 'none' ? undefined : v })
              }}
            >
              <option value="none">Independent — no parent (top-level)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              size={14}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }}
            />
          </div>
          <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
            Move this node under a valid parent (one level up), or make it
            independent. Then Save.
          </p>
        </InspectorSection>
      )}

      <InspectorSection title="Environmental Flows">
        {controlled && node.id && node.id !== '__root__' ? (
          // Live editor: list + add (substance picker from the catalog) + delete.
          <EnvironmentalFlowsEditor
            componentId={node.id}
            componentName={node.label ?? ''}
            componentType={(node.type as string) ?? ''}
          />
        ) : flows.length === 0 ? (
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
      </InspectorSection>

      <InspectorSection title="Costs">
        {controlled && (
          <InlineSuggestStrip
            componentType={(node?.type as string) ?? ''}
            nodeName={(node?.label as string) ?? ''}
            quantity={(editFormData?.mass as number) ?? 1}
            region="US"
            onApply={(s) => {
              const patch = {
                laborCost: s.labor ?? editFormData!.laborCost,
                energyCost: s.energy ?? editFormData!.energyCost,
                materialCost: s.material ?? editFormData!.materialCost,
              }
              onChange!(patch)
              // Persist immediately so applied costs are saved without hunting
              // for the Save button.
              onApplyCosts?.(patch)
            }}
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
  nodeName,
  quantity,
  region,
  onApply,
}: {
  componentType: string
  nodeName?: string
  quantity: number
  region: string
  onApply: (s: { labor?: number; energy?: number; material?: number }) => void
}) {
  const [result, setResult] = useState<{
    sources: string[]
    payload: { labor?: number; energy?: number; material?: number }
  } | null>(null)
  const [applied, setApplied] = useState(false)

  const t = (componentType || '').toLowerCase()
  const wants = {
    labor: /machine|subprocess|operation/.test(t),
    energy: /operation|elemental/.test(t),
    material: /elemental|subprocess/.test(t),
  }
  const hasAnything = wants.labor || wants.energy || wants.material
  if (!hasAnything) return null

  // Static suggestion from curated reference rates (BLS / EIA / USGS averages).
  // No network — works with zero API keys, no rate limits. The per-unit
  // multipliers (0.5 h labor, 2 kWh energy, 1× material mass) are conservative
  // default estimates the user can override after applying.
  function suggest() {
    setApplied(false)
    const sources: string[] = []
    const payload: { labor?: number; energy?: number; material?: number } = {}
    const q = Math.max(1, Number(quantity) || 1)

    if (wants.labor) {
      const lr = getLaborRate(nodeName || componentType)
      payload.labor = Math.round(lr.rate * 0.5 * q * 100) / 100
      sources.push(`Labor ${lr.label} $${lr.rate.toFixed(2)}/hr`)
    }
    if (wants.energy) {
      const er = getEnergyRate()
      payload.energy = Math.round(er.rate * 2 * q * 100) / 100
      sources.push(`Energy ${er.label} $${er.rate.toFixed(3)}/kWh`)
    }
    if (wants.material) {
      const mr = pickMaterialRate(nodeName)
      payload.material = Math.round(mr.rate * q * 100) / 100
      sources.push(`Material ${mr.label} $${mr.rate.toFixed(2)}/kg`)
    }
    setResult({ sources, payload })
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
          Suggest cost defaults from reference rates
          {' '}(BLS / EIA / USGS averages).
        </span>
        <button
          type="button"
          onClick={suggest}
          className="btn btn-ghost btn-sm"
          style={{
            fontSize: 11,
            padding: '4px 10px',
            flexShrink: 0,
          }}
        >
          {result ? 'Refresh' : applied ? 'Suggest again' : 'Suggest'}
        </button>
      </div>
      {applied && !result && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--signal-success, #0f7b3a)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✓ Applied &amp; saved to costs.
        </div>
      )}
      {applied && !result && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--signal-success, #0F7B3A)',
            fontWeight: 600,
          }}
        >
          ✓ Applied &amp; saved to costs
        </div>
      )}
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
              onClick={() => {
                onApply(result.payload)
                setApplied(true)
                setResult(null)
              }}
            >
              Apply &amp; save
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
