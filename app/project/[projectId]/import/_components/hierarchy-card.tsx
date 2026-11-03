'use client'

import { useState } from 'react'
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
 *
 * Open on arrival, so a step read wrong can be changed straight away
 * (Shreya, 2026-11-02: closed, the controls looked gone); "Close the steps"
 * folds it to a one-line summary. The page shows it for a routing or a new
 * case only; a bill of materials or an equipment list added to a case keeps
 * the suggested decisions without showing them.
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
  const [open, setOpen] = useState(true)
  if (nodes.length === 0) return null
  const byStep = costsByStep(costs)
  const decided = appending
    ? nodes.reduce(
        (acc, n) => {
          const a = stepActions[n.name]?.action ?? 'skip'
          acc[a === 'attach' ? 'attach' : a === 'create' ? 'create' : 'skip']++
          return acc
        },
        { attach: 0, create: 0, skip: 0 },
      )
    : null
  const summary = [
    `${nodes.length} ${nodes.length === 1 ? 'step' : 'steps'} in this file`,
    costs.length > 0 ? `$${fmtNum(documentCostTotal(costs))} of cost` : null,
    decided ? `${decided.attach} matched to this case's steps, ${decided.create} new, ${decided.skip} skipped` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="card ip-steps-summary" style={{ padding: open ? 20 : '14px 20px' }} aria-labelledby="ip-steps-h">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="ip-steps-h" className="eyebrow" style={{ fontSize: 10, margin: 0, flex: 1, minWidth: 200 }}>
          The steps
        </h2>
        <button type="button" className="ds-link" style={{ fontWeight: 600 }} aria-expanded={open} aria-controls="ip-steps-edit" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close the steps' : 'Edit the steps'}
        </button>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ds-text-2)' }}>{summary}</p>
      {open && (
      <div id="ip-steps-edit" style={{ marginTop: 12 }}>
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
      )}
    </section>
  )
}
