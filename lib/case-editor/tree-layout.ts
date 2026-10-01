// The Tree canvas's geometry: a tidy-ish top-to-bottom layout of the case
// tree, fitting it to the viewport, zooming around a point, the edge curves,
// and the roll-up line on each card. Pure numbers; the canvas renders them.

import type { CaseTreeNode } from '@/lib/case-tree-adapter-types'

export const NODE_W = 220
export const NODE_H = 72
export const COL_W = NODE_W + 40 // horizontal gap between sibling columns
export const ROW_GAP = 80 // vertical gap between depth rows

/** Zoom limits (guardrails §5): 0.25–3; a fit stays within 0.35–1.2. */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.15

export interface NodePos {
  x: number
  y: number
}

export interface LaidOut {
  id: string
  node: CaseTreeNode
  depth: number
  parentId: string | null
}

export interface Transform {
  x: number
  y: number
  k: number
}

/**
 * Leaves take the next column left to right; a parent sits centred over its
 * first and last child; rows are by depth. The synthetic multi-root
 * container ('__root__') is not drawn: its children are an independent
 * forest of top-level nodes (no fake "Case Root" parent).
 */
export function layoutTree(root: CaseTreeNode) {
  const nodes: LaidOut[] = []
  const parentOf: Record<string, string | null> = {}
  let colCursor = 0
  const xById: Record<string, number> = {}

  const walk = (n: CaseTreeNode, depth: number, parentId: string | null): number => {
    nodes.push({ id: n.id, node: n, depth, parentId })
    parentOf[n.id] = parentId
    const kids = n.children || []
    if (kids.length === 0) {
      const x = colCursor * COL_W
      xById[n.id] = x
      colCursor += 1
      return x
    }
    const childXs = kids.map((c) => walk(c, depth + 1, n.id))
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2
    xById[n.id] = x
    return x
  }
  if (root.id === '__root__') {
    ;(root.children || []).forEach((c) => walk(c, 0, null))
  } else {
    walk(root, 0, null)
  }

  const positions: Record<string, NodePos> = {}
  let maxX = 0
  let maxY = 0
  for (const n of nodes) {
    const x = xById[n.id] || 0
    const y = n.depth * (NODE_H + ROW_GAP)
    positions[n.id] = { x, y }
    if (x + NODE_W > maxX) maxX = x + NODE_W
    if (y + NODE_H > maxY) maxY = y + NODE_H
  }
  return {
    initialPositions: positions,
    nodes,
    parentOf,
    bounds: { w: maxX, h: maxY },
  }
}

/** Keep dragged positions for nodes that still exist; new nodes take their laid-out place. */
export function resyncPositions(
  prev: Record<string, NodePos>,
  nodes: LaidOut[],
  initialPositions: Record<string, NodePos>,
): Record<string, NodePos> {
  const next: Record<string, NodePos> = {}
  for (const n of nodes) {
    next[n.id] = prev[n.id] ?? initialPositions[n.id]
  }
  return next
}

/** Centre the tree in a viewport, scaled to fit (never above 1.2, clamped 0.35–2); null if the viewport is too small to measure. */
export function fitTransform(rect: { width: number; height: number }, bounds: { w: number; h: number }): Transform | null {
  if (rect.width < 50 || rect.height < 50) return null
  const padding = 60
  const w = Math.max(bounds.w, 1)
  const h = Math.max(bounds.h, 1)
  const k = Math.min((rect.width - padding * 2) / w, (rect.height - padding * 2) / h, 1.2)
  const kFinal = Math.max(0.35, Math.min(2, k))
  return {
    x: (rect.width - w * kFinal) / 2,
    y: (rect.height - h * kFinal) / 2,
    k: kFinal,
  }
}

/** Ctrl/⌘ + wheel (or pinch): zoom around the cursor, keeping the point under it fixed. */
export function zoomAt(t: Transform, cx: number, cy: number, deltaY: number): Transform {
  const delta = -deltaY * 0.0015
  const newK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, t.k * (1 + delta)))
  const scale = newK / t.k
  const nx = cx - (cx - t.x) * scale
  const ny = cy - (cy - t.y) * scale
  return { x: nx, y: ny, k: newK }
}

export const zoomOut = (t: Transform): Transform => ({ ...t, k: Math.max(ZOOM_MIN, t.k - ZOOM_STEP) })
export const zoomIn = (t: Transform): Transform => ({ ...t, k: Math.min(ZOOM_MAX, t.k + ZOOM_STEP) })

/** The curve from a parent's bottom centre to a child's top centre (the edge SVG is offset by 200). */
export function edgePath(a: NodePos, b: NodePos): string {
  const ax = a.x + NODE_W / 2 + 200
  const ay = a.y + NODE_H + 200
  const bx = b.x + NODE_W / 2 + 200
  const by = b.y + 200
  const my = (ay + by) / 2
  return `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`
}

/** A card's roll-up line: "Σ $1,234 · 3 flows" for a parent, "$12 · 1 flow" for a leaf. */
export function rollupLine(r: { cost: number; flows: number }, hasKids: boolean): string {
  return `${hasKids ? 'Σ ' : ''}$${Math.round(r.cost).toLocaleString()}${
    r.flows > 0 ? ` · ${r.flows} flow${r.flows === 1 ? '' : 's'}` : ''
  }`
}

/** The canvas search: a node matches by label or id, case-insensitively; '' matches nothing. */
export function matchesQuery(node: { id: string; label?: string }, normalizedQuery: string): boolean {
  return (
    normalizedQuery.length > 0 &&
    !!(node.label?.toLowerCase().includes(normalizedQuery) || node.id.toLowerCase().includes(normalizedQuery))
  )
}
