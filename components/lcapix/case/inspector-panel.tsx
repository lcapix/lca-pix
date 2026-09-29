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
import { suggestCostsFromFlows } from '@/lib/costs/suggest-costs'
import {
  ENERGY_RATES,
  REFERENCE_VINTAGE,
  getLaborRate,
} from '@/lib/integrations/reference-rates'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'

// US state codes for the labor-wage location picker (item 2 — state-level BLS
// wages). 'US' (national) is the default and lives in the <select> directly.
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY',
]
import { EnvironmentalFlowsEditor } from '@/components/lcapix/case/environmental-flows-editor'
import { STAGES, stageOf } from '@/lib/life-cycle'

export interface InspectorEditFormData {
  processName?: string
  processDescription?: string
  parentId?: string
  mass?: number
  massUnit?: string
  laborCost?: number
  /** Labor multiplicand: hours worked. laborCost = laborHours × the SOC rate. */
  laborHours?: number
  /** BLS SOC code of the wage rate used (e.g. '51-4121'), for provenance. */
  laborOccupation?: string
  energyCost?: number
  transportationCost?: number
  materialCost?: number
  equipmentCost?: number
  overheadCost?: number
  /** Which life-cycle stage this step belongs to. */
  lifeCycleStage?: string | null
  /** ISO 14044 4.3.4: share of this node's burden that belongs to the product. */
  allocationMethod?: 'none' | 'physical' | 'economic' | 'system_expansion'
  allocationFactor?: number
  allocationNote?: string
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
  /** The study's LCIA method, used as the default when a substance is added by hand. */
  studyMethod?: string
  editFormData?: InspectorEditFormData
  onChange?: (patch: Partial<InspectorEditFormData>) => void
  onSave?: () => void
  onDelete?: () => void
  flows?: InspectorFlow[]
  /** Candidate parents for re-parenting (excludes self + descendants). */
  parentOptions?: ParentOption[]
  /** Apply suggested costs AND persist them in one action. */
  onApplyCosts?: (patch: Partial<InspectorEditFormData>) => void
  /** True when the node has children: it is a roll-up (pure sum), so it has
   * no flows or costs of its own and editing them there is not offered. */
  hasChildren?: boolean
  /** Subtree totals for a roll-up node (this node + everything below). */
  rolled?: { cost: number; flows: number } | null
}

const COST_FIELDS: Array<[keyof InspectorEditFormData, string]> = [
  ['laborCost', 'Labor'],
  ['energyCost', 'Energy'],
  ['materialCost', 'Material'],
  ['transportationCost', 'Transport'],
  ['equipmentCost', 'Equipment'],
  ['overheadCost', 'Overhead'],
]

// Hover definitions for the cost fields (activity-based costing): what belongs
// in each bucket, so a student can fill them without a textbook.
const COST_HELP: Record<string, string> = {
  laborCost:
    'Wages for the people doing this step: hours × hourly rate. The calculator above works it out from hours and a BLS wage.',
  energyCost:
    'What you pay for the electricity, gas or fuel this step uses: kWh × price, or m³ × price.',
  materialCost: 'Purchase cost of the materials this step consumes.',
  transportationCost:
    'Freight to bring materials or parts to this step: usually distance × weight × a freight rate.',
  equipmentCost:
    'Machine cost for this step: depreciation, maintenance and tooling, often machine hours × a machine-hour rate.',
  overheadCost:
    'Shared costs assigned to this step (supervision, building, unmetered utilities), spread by a rule such as labor hours.',
}

export function InspectorPanel({
  node,
  studyMethod,
  editFormData,
  onChange,
  onSave,
  onDelete,
  flows = [],
  parentOptions = [],
  onApplyCosts,
  hasChildren = false,
  rolled = null,
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
          {/* Quantity belongs to the product only: it is the case's data basis
              (how many units the entered data describe) and changing it rescales
              the case. On a step it meant nothing — the engine reads the step's
              flows, not a count on the node — so a number typed there was
              decoration. A step that runs twice per unit doubles its own hours,
              energy and materials, which is where ERP routings and openLCA unit
              processes carry repetition too. */}
          {node.type === 'Product' && (
            <>
              <div>
                <label className="label">
                  Quantity
                  <HelpTip label="What is this quantity?">{ISO_HELP.dataBasis}</HelpTip>
                </label>
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
            </>
          )}
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
              value={editFormData?.parentId ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onChange!({ parentId: v || undefined })
              }}
            >
              <option value="" disabled>
                Choose a parent…
              </option>
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
            Every step needs a parent: any higher-level step (levels may be
            skipped, e.g. an operation straight under the product). Then Save.
          </p>
        </InspectorSection>
      )}

      <InspectorSection title="Environmental Flows">
        {hasChildren ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              padding: '4px 0',
              lineHeight: 1.5,
            }}
          >
            Roll-up node:{' '}
            <span className="mono" style={{ color: 'var(--text-primary)' }}>
              {rolled?.flows ?? 0}
            </span>{' '}
            flow{(rolled?.flows ?? 0) === 1 ? '' : 's'} across the nodes below. Select a
            process step below to add or edit flows.
            <HelpTip label="Why can't I add flows here?">
              In LCA (ISO 14044) every input and output belongs to a unit process: the
              operation where it is consumed or emitted. Higher nodes are totals of what is
              below them, so giving them flows of their own would count the same thing twice.
            </HelpTip>
          </div>
        ) : controlled && node.id && node.id !== '__root__' ? (
          // Live editor: list + add (substance picker from the catalog) + delete.
          <EnvironmentalFlowsEditor
            componentId={node.id}
            componentName={node.label ?? ''}
            componentType={(node.type as string) ?? ''}
            studyMethod={studyMethod}
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
        {hasChildren && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              padding: '4px 0',
              lineHeight: 1.5,
            }}
          >
            <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Σ ${Math.round(rolled?.cost ?? 0).toLocaleString()}
            </span>{' '}
            is the total of every cost below this node. Costs are entered on the process steps
            below it.
            <HelpTip label="Why can't I edit costs here?">
              Activity-based costing charges each cost to the activity that incurs it: labor and
              machine time to the operation, materials to the step that consumes them. A parent
              node is the sum of its activities, so it has no cost of its own to edit.
            </HelpTip>
          </div>
        )}
        {controlled && !hasChildren && (
          <InlineSuggestStrip
            componentType={(node?.type as string) ?? ''}
            nodeName={(node?.label as string) ?? ''}
            flows={flows}
            onApply={(s) => {
              const patch = {
                laborCost: s.labor ?? editFormData!.laborCost,
                energyCost: s.energy ?? editFormData!.energyCost,
                materialCost: s.material ?? editFormData!.materialCost,
                transportationCost: s.transportation ?? editFormData!.transportationCost,
              }
              onChange!(patch)
              // Persist immediately so applied costs are saved without hunting
              // for the Save button.
              onApplyCosts?.(patch)
            }}
          />
        )}
        {controlled && !hasChildren && (
          <LaborBreakdown
            key={(node?.id as string) ?? 'none'}
            node={node}
            editFormData={editFormData!}
            onChange={onChange!}
          />
        )}
        {controlled && !hasChildren && node.id && node.id !== '__root__' && (
          <MachineEnergy
            key={`machine-${node.id as string}`}
            componentId={node.id as string}
            laborHours={editFormData!.laborHours}
            onChange={onChange!}
          />
        )}
        {/* A roll-up node has no costs of its own: only the Σ line above. */}
        {!hasChildren && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {COST_FIELDS.map(([key, label]) => (
            <div key={key as string}>
              <label className="label" style={{ fontSize: 11 }}>
                {label}
                <HelpTip label={`What goes in ${label.toLowerCase()}?`}>
                  {COST_HELP[key as string]}
                </HelpTip>
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
        )}
      </InspectorSection>

      {controlled && node.type !== 'Product' && (
        <InspectorSection title="Life-cycle stage" defaultOpen={false}>
          <div style={{ padding: '4px 0 8px' }}>
            <select
              className="input"
              style={{ height: 30, fontSize: 12, width: '100%' }}
              value={stageOf(editFormData!.lifeCycleStage)}
              onChange={(e) => onChange!({ lifeCycleStage: e.target.value })}
              title="Which stage of the product's life this step belongs to. The results and the report split by this, and the boundary in Goal & scope says which stages a reader should expect."
            >
              {STAGES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
              {STAGES.find((st) => st.id === stageOf(editFormData!.lifeCycleStage))?.hint}
            </div>
          </div>
        </InspectorSection>
      )}

      {controlled && node.type !== 'Product' && (
        <InspectorSection
          title="Allocation"
          defaultOpen={(editFormData!.allocationMethod ?? 'none') !== 'none'}
        >
          <AllocationEditor
            editFormData={editFormData!}
            onChange={onChange!}
            hasChildren={hasChildren}
          />
        </InspectorSection>
      )}

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

const ALLOCATION_METHODS: Array<{ id: 'none' | 'physical' | 'economic'; label: string }> = [
  { id: 'none', label: 'None (only this product)' },
  { id: 'physical', label: 'Physical (e.g. by mass)' },
  { id: 'economic', label: 'Economic (by value)' },
]

// ISO 14044 4.3.4 allocation for a node that also makes other products. The
// share is stored 0..1 and shown as a percent; environmental results only.
// System expansion (crediting avoided products) is not offered yet.
function AllocationEditor({
  editFormData,
  onChange,
  hasChildren,
}: {
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
  hasChildren: boolean
}) {
  const method =
    editFormData.allocationMethod === 'physical' || editFormData.allocationMethod === 'economic'
      ? editFormData.allocationMethod
      : 'none'
  const share = editFormData.allocationFactor
  const pctValue: number | '' =
    method === 'none' ? 100 : share == null ? '' : Math.round(share * 1000) / 10
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {method === 'none'
          ? 'Counted in full.'
          : `${pctValue === '' ? '?' : pctValue}% of this ${
              hasChildren ? 'part of the system' : 'process'
            } is assigned to the product.`}
        <HelpTip label="What is allocation?" width={320}>
          {ISO_HELP.allocation}
          {hasChildren ? ' Set on a parent, the share applies to every process under it.' : ''}
        </HelpTip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label className="label" style={{ fontSize: 11 }}>
            Method
          </label>
          <select
            className="input"
            style={{ height: 30, fontSize: 12 }}
            value={method}
            onChange={(e) => {
              const m = e.target.value as 'none' | 'physical' | 'economic'
              onChange(
                m === 'none'
                  ? { allocationMethod: 'none', allocationFactor: 1 }
                  : {
                      allocationMethod: m,
                      allocationFactor: share != null && share < 1 ? share : undefined,
                    },
              )
            }}
          >
            {ALLOCATION_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" style={{ fontSize: 11 }}>
            Share to this product
          </label>
          <div style={{ position: 'relative' }}>
            <input
              className="input mono"
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              disabled={method === 'none'}
              value={pctValue}
              onChange={(e) => {
                if (e.target.value === '') {
                  onChange({ allocationFactor: undefined })
                  return
                }
                const p = Number(e.target.value)
                if (!Number.isFinite(p)) return
                onChange({ allocationFactor: Math.min(1, Math.max(0.001, p / 100)) })
              }}
              style={{ height: 30, fontSize: 12, paddingRight: 24 }}
            />
            <span
              style={{
                position: 'absolute',
                right: 10,
                top: 7,
                color: 'var(--text-tertiary)',
                fontSize: 12,
              }}
            >
              %
            </span>
          </div>
        </div>
      </div>
      {method !== 'none' && (
        <div>
          <label className="label" style={{ fontSize: 11 }}>
            Basis
          </label>
          <input
            className="input"
            style={{ height: 30, fontSize: 12 }}
            placeholder="e.g. by mass: 80 kg of 100 kg output"
            value={editFormData.allocationNote ?? ''}
            onChange={(e) => onChange({ allocationNote: e.target.value })}
          />
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

// ─── Labor breakdown — the hours × rate = cost calculation, made visible and
// editable (item 5), with an optional live BLS state-level wage (item 2). Its
// own component so the location picker + live-wage state reset per node (keyed
// by node id at the call site). For rows ingested before hours were persisted,
// hours are back-derived from cost ÷ rate so the calculation still reads.
function LaborBreakdown({
  node,
  editFormData,
  onChange,
}: {
  node: FlatCaseNode | null
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
}) {
  const nodeType = (node?.type as string) ?? ''
  const isLaborNode =
    nodeType === 'operation' ||
    nodeType === 'elemental_task' ||
    editFormData.laborCost != null ||
    editFormData.laborHours != null

  const staticRate = getLaborRate((node?.label as string) ?? '')
  // Live BLS state wage overrides the static national rate once the user picks
  // a state. null = use the static national reference.
  const [state, setState] = useState('US')
  const [liveRate, setLiveRate] = useState<{ rate: number; source: string } | null>(null)
  const [wageLoading, setWageLoading] = useState(false)

  if (!isLaborNode) return null

  const rate = liveRate ? liveRate.rate : staticRate.rate
  const rateLabel = liveRate ? liveRate.source : `${staticRate.label} · BLS OEWS national`

  const storedHours = editFormData.laborHours
  const hoursVal =
    storedHours ??
    (editFormData.laborCost != null && rate
      ? Math.round((editFormData.laborCost / rate) * 1000) / 1000
      : undefined)
  const computed = hoursVal != null ? Math.round(hoursVal * rate * 100) / 100 : undefined

  const recost = (r: number) => {
    if (hoursVal != null)
      onChange({
        laborCost: Math.round(hoursVal * r * 100) / 100,
        laborOccupation: staticRate.soc,
      })
  }

  const pickState = async (next: string) => {
    setState(next)
    if (next === 'US') {
      setLiveRate(null)
      recost(staticRate.rate)
      return
    }
    setWageLoading(true)
    try {
      const res = await apiRequest('/api/integrations/bls/fetch-wage', {
        method: 'POST',
        body: JSON.stringify({ occupation: staticRate.soc, state: next }),
      })
      const d = await res.json()
      if (res.ok && d?.success && d.rate?.rateValue) {
        const r = Number(d.rate.rateValue)
        setLiveRate({ rate: r, source: `${d.rate.source} · ${next}` })
        recost(r)
      }
    } catch {
      // Network/BLS failure: keep the static national rate in place.
    } finally {
      setWageLoading(false)
    }
  }

  return (
    <div
      style={{
        marginBottom: 10,
        padding: '8px 10px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
        Labor = hours × rate
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Hours
          </label>
          <input
            className="input mono"
            type="number"
            step="any"
            style={{ height: 28, fontSize: 12, width: 66 }}
            value={hoursVal ?? ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              onChange({
                laborHours: e.target.value === '' ? undefined : Number(e.target.value),
                laborOccupation: staticRate.soc,
                laborCost:
                  e.target.value === ''
                    ? editFormData.laborCost
                    : Math.round(Number(e.target.value) * rate * 100) / 100,
              })
            }
            aria-label="Labor hours"
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>×</div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Rate ($/h)
          </label>
          <div
            className="mono"
            style={{ fontSize: 12, height: 28, display: 'flex', alignItems: 'center' }}
            title={rateLabel}
          >
            {wageLoading ? '…' : `$${rate.toFixed(2)}`}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>=</div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Labor cost
          </label>
          <div
            className="mono"
            style={{
              fontSize: 12,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
            }}
          >
            {computed != null ? `$${computed.toFixed(2)}` : '—'}
          </div>
        </div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>
            Location
          </label>
          <select
            className="input"
            style={{ height: 28, fontSize: 11, width: 96 }}
            value={state}
            onChange={(e) => pickState(e.target.value)}
            aria-label="Wage location"
          >
            <option value="US">National</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        {rateLabel}. Edit hours or pick a state (live BLS wage); Save persists.
      </div>
    </div>
  )
}

// ─── Machine energy on a process step: run hours × rated kW × load = kWh ───────
// Every multiplicand is entered by the user (routing, nameplate, meter); the
// only reference value is the EIA electricity price, which stays editable. The
// kWh becomes an Electricity input flow, so the grid factor for the run's
// region turns it into emissions; its cost can fill the energy cost field.
function MachineEnergy({
  componentId,
  laborHours,
  onChange,
}: {
  componentId: string
  laborHours?: number
  onChange: (patch: Partial<InspectorEditFormData>) => void
}) {
  const [hours, setHours] = useState('')
  const [kw, setKw] = useState('')
  const [loadPct, setLoadPct] = useState('')
  const [price, setPrice] = useState(String(ENERGY_RATES.electricity_industrial.rate))
  const [machineRate, setMachineRate] = useState('')
  const [adding, setAdding] = useState(false)

  const h = Number(hours)
  const p = Number(kw)
  const l = Number(loadPct)
  const kwh = h > 0 && p > 0 && l > 0 ? Math.round(h * p * (l / 100) * 1000) / 1000 : null
  const energyCost =
    kwh != null && Number(price) > 0 ? Math.round(kwh * Number(price) * 100) / 100 : null
  const equipmentCost =
    h > 0 && Number(machineRate) > 0 ? Math.round(h * Number(machineRate) * 100) / 100 : null

  const addElectricityFlow = async () => {
    if (kwh == null) return
    setAdding(true)
    try {
      const subs = await apiRequest('/api/substances').then((r) => r.json())
      const elec = (subs?.substances ?? subs?.data ?? []).find(
        (s: any) => s.substance_name === 'Electricity',
      )
      if (!elec) throw new Error('No "Electricity" substance in the catalog')
      const res = await apiRequest(`/api/components/${componentId}/flows`, {
        method: 'POST',
        body: JSON.stringify({
          substance_id: elec.substance_id,
          flow_type: 'input',
          quantity: kwh,
          unit: 'kWh',
          driver_description: `Machine energy: ${h} h × ${p} kW × ${l}% load`,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Could not add the flow')
      }
      window.dispatchEvent(new Event('lcapix:flows-changed'))
      window.dispatchEvent(new Event('lcapix:components-changed'))
      toast.success(`Added ${kwh} kWh of electricity as an input`)
    } catch (e: any) {
      toast.error(e?.message || 'Could not add the flow')
    } finally {
      setAdding(false)
    }
  }

  const num = (value: string, set: (v: string) => void, label: string, placeholder: string) => (
    <div>
      <label className="label" style={{ fontSize: 10 }}>
        {label}
      </label>
      <input
        className="input mono"
        type="number"
        step="any"
        min={0}
        style={{ height: 28, fontSize: 12, width: 70 }}
        value={value}
        placeholder={placeholder}
        onFocus={(e) => e.target.select()}
        onChange={(e) => set(e.target.value)}
        aria-label={label}
      />
    </div>
  )
  const op = (s: string) => (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 6 }}>{s}</div>
  )

  return (
    <div
      style={{
        marginBottom: 10,
        padding: '8px 10px',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
        Machine energy = hours × kW × load
        <HelpTip label="How is machine energy worked out?">{ISO_HELP.machineEnergy}</HelpTip>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {num(hours, setHours, 'Run hours', laborHours != null ? `${laborHours}` : 'h')}
        {op('×')}
        {num(kw, setKw, 'Power (kW)', 'kW')}
        {op('×')}
        {num(loadPct, setLoadPct, 'Load (%)', '%')}
        {op('=')}
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, paddingBottom: 6 }}>
          {kwh != null ? `${kwh} kWh` : '— kWh'}
        </div>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 6 }}
      >
        {num(price, setPrice, 'Price ($/kWh)', '$/kWh')}
        {op('→')}
        <div className="mono" style={{ fontSize: 12, paddingBottom: 6 }}>
          {energyCost != null ? `$${energyCost.toFixed(2)} energy` : '—'}
        </div>
        {num(machineRate, setMachineRate, 'Machine $/h', 'optional')}
        {op('→')}
        <div className="mono" style={{ fontSize: 12, paddingBottom: 6 }}>
          {equipmentCost != null ? `$${equipmentCost.toFixed(2)} machine` : '—'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 11 }}
          disabled={kwh == null || adding}
          onClick={addElectricityFlow}
        >
          {adding ? 'Adding…' : 'Add kWh as electricity input'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
          disabled={energyCost == null}
          onClick={() => energyCost != null && onChange({ energyCost })}
        >
          Use as energy cost
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
          disabled={equipmentCost == null}
          onClick={() => equipmentCost != null && onChange({ equipmentCost })}
        >
          Use as machine cost
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        Price: {ENERGY_RATES.electricity_industrial.label} (EIA reference, {REFERENCE_VINTAGE}); edit
        it to match your bill. Costs save with Save.
      </div>
    </div>
  )
}

// ─── Inline "Suggest from integrations" — compact version for the right pane ───
// Pulls BLS / EIA / Metals-API defaults and lets the user one-click apply.

function InlineSuggestStrip({
  componentType,
  nodeName,
  flows,
  onApply,
}: {
  componentType: string
  nodeName?: string
  flows: InspectorFlow[]
  onApply: (s: {
    labor?: number
    energy?: number
    material?: number
    transportation?: number
  }) => void
}) {
  const [result, setResult] = useState<{
    lines: string[]
    notes: string[]
    payload: {
      labor?: number
      energy?: number
      material?: number
      transportation?: number
    }
  } | null>(null)
  const [applied, setApplied] = useState(false)

  // Grounded suggestion: cost the node's REAL flows — energy × the carrier's
  // rate, material mass × the ACTUAL material's rate, transport tonne-km ×
  // freight rate. Reference rates supply the rate only; the quantity is always
  // the real flow amount. Anything unpriceable is surfaced, never dropped.
  function suggest() {
    setApplied(false)
    const s = suggestCostsFromFlows(
      (flows || []).map((f) => ({
        substance: f.substance,
        dir: f.dir,
        amount: f.amount,
        unit: f.unit,
      })),
      { nodeName, nodeType: componentType },
    )
    setResult({
      lines: s.lines,
      notes: s.notes,
      payload: {
        labor: s.labor,
        energy: s.energy,
        material: s.material,
        transportation: s.transportation,
      },
    })
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
          Cost this step&apos;s flows from reference rates
          {' '}(BLS / EIA / USGS). Uses the real flow quantities.
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
            {result.payload.transportation != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>T</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.transportation.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          {result.lines.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {result.lines.map((ln, i) => (
                <div key={i}>{ln}</div>
              ))}
            </div>
          )}
          {result.notes.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                marginTop: 2,
              }}
            >
              {result.notes.map((n, i) => (
                <div key={i}>· {n}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {(result.payload.labor != null ||
              result.payload.energy != null ||
              result.payload.material != null ||
              result.payload.transportation != null) && (
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
            )}
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
