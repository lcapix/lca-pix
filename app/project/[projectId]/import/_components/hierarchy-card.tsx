'use client'

import { fmtNum } from '@/components/lcapix/formatters'
import type { IngestPlan } from '@/lib/ingest/maplca'
import { TIER_LABEL, costsByStep, documentCostTotal, tierDepth } from '@/lib/import/display'
import { stepActionValue, type NodeEdit, type StepAction } from '@/lib/import/node-edits'
import type { TargetComponent } from '@/lib/import/placement-suggestions'

/**
 * The extracted step tree, editable before anything is created: tier, name,
 * parent and quantity per step. Appending, each step also shows what happens
 * to it against the case's own steps (attach / create / skip) and why, so a
 * second routing merges instead of duplicating every step. Each step's cost
 * from the document sits beside it, and the document's total by the heading,
 * so the money is read with the model rather than in a separate table.
 */
export function HierarchyCard({
  nodes,
  costs,
  appending,
  nodeEdits,
  onNodeEdit,
  stepActions,
  onStepAction,
  targetComponents,
}: {
  nodes: IngestPlan['nodes']
  costs: IngestPlan['costs']
  appending: boolean
  nodeEdits: Record<string, NodeEdit>
  onNodeEdit: (originalName: string, patch: NodeEdit) => void
  stepActions: Record<string, StepAction>
  onStepAction: (originalName: string, value: string) => void
  targetComponents: TargetComponent[]
}) {
  if (nodes.length === 0) return null
  const byStep = costsByStep(costs)
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        HIERARCHY · {nodes.length} NODES
        {costs.length > 0 ? ` · $${fmtNum(documentCostTotal(costs))} of cost in this document` : ''}
        {appending ? ' · matched against the case' : ''}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {appending
          ? 'Each step below was matched against the steps this case already has. Attach keeps the existing step and adds to it; create makes a new one; skip leaves it out. Check the reason before you apply.'
          : 'Everything here is editable before it is created. The tier is a label, not a rule: put a step under whichever parent reflects how the plant actually runs.'}
      </div>
      {nodes.map((n) => {
        const ed = nodeEdits[n.name] ?? {}
        const tier = ed.tier ?? n.tier
        const own = byStep.get(n.name)
        return (
          <div
            key={n.name}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', marginLeft: tierDepth(tier) * 18, fontSize: 12.5, flexWrap: 'wrap' }}
          >
            <select
              className="input"
              style={{ height: 24, fontSize: 10.5, width: 112 }}
              value={tier}
              onChange={(e) => onNodeEdit(n.name, { tier: e.target.value })}
              aria-label={`Tier of ${n.name}`}
              title="What this level is called. Nomenclature only: it does not change the maths."
            >
              {Object.entries(TIER_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ height: 24, fontSize: 12, flex: 1, minWidth: 120 }}
              value={ed.name ?? n.name}
              onChange={(e) => onNodeEdit(n.name, { name: e.target.value })}
              aria-label={`Name of ${n.name}`}
              title="The step's name. Renaming it here keeps every flow and cost attached to it."
            />
            <select
              className="input"
              style={{ height: 24, fontSize: 10.5, width: 150 }}
              value={(ed.parent !== undefined ? ed.parent : n.parent) ?? ''}
              onChange={(e) => onNodeEdit(n.name, { parent: e.target.value || null })}
              aria-label={`Parent of ${n.name}`}
              title="Which step this one sits under."
            >
              <option value="">(no parent: top)</option>
              {nodes
                .filter((o) => o.name !== n.name)
                .map((o) => (
                  <option key={o.name} value={o.name}>
                    {nodeEdits[o.name]?.name ?? o.name}
                  </option>
                ))}
            </select>
            {n.quantity != null && (
              <>
                <input
                  className="input mono"
                  style={{ height: 24, fontSize: 11, width: 78 }}
                  value={ed.quantity ?? String(n.quantity)}
                  onChange={(e) => onNodeEdit(n.name, { quantity: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Quantity of ${n.name}`}
                  title="How many this step makes or handles."
                />
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{n.unit}</span>
              </>
            )}
            {own && own.total > 0 && (
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: 'color-mix(in oklab, var(--brand-primary) 10%, transparent)',
                  color: 'var(--brand-primary)',
                  whiteSpace: 'nowrap',
                }}
                title={`${own.kinds}, from this document. Costs roll up to the steps above.`}
              >
                ${fmtNum(own.total)}
              </span>
            )}
            {appending && (
              <>
                <select
                  className="input"
                  style={{ height: 24, fontSize: 10.5, width: 190 }}
                  value={stepActionValue(stepActions[n.name])}
                  onChange={(e) => onStepAction(n.name, e.target.value)}
                  aria-label={`What happens to ${n.name}`}
                >
                  <option value="create">Create this step</option>
                  <option value="skip">Skip it</option>
                  {targetComponents.map((c) => (
                    <option key={c.component_id} value={`attach:${c.component_id}`}>
                      Attach to: {c.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {stepActions[n.name]?.reason ?? ''}
                </span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
