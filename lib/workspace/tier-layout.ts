/**
 * The case tree on five tier lanes (design/education/specs/canvas.md): each
 * step sits in its tier's lane (Product, Machine / line, Subprocess, Operation,
 * Elemental task), not at its depth; siblings sit on a 140px pitch with a
 * parent centred over its children; connectors are elbows (down, a horizontal
 * bus, down), never diagonal. Pure, so the layout is tested without a browser.
 */

export const TIERS = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_LABEL: Record<Tier, string> = {
  product: 'Product',
  machine_line: 'Machine / line',
  subprocess: 'Subprocess',
  operation: 'Operation',
  elemental_task: 'Elemental task',
}

/** canvas.md "Tier fill / border / ink". */
export const TIER_COLOURS: Record<Tier, { fill: string; border: string; ink: string }> = {
  product: { fill: '#A7D3B8', border: '#3D7256', ink: '#16331F' },
  machine_line: { fill: '#F0A68A', border: '#A8472B', ink: '#3A1A0F' },
  subprocess: { fill: '#F5C971', border: '#8A6414', ink: '#3A2A0A' },
  operation: { fill: '#7BB5E8', border: '#356DA0', ink: '#0F2238' },
  elemental_task: { fill: '#C8B5E8', border: '#7C61B5', ink: '#1F1438' },
}

export const LANE_H = 120
export const LANE_TOP = 40 // room for the canvas's own top bar
export const NODE_W = 128
export const NODE_H = 72
export const PITCH = 140
const CARD_OFFSET = 30 // a step's top inside its lane (the lane label sits above it)
const PAD_X = 40
const RADIUS = 6

export interface TreeStep {
  id: number
  parentId: number | null
  type?: string | null
  level?: number | null
}

export interface PlacedStep {
  id: number
  parentId: number | null
  tier: Tier
  lane: number
  x: number
  y: number
  w: number
  h: number
}

export interface TierLayout {
  steps: PlacedStep[]
  edges: Array<{ from: number; to: number; path: string }>
  lanes: Array<{ tier: Tier; y: number; h: number }>
  width: number
  height: number
}

export function tierOf(s: Pick<TreeStep, 'type' | 'level'>): Tier {
  if (s.type && (TIERS as readonly string[]).includes(s.type)) return s.type as Tier
  const i = Math.min(Math.max(Number(s.level ?? 1) - 1, 0), TIERS.length - 1)
  return TIERS[i]
}

/**
 * Lay a case's steps out on the lanes. `steps` keep their sibling order (the
 * order given). A step whose tier is not below its parent's (data from before
 * tiers were enforced) goes one lane below the parent, so the tree still
 * reads top down.
 */
export function layoutOnLanes(steps: TreeStep[]): TierLayout {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const children = new Map<number | null, TreeStep[]>()
  for (const s of steps) {
    const p = s.parentId != null && byId.has(s.parentId) ? s.parentId : null
    if (!children.has(p)) children.set(p, [])
    children.get(p)!.push(s)
  }

  // Lanes: by tier, never above (or on) the parent's lane.
  const lane = new Map<number, number>()
  const assignLane = (s: TreeStep, parentLane: number) => {
    const own = TIERS.indexOf(tierOf(s))
    const l = Math.max(own, parentLane + 1)
    lane.set(s.id, l)
    for (const c of children.get(s.id) ?? []) assignLane(c, l)
  }
  for (const r of children.get(null) ?? []) assignLane(r, -1)

  // x: leaves on consecutive slots, a parent centred over its children.
  const centre = new Map<number, number>()
  let nextSlot = 0
  const place = (s: TreeStep): number => {
    const kids = children.get(s.id) ?? []
    if (!kids.length) {
      const x = PAD_X + nextSlot * PITCH + NODE_W / 2
      nextSlot += 1
      centre.set(s.id, x)
      return x
    }
    const xs = kids.map(place)
    const x = (xs[0] + xs[xs.length - 1]) / 2
    centre.set(s.id, x)
    return x
  }
  for (const r of children.get(null) ?? []) {
    place(r)
    nextSlot += 0.5 // a little air between separate roots
  }

  const laneCount = Math.max(TIERS.length, ...[...lane.values()].map((l) => l + 1))
  const laneY = (l: number) => LANE_TOP + l * LANE_H
  const placed: PlacedStep[] = steps
    .filter((s) => lane.has(s.id))
    .map((s) => {
      const l = lane.get(s.id)!
      return {
        id: s.id,
        parentId: s.parentId != null && byId.has(s.parentId) ? s.parentId : null,
        tier: tierOf(s),
        lane: l,
        x: centre.get(s.id)! - NODE_W / 2,
        y: laneY(l) + CARD_OFFSET,
        w: NODE_W,
        h: NODE_H,
      }
    })

  const at = new Map(placed.map((p) => [p.id, p]))
  const edges: TierLayout['edges'] = []
  for (const p of placed) {
    if (p.parentId == null) continue
    const parent = at.get(p.parentId)
    if (!parent) continue
    edges.push({ from: parent.id, to: p.id, path: elbow(parent, p) })
  }

  const width = Math.max(PAD_X * 2 + NODE_W, ...placed.map((p) => p.x + p.w + PAD_X))
  return {
    steps: placed,
    edges,
    lanes: Array.from({ length: laneCount }, (_, l) => ({ tier: TIERS[Math.min(l, TIERS.length - 1)], y: laneY(l), h: LANE_H })),
    width: Math.ceil(width),
    height: laneY(laneCount),
  }
}

/** Down from the parent's bottom centre, along a bus, down into the child's top centre. */
export function elbow(parent: { x: number; y: number; w: number; h: number }, child: { x: number; y: number; w: number }): string {
  const px = parent.x + parent.w / 2
  const py = parent.y + parent.h
  const cx = child.x + child.w / 2
  const cy = child.y
  const bus = py + Math.max(8, (cy - py) / 2)
  if (Math.abs(px - cx) < 0.5) return `M${px},${py} V${cy}`
  const dir = cx > px ? 1 : -1
  const r = Math.min(RADIUS, Math.abs(cx - px) / 2, (bus - py), (cy - bus))
  return [
    `M${px},${py}`,
    `V${bus - r}`,
    `Q${px},${bus} ${px + dir * r},${bus}`,
    `H${cx - dir * r}`,
    `Q${cx},${bus} ${cx},${bus + r}`,
    `V${cy}`,
  ].join(' ')
}

/** Zoom floors at 86%: below that a step's text would go under 12px. */
export const ZOOM_FLOOR = 0.86
export const ZOOM_CEIL = 1.6

/** Fit the tree into the space the panel leaves free; never below the floor (it pans instead). */
export function fitScale(layout: Pick<TierLayout, 'width' | 'height'>, free: { width: number; height: number }): number {
  const s = Math.min(free.width / layout.width, free.height / layout.height, 1)
  return Math.max(ZOOM_FLOOR, Math.min(ZOOM_CEIL, Number.isFinite(s) ? s : 1))
}

/**
 * The step an arrow key moves to (canvas.md: the tree is one Tab stop):
 * Up the parent, Down the first child, Left/Right the next step in the same
 * lane, Home the first root, End the last step. Null: stay.
 */
export function moveFrom(layout: Pick<TierLayout, 'steps'>, fromId: number | null, key: string): number | null {
  const steps = layout.steps
  if (!steps.length) return null
  if (fromId == null || !steps.some((s) => s.id === fromId)) return key.startsWith('Arrow') || key === 'Home' ? steps[0].id : null
  const from = steps.find((s) => s.id === fromId)!
  if (key === 'ArrowUp') return from.parentId
  if (key === 'ArrowDown') {
    const kids = steps.filter((s) => s.parentId === from.id).sort((a, b) => a.x - b.x)
    return kids[0]?.id ?? null
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const row = steps.filter((s) => s.lane === from.lane).sort((a, b) => a.x - b.x)
    const i = row.findIndex((s) => s.id === from.id)
    const j = key === 'ArrowLeft' ? i - 1 : i + 1
    return row[j]?.id ?? null
  }
  if (key === 'Home') return [...steps].sort((a, b) => a.lane - b.lane || a.x - b.x)[0].id
  if (key === 'End') return [...steps].sort((a, b) => b.lane - a.lane || b.x - a.x)[0].id
  return null
}
