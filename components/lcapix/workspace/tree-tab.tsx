'use client'

// The Tree tab (canvas.md, E03, E03b, E03c, E14): five tier lanes, elbow
// connectors, 128×72 steps, the floating step panel, keyboard (one Tab stop:
// arrows move, Enter opens, M opens the step menu), zoom with an 86% floor,
// Fit into the space the panel leaves, the Impact · Cost switch, the legend
// and the Magic Insights pill.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Segmented, TextDialog, ConfirmDialog } from '@/components/lcapix/ds'
import { caseTotal, fixed, money, share } from '@/lib/ui/format'
import { NODE_H, NODE_W, TIER_COLOURS, TIER_LABEL, TIERS, fitScale, moveFrom, ZOOM_CEIL, ZOOM_FLOOR, type Tier } from '@/lib/workspace/tier-layout'
import { stepKicker, stepSubLine } from '@/lib/workspace/step-text'
import type { WorkspaceCase, WorkspaceInventory, WorkspaceStep } from '@/lib/workspace/use-workspace'
import type { TierLayout } from '@/lib/workspace/tier-layout'
import { StepPanel } from './step-panel'
import { useStepActions } from './step-actions'
import { EmptyTree } from './empty-tree'

export type TreeView = 'impact' | 'cost'

const TIER_ICON: Record<Tier, string> = {
  product: 'M5 8.5 12 5l7 3.5v7L12 19l-7-3.5z',
  machine_line: 'M4 19V9l5 3V9l5 3V6h6v13z',
  subprocess: 'M4 8h16v3H4zM4 13h16v3H4z',
  operation: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  elemental_task: 'M5 6h14v12H5zM8 10h8M8 14h5',
}

function TierGlyph({ tier, size = 12 }: { tier: Tier; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={TIER_COLOURS[tier].ink} strokeWidth="2" aria-hidden>
      <path d={TIER_ICON[tier]} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const PANEL_W = 420
const PANEL_GAP = 32

/** Each step's own cost and the sum of its subtree (the Cost view's chips, in cents). */
export function costRollups(steps: WorkspaceStep[]): Map<number, { own: number; total: number }> {
  const own = new Map(steps.map((s) => [s.id, Object.values(s.costs).reduce<number>((t, v) => t + (v ?? 0), 0)]))
  const kids = new Map<number, number[]>()
  for (const s of steps) if (s.parentId != null) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s.id])
  const out = new Map<number, { own: number; total: number }>()
  const total = (id: number, seen = new Set<number>()): number => {
    if (seen.has(id)) return 0
    seen.add(id)
    const t = (own.get(id) ?? 0) + (kids.get(id) ?? []).reduce((a, k) => a + total(k, seen), 0)
    out.set(id, { own: own.get(id) ?? 0, total: t })
    return t
  }
  for (const s of steps) if (!out.has(s.id)) total(s.id)
  return out
}

/** Each step's climate impact including the steps below it. */
export function impactRollups(steps: WorkspaceStep[], inv: WorkspaceInventory | null): Map<number, number> {
  const own = new Map((inv?.steps ?? []).map((s) => [s.component_id, s.climate]))
  const kids = new Map<number, number[]>()
  for (const s of steps) if (s.parentId != null) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s.id])
  const out = new Map<number, number>()
  const total = (id: number, seen = new Set<number>()): number => {
    if (seen.has(id)) return 0
    seen.add(id)
    const t = (own.get(id) ?? 0) + (kids.get(id) ?? []).reduce((a, k) => a + total(k, seen), 0)
    out.set(id, t)
    return t
  }
  for (const s of steps) if (!out.has(s.id)) total(s.id)
  return out
}

export function TreeTab({
  kase,
  steps,
  layout,
  inventory,
  readOnly,
  panelHidden,
  view,
  onView,
  onOpenInsights,
  runValues = null,
  resultsPanel,
  projectName = null,
}: {
  kase: WorkspaceCase
  steps: WorkspaceStep[]
  layout: TierLayout
  inventory: WorkspaceInventory | null
  readOnly: boolean
  panelHidden: boolean
  view: TreeView
  onView: (v: TreeView) => void
  onOpenInsights: () => void
  /** Results tab: the run's value per step (its subtree) and total; chips read from it. */
  runValues?: { run_id: number; total: number; sums: Map<number, number> } | null
  /** Results tab: the panel beside the tree is the Results panel, not the step. */
  resultsPanel?: ReactNode
  /** The project's name: an empty case's product is named after it (F2.5). */
  projectName?: string | null
}) {
  const results = resultsPanel !== undefined
  const byId = useMemo(() => new Map(steps.map((s) => [s.id, s])), [steps])
  const rows = inventory?.rows ?? []
  const [selected, setSelected] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [announce, setAnnounce] = useState('')
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Select the product (or the first step) once the tree is there.
  useEffect(() => {
    if (selected == null && layout.steps.length) setSelected(layout.steps[0].id)
  }, [layout.steps, selected])

  const costs = useMemo(() => costRollups(steps), [steps])
  const impacts = useMemo(() => impactRollups(steps, inventory), [steps, inventory])
  const total = inventory?.climate?.value ?? 0

  // Fit into the space the panel leaves.
  const fit = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const free = { width: el.clientWidth - (panelHidden ? 32 : PANEL_W + PANEL_GAP + 16), height: el.clientHeight - 60 }
    setZoom(fitScale(layout, free))
  }, [layout, panelHidden])
  useEffect(() => {
    fit()
  }, [fit])

  const say = (id: number | null) => {
    const s = id != null ? byId.get(id) : null
    if (!s) return
    const parent = s.parentId != null ? byId.get(s.parentId)?.name ?? null : null
    setAnnounce(`${s.name}. ${stepKicker({ id: s.id, name: s.name, tier: s.tier }, parent)}. ${stepSubLine(s, rows).text}.`)
  }

  // The panel never covers the focused step: pan it into the free space.
  const reveal = useCallback(
    (id: number) => {
      const p = layout.steps.find((s) => s.id === id)
      const vp = viewportRef.current
      if (!p || !vp) return
      // The panel sits on the side it is docked to; the free space is the rest.
      const dockLeft = !panelHidden && canvasRef.current?.querySelector('.ws-panel')?.getAttribute('data-dock') === 'left'
      const freeLeft = dockLeft ? PANEL_W + PANEL_GAP : 0
      const freeRight = panelHidden || dockLeft ? vp.clientWidth : vp.clientWidth - PANEL_W - PANEL_GAP
      const left = p.x * zoom
      const right = (p.x + p.w) * zoom
      if (right - vp.scrollLeft > freeRight - 16) vp.scrollLeft = right - freeRight + 32
      else if (left - vp.scrollLeft < freeLeft + 16) vp.scrollLeft = Math.max(0, left - freeLeft - 32)
      const top = p.y * zoom
      const bottom = (p.y + p.h) * zoom
      if (bottom - vp.scrollTop > vp.clientHeight - 16) vp.scrollTop = bottom - vp.clientHeight + 32
      else if (top - vp.scrollTop < 56) vp.scrollTop = Math.max(0, top - 72)
    },
    [layout.steps, panelHidden, zoom],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (menuFor != null) return
    const from = focused ?? selected
    if (e.key === 'Enter' || e.key === ' ') {
      if (from != null) {
        e.preventDefault()
        setSelected(from)
        say(from)
      }
      return
    }
    if ((e.key === 'm' || e.key === 'M') && !readOnly && from != null) {
      e.preventDefault()
      setMenuFor(from)
      return
    }
    const next = moveFrom(layout, from, e.key)
    if (next != null) {
      e.preventDefault()
      setFocused(next)
      reveal(next)
      say(next)
    }
  }

  // A step just made is selected and takes the keyboard focus too, so M, Enter and the arrows act on it.
  const actions = useStepActions({
    kase,
    steps,
    onSelect: (id) => {
      setSelected(id)
      setFocused(id)
    },
  })
  const [renameFor, setRenameFor] = useState<number | null>(null)
  const [deleteFor, setDeleteFor] = useState<number | null>(null)

  if (!steps.length && !results) {
    return (
      <EmptyTree
        kase={kase}
        projectName={projectName}
        readOnly={readOnly}
        busy={actions.busy}
        error={actions.error}
        onAddFirst={(product, tier, name) => void actions.addFirst(product, tier, name)}
      />
    )
  }

  const stageW = layout.width * zoom
  const stageH = layout.height * zoom
  const flowCount = rows.length
  const edited = steps.reduce<string | null>((t, s) => (s.updated_at && (!t || s.updated_at > t) ? s.updated_at : t), null)

  return (
    <div ref={canvasRef} className="ws-canvas">
      <div className="ws-live" aria-live="polite">
        {announce}
      </div>

      <div className="ws-topbar">
        <span className="ws-info">
          <span>
            {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </span>
          <i aria-hidden />
          <span>
            {flowCount} {flowCount === 1 ? 'flow' : 'flows'}
          </span>
          {results ? (
            runValues && (
              <>
                <i aria-hidden />
                <span>Impact in kg CO₂-eq · shares from Run #{runValues.run_id}</span>
              </>
            )
          ) : (
            edited && (
              <>
                <i aria-hidden />
                <span>Edited {timeAgo(edited)}</span>
              </>
            )
          )}
        </span>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <span className="ws-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(ZOOM_FLOOR, +(z - 0.1).toFixed(2)))}>
              −
            </button>
            <output aria-live="polite">{Math.round(zoom * 100)}%</output>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(ZOOM_CEIL, +(z + 0.1).toFixed(2)))}>
              +
            </button>
            <button type="button" onClick={fit}>
              Fit
            </button>
          </span>
          {!results && (
            <Segmented
              label="Show on the steps"
              value={view}
              onChange={onView}
              options={[
                { value: 'impact', label: 'Impact' },
                { value: 'cost', label: 'Cost' },
              ]}
            />
          )}
          {!readOnly && (
            <button type="button" className="ws-add-step" onClick={() => actions.addBelow(selected ?? layout.steps[0]?.id ?? null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add step
            </button>
          )}
        </span>
      </div>

      {/* The tree is one Tab stop holding only its steps; the panel and controls sit outside it. */}
      <div
        ref={viewportRef}
        className="ws-viewport"
        role="tree"
        aria-label={`${kase.case_name} steps`}
        aria-activedescendant={focused != null ? `step-${focused}` : selected != null ? `step-${selected}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => focused == null && selected != null && setFocused(selected)}
      >
        <div style={{ width: stageW, height: stageH, position: 'relative' }}>
          <div className="ws-stage" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            {layout.lanes.map((l, i) => (
              <div key={i} className="ws-lane" style={{ top: l.y, height: l.h }} aria-hidden>
                <span className="ws-lane-label">
                  <span className="ws-swatch" style={{ background: TIER_COLOURS[l.tier].fill, borderColor: TIER_COLOURS[l.tier].border }} />
                  {TIER_LABEL[l.tier]}
                </span>
              </div>
            ))}
            <svg className="ws-edges" width={layout.width} height={layout.height} aria-hidden>
              {layout.edges.map((e) => (
                <path key={`${e.from}-${e.to}`} d={e.path} />
              ))}
            </svg>
            {layout.steps.map((p) => {
              const s = byId.get(p.id)!
              const live = stepSubLine(s, rows)
              const c = TIER_COLOURS[p.tier]
              // Results: an operation reads its run value and share ("1.538 · 89.4%", "no factor · 0%").
              const runOp = results && runValues && p.tier === 'operation' ? runValues.sums.get(p.id) ?? 0 : null
              const sub = runOp === null ? live : { ...live, text: runOp ? fixed(runOp, 3) : 'no factor' }
              const shownTotal = runValues ? Number(caseTotal(runValues.total, kase.case_type)) : 0
              const chip =
                runOp !== null
                  ? runOp
                    ? share(Number(fixed(runOp, 3)), shownTotal)
                    : '0%'
                  : results
                    ? null
                    : view === 'cost'
                  ? (() => {
                      const r = costs.get(p.id)
                      if (!r || r.total <= 0) return null
                      const hasKids = steps.some((x) => x.parentId === p.id)
                      return hasKids && r.total !== r.own ? `Σ ${money(r.total)}` : money(r.total)
                    })()
                  : p.tier === 'operation' && total > 0
                    ? share(impacts.get(p.id) ?? 0, total).replace(/\.\d%$/, '%')
                    : null
              return (
                <div
                  key={p.id}
                  id={`step-${p.id}`}
                  role="treeitem"
                  aria-level={p.lane + 1}
                  aria-selected={selected === p.id}
                  aria-label={`${s.name}, ${TIER_LABEL[p.tier]}${sub.needs ? ', needs an amount' : ''}`}
                  className="ws-step"
                  data-needs={sub.needs || undefined}
                  data-focus={focused === p.id || undefined}
                  style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, borderColor: sub.needs ? undefined : c.border }}
                  onClick={() => {
                    setSelected(p.id)
                    setFocused(p.id)
                    say(p.id)
                    viewportRef.current?.focus()
                  }}
                  onContextMenu={(e) => {
                    if (readOnly) return
                    e.preventDefault()
                    setSelected(p.id)
                    setMenuFor(p.id)
                  }}
                >
                  <div className="ws-step-row">
                    <span className="ws-step-tile" style={{ background: c.fill, borderColor: c.border }}>
                      <TierGlyph tier={p.tier} />
                    </span>
                    <span className="ws-step-name">{s.name}</span>
                    {sub.needs && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8F5B00" strokeWidth="2" aria-hidden>
                        <path d="M12 4 2.5 20h19z" strokeLinejoin="round" />
                        <path d="M12 10v4.5M12 17.5v.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <div className="ws-step-sub" data-needs={sub.needs || undefined}>
                    <span>{sub.text}</span>
                    {chip && <span className="ws-chip">{chip}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {menuFor != null && (
        <StepMenu
          step={byId.get(menuFor)!}
          steps={steps}
          anchor={layout.steps.find((s) => s.id === menuFor)!}
          zoom={zoom}
          viewport={viewportRef.current}
          onClose={() => {
            setMenuFor(null)
            viewportRef.current?.focus()
          }}
          onRename={() => setRenameFor(menuFor)}
          onMove={(parentId) => actions.move(menuFor, parentId)}
          onAddTask={() => actions.addBelow(menuFor)}
          onDelete={() => setDeleteFor(menuFor)}
        />
      )}

      <div className="ws-bottom">
        <Legend />
        <button type="button" className="ws-magic" onClick={onOpenInsights}>
          <span className="ws-magic-dot" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
            </svg>
          </span>
          Magic Insights
        </button>
      </div>
      {!readOnly && panelHidden && (
        <div className="ws-keys" aria-hidden>
          <span>
            <kbd>Tab</kbd>into the tree
          </span>
          <span>
            <kbd>Arrows</kbd>move between steps
          </span>
          <span>
            <kbd>Enter</kbd>opens the step
          </span>
          <span>
            <kbd>M</kbd>opens the step menu
          </span>
        </div>
      )}

      {!panelHidden && results && resultsPanel}
      {!panelHidden && !results && selected != null && byId.get(selected) && (
        <StepPanel
          key={selected}
          kase={kase}
          step={byId.get(selected)!}
          parent={byId.get(byId.get(selected)!.parentId ?? -1) ?? null}
          steps={steps}
          inventory={inventory}
          readOnly={readOnly}
          view={view}
          onView={onView}
        />
      )}

      <TextDialog
        open={renameFor != null}
        title="Rename step"
        label="Name"
        initial={renameFor != null ? byId.get(renameFor)?.name ?? '' : ''}
        busy={actions.busy}
        error={actions.error}
        onCancel={() => setRenameFor(null)}
        onSubmit={async (name) => {
          if (renameFor != null && (await actions.rename(renameFor, name))) setRenameFor(null)
        }}
      />
      <ConfirmDialog
        open={deleteFor != null}
        title="Delete this step?"
        consequence={
          deleteFor != null
            ? `${byId.get(deleteFor)?.name ?? 'This step'}, its flows and every step below it are deleted.`
            : ''
        }
        confirmLabel="Delete step"
        busy={actions.busy}
        onCancel={() => setDeleteFor(null)}
        onConfirm={async () => {
          if (deleteFor != null && (await actions.remove(deleteFor))) {
            setDeleteFor(null)
            setSelected(null)
          }
        }}
      >
        {actions.error && <p className="ds-dialog-body" style={{ color: 'var(--ds-error)' }}>{actions.error}</p>}
      </ConfirmDialog>
    </div>
  )
}

function Legend() {
  const [open, setOpen] = useState(false)
  return (
    <div className="ws-legend">
      {open && (
        <ul>
          {TIERS.map((t) => (
            <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ws-swatch" style={{ background: TIER_COLOURS[t].fill, borderColor: TIER_COLOURS[t].border }} />
              {TIER_LABEL[t]}
            </li>
          ))}
        </ul>
      )}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Process tiers
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}

/** The step menu (E03c): Rename, Move to…, Add a task below, Delete step. */
function StepMenu({
  step,
  steps,
  anchor,
  zoom,
  viewport,
  onClose,
  onRename,
  onMove,
  onAddTask,
  onDelete,
}: {
  step: WorkspaceStep
  steps: WorkspaceStep[]
  anchor: { x: number; y: number; w: number; h: number }
  zoom: number
  viewport: HTMLDivElement | null
  onClose: () => void
  onRename: () => void
  onMove: (parentId: number) => void
  onAddTask: () => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [moving, setMoving] = useState(false)
  const parent = steps.find((s) => s.id === step.parentId) ?? null
  // Move under any step of the current parent's tier (the step's own subtree excluded).
  const below = new Set<number>()
  const mark = (id: number) => {
    below.add(id)
    for (const s of steps) if (s.parentId === id) mark(s.id)
  }
  mark(step.id)
  const targets = parent ? steps.filter((s) => s.tier === parent.tier && !below.has(s.id)) : []

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role=menuitem],[role=menuitemradio]')?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (moving) setMoving(false)
        else onClose()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem],[role=menuitemradio]') ?? [])
        const i = items.indexOf(document.activeElement as HTMLElement)
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
        next?.focus()
      }
    }
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [moving, onClose])

  const left = anchor.x * zoom - (viewport?.scrollLeft ?? 0) + anchor.w * zoom + 8
  const top = anchor.y * zoom - (viewport?.scrollTop ?? 0) + 8
  const item = (label: string, onClick: () => void, opts: { danger?: boolean; sub?: boolean } = {}) => (
    <button type="button" role="menuitem" className={opts.danger ? 'danger' : undefined} aria-haspopup={opts.sub ? 'menu' : undefined} onClick={onClick}>
      {label}
      {opts.sub && <span style={{ marginLeft: 'auto' }}>›</span>}
    </button>
  )
  return (
    <div ref={ref} className="ws-menu" role="menu" aria-label={`${step.name} menu`} style={{ left, top }}>
      {!moving ? (
        <>
          {item('Rename', () => {
            onClose()
            onRename()
          })}
          {parent && targets.length > 1 && item('Move to…', () => setMoving(true), { sub: true })}
          {item('Add a task below', () => {
            onClose()
            onAddTask()
          })}
          {step.parentId != null &&
            item(
              'Delete step',
              () => {
                onClose()
                onDelete()
              },
              { danger: true },
            )}
        </>
      ) : (
        <>
          <div className="ds-section-label" style={{ padding: '6px 12px' }}>
            Move under
          </div>
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === step.parentId}
              onClick={() => {
                onClose()
                if (t.id !== step.parentId) onMove(t.id)
              }}
            >
              <span className="ws-swatch" style={{ background: TIER_COLOURS[t.tier].fill, borderColor: TIER_COLOURS[t.tier].border }} />
              <span style={{ flex: 1 }}>{t.name}</span>
              {t.id === step.parentId && <span style={{ fontSize: 13, color: 'var(--ds-text-3)' }}>Now ✓</span>}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

export function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (!t) return ''
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

