/**
 * Placement rules for a case's process tree, shared by the component routes
 * and the case-copy code. Pure: callers load the case's rows and write the
 * result, so the rules are testable without a database.
 *
 * hierarchy_level is the node's DEPTH (root = 1). Levels may be skipped by
 * type (an operation straight under the product), but depth is always the
 * parent's depth + 1, and the schema allows 1..5.
 */

export type TreeRow = {
  component_id: number
  parent_component_id: number | null
  hierarchy_level?: number | null
}

export const MAX_DEPTH = 5

const idOf = (v: unknown): number | null => (v == null ? null : Number(v))

function byId(rows: TreeRow[]): Map<number, TreeRow> {
  return new Map(rows.map((r) => [Number(r.component_id), r]))
}

function childrenMap(rows: TreeRow[]): Map<number, number[]> {
  const kids = new Map<number, number[]>()
  for (const r of rows) {
    const p = idOf(r.parent_component_id)
    if (p == null) continue
    const list = kids.get(p) ?? []
    list.push(Number(r.component_id))
    kids.set(p, list)
  }
  return kids
}

/** Depth of a node from its root (root = 1), following real parent links. */
export function depthOf(rows: TreeRow[], id: number): number {
  const map = byId(rows)
  const seen = new Set<number>()
  let depth = 0
  let cur: number | null = Number(id)
  while (cur != null && map.has(cur) && !seen.has(cur)) {
    seen.add(cur)
    depth++
    cur = idOf(map.get(cur)!.parent_component_id)
  }
  return Math.max(depth, 1)
}

/** Every node below `id` (not `id` itself). Cycle-safe. */
export function descendantsOf(rows: TreeRow[], id: number): Set<number> {
  const kids = childrenMap(rows)
  const out = new Set<number>()
  const stack = [Number(id)]
  while (stack.length) {
    const cur = stack.pop()!
    for (const k of kids.get(cur) ?? []) {
      if (k !== Number(id) && !out.has(k)) {
        out.add(k)
        stack.push(k)
      }
    }
  }
  return out
}

export type Placement =
  | { ok: true; level: number; levels: Map<number, number> }
  | { ok: false; error: string }

/**
 * Check that `parentId` is a valid parent for `componentId` (null for a node
 * not created yet) within this case's rows, and work out the depth of the node
 * and of everything under it.
 */
export function planPlacement(
  rows: TreeRow[],
  componentId: number | null,
  parentId: number | null,
): Placement {
  const map = byId(rows)
  const self = componentId == null ? null : Number(componentId)
  const parent = parentId == null ? null : Number(parentId)

  if (parent != null) {
    if (!map.has(parent)) {
      return { ok: false, error: 'The parent must be a step in the same case.' }
    }
    if (self != null && parent === self) {
      return { ok: false, error: 'A step cannot be its own parent.' }
    }
    if (self != null && descendantsOf(rows, self).has(parent)) {
      return {
        ok: false,
        error: 'That parent sits under this step, which would make a loop. Pick a step above it.',
      }
    }
  }

  const level = parent == null ? 1 : depthOf(rows, parent) + 1
  const levels = new Map<number, number>()
  if (self != null) {
    levels.set(self, level)
    const kids = childrenMap(rows)
    const stack = [self]
    while (stack.length) {
      const cur = stack.pop()!
      for (const k of kids.get(cur) ?? []) {
        if (levels.has(k)) continue
        levels.set(k, levels.get(cur)! + 1)
        stack.push(k)
      }
    }
  }

  const deepest = Math.max(level, ...levels.values())
  if (deepest > MAX_DEPTH) {
    return {
      ok: false,
      error: `That placement would put steps more than ${MAX_DEPTH} levels deep. Pick a higher parent.`,
    }
  }
  return { ok: true, level, levels }
}

/**
 * Rows ordered so every parent comes before its children, from the real
 * parent links (a stored hierarchy_level can be stale). Rows whose parent is
 * missing, or that sit on a cycle, come last, in their original order, so a
 * copy never silently drops them.
 */
export function parentFirstOrder<T extends TreeRow>(rows: T[]): T[] {
  const ids = new Set(rows.map((r) => Number(r.component_id)))
  const kids = new Map<number, T[]>()
  const roots: T[] = []
  for (const r of rows) {
    const p = idOf(r.parent_component_id)
    if (p == null || !ids.has(p)) {
      roots.push(r)
    } else {
      const list = kids.get(p) ?? []
      list.push(r)
      kids.set(p, list)
    }
  }
  const out: T[] = []
  const placed = new Set<number>()
  const queue = [...roots]
  while (queue.length) {
    const r = queue.shift()!
    const id = Number(r.component_id)
    if (placed.has(id)) continue
    placed.add(id)
    out.push(r)
    queue.push(...(kids.get(id) ?? []))
  }
  for (const r of rows) if (!placed.has(Number(r.component_id))) out.push(r)
  return out
}
