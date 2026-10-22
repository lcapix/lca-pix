'use client'

// An empty case on its Tree tab (F2.5): the five tier lanes, the product as a
// dashed placeholder (named after the project, with its functional unit),
// "Add the first step under the product" (pick its tier, then a name), and
// the Start here panel: build the tree top down, then give each step its
// flows, then run; or add a file instead.

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/lcapix/ds'
import { TIER_COLOURS, TIER_LABEL, TIERS, type Tier } from '@/lib/workspace/tier-layout'
import type { WorkspaceCase } from '@/lib/workspace/use-workspace'

const FIRST_TIERS: Tier[] = ['machine_line', 'subprocess', 'operation', 'elemental_task']

export function EmptyTree({
  kase,
  projectName,
  readOnly,
  busy,
  error,
  onAddFirst,
}: {
  kase: WorkspaceCase
  projectName: string | null
  readOnly: boolean
  busy: boolean
  error: string | null
  onAddFirst: (productName: string, tier: Tier, name: string) => void
}) {
  const [tier, setTier] = useState<Tier>('machine_line')
  const [name, setName] = useState('')
  const product = projectName || kase.case_name
  const fu = kase.project_functional_unit?.trim() || null
  const add = () => name.trim() && onAddFirst(product, tier, name.trim())

  return (
    <div className="ws-empty">
      <div className="ws-canvas ws-empty-canvas">
        <div className="ws-topbar">
          <span className="ws-info">
            <span>0 steps</span>
            <i aria-hidden />
            <span>0 flows</span>
          </span>
        </div>
        {TIERS.map((t, i) => (
          <div key={t} className="ws-lane" style={{ top: 40 + i * 120, height: 120 }} aria-hidden>
            <span className="ws-lane-label">
              <span className="ws-swatch" style={{ background: TIER_COLOURS[t].fill, borderColor: TIER_COLOURS[t].border }} />
              {TIER_LABEL[t]}
            </span>
          </div>
        ))}
        <div className="ws-empty-product">
          <strong>{product}</strong>
          <span>{fu ?? 'The product this case is about'}</span>
        </div>
        {!readOnly && (
          <form
            className="ws-empty-card"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
            aria-labelledby="first-step-h"
          >
            <span style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 220 }}>
                <strong id="first-step-h" style={{ display: 'block', fontSize: 17 }}>
                  Add the first step under the product
                </strong>
                <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>Pick its tier, then give it a name.</span>
              </span>
              <Button type="submit" variant="dark" busy={busy} disabled={!name.trim()} disabledReason={name.trim() ? undefined : 'Name it first'}>
                + Add step
              </Button>
            </span>
            <span className="ws-pills" role="radiogroup" aria-label="Tier of the first step">
              {FIRST_TIERS.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tier === t} className="ws-tier-chip" data-on={tier === t || undefined} onClick={() => setTier(t)}>
                  {tier === t && <span aria-hidden>✓</span>}
                  <span className="ws-swatch" style={{ background: TIER_COLOURS[t].fill, borderColor: TIER_COLOURS[t].border }} aria-hidden />
                  {TIER_LABEL[t]}
                </button>
              ))}
            </span>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="ds-label" style={{ marginBottom: 0 }}>
                Name of the {TIER_LABEL[tier].toLowerCase()}
              </span>
              <input className="ds-input" value={name} maxLength={255} placeholder={tier === 'machine_line' ? 'e.g. Sheet line' : 'e.g. 10. Laser cut'} onChange={(e) => setName(e.target.value)} />
            </label>
            {error && (
              <span role="alert" style={{ fontSize: 13, color: 'var(--ds-error)' }}>
                {error}
              </span>
            )}
          </form>
        )}
      </div>

      <aside className="ws-start" aria-labelledby="start-h">
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--ds-line-soft)' }}>
          <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
            Start here
          </span>
          <h2 id="start-h" style={{ margin: '6px 0 6px', fontSize: 22, fontWeight: 600 }}>
            Build the tree for {fu ?? 'one unit'}
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--ds-text-2)' }}>Top down: the product, the lines that make it, then their steps.</p>
        </div>
        <ol className="ip-walk-list" style={{ padding: '6px 24px' }}>
          <li>
            <strong>Add a machine or line</strong>
            <span>The first step under {product}. One card for each line that makes it.</span>
          </li>
          <li>
            <strong>Add steps under it</strong>
            <span>Subprocesses, operations and tasks, in the order the plant runs them.</span>
          </li>
          <li>
            <strong>Give each step its flows</strong>
            <span>What goes in and comes out, with an amount: material, energy, waste.</span>
          </li>
        </ol>
        <p style={{ margin: 0, padding: '14px 24px 6px', fontSize: 15, color: 'var(--ds-text-2)' }}>Then run the case. Your first answer comes from that run.</p>
        {!readOnly && (
          <p style={{ margin: 0, padding: '8px 24px 18px' }}>
            <Link className="ds-link" style={{ fontWeight: 600 }} href={`/project/${kase.project_id}/import?case=${kase.case_id}`}>
              Or add a file instead
            </Link>
          </p>
        )}
      </aside>
    </div>
  )
}
