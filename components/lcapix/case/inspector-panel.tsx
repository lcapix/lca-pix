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
