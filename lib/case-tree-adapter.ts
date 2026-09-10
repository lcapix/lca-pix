// case-tree-adapter — maps real `ComponentNode[]` from the API into the
// CaseTreeNode shape expected by TreeCanvas / ListView / GraphView.
//
// Real components use database type names (product, machine_line, subprocess,
// operation, elemental_task) while the prototype uses (Product, Machine,
// Subprocess, Operation, Task). We normalize to the prototype tokens so
// HIERARCHY_TYPES lookups resolve correctly.

import type { HierarchyNodeType } from '@/lib/lcapix-demo'
import type { CaseTreeNode, FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface ComponentLike {
  id: string
  name: string
  type: string
  parentId?: string | null
  operationalCostUSD?: number | null
  capitalCostUSD?: number | null
  laborCost?: number | null
  energyCost?: number | null
  materialCost?: number | null
  transportationCost?: number | null
  equipmentCost?: number | null
  overheadCost?: number | null
  drivers?: string[] | null
  /** Real count of attached input/output flows (from the flows table). */
  flowCount?: number | null
}

const TYPE_MAP: Record<string, HierarchyNodeType> = {
  product: 'Product',
  Product: 'Product',
  machine: 'Machine',
  machine_line: 'Machine',
  'Machine/Line': 'Machine',
  subprocess: 'Subprocess',
  Subprocess: 'Subprocess',
  operation: 'Operation',
  Operation: 'Operation',
  elemental: 'Task',
  elemental_task: 'Task',
  'Elemental Task': 'Task',
  Task: 'Task',
}

export function normalizeType(dbType: string): HierarchyNodeType {
  return TYPE_MAP[dbType] ?? 'Task'
}

function costOf(c: ComponentLike): number {
  const abc =
    (c.laborCost ?? 0) +
    (c.energyCost ?? 0) +
    (c.materialCost ?? 0) +
    (c.transportationCost ?? 0) +
    (c.equipmentCost ?? 0) +
    (c.overheadCost ?? 0)
  if (abc > 0) return Math.round(abc)
  return Math.round((c.operationalCostUSD ?? 0) + (c.capitalCostUSD ?? 0))
}

function flowsOf(c: ComponentLike): number {
  // Prefer the real flow count from the flows table; fall back to the legacy
  // drivers-JSON length only when no count was provided.
  if (typeof c.flowCount === 'number') return c.flowCount
  return Array.isArray(c.drivers) ? c.drivers.length : 0
}

/**
 * Build a hierarchy from a flat list of components. If multiple roots exist,
 * a synthetic root is added so TreeCanvas has a single entry point. If no
 * components exist, returns `null`.
 */
export function componentsToTree(components: ComponentLike[]): CaseTreeNode | null {
  if (!components.length) return null

  const nodeMap = new Map<string, CaseTreeNode>()
  components.forEach((c) => {
    nodeMap.set(c.id, {
      id: c.id,
      type: normalizeType(c.type),
      label: c.name,
      flows: flowsOf(c),
      cost: costOf(c),
      children: [],
    })
  })

  const roots: CaseTreeNode[] = []
  components.forEach((c) => {
    const node = nodeMap.get(c.id)!
    if (c.parentId && nodeMap.has(c.parentId)) {
      nodeMap.get(c.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  if (roots.length === 1) return roots[0]

  // Multi-root — wrap with a NEUTRAL synthetic container ('Root', rendered as
  // "Case") so the canvas has a single entry point. Previously this used
  // type:'Product', which made a case with one Product + one floating
  // Machine/Line show TWO green Product cards. The container is not a product.
  return {
    id: '__root__',
    type: 'Root',
    label: 'Case Root',
    flows: roots.reduce((s, r) => s + r.flows, 0),
    cost: roots.reduce((s, r) => s + r.cost, 0),
    children: roots,
  }
}

/** True for the internal multi-root layout container (never user-visible). */
export const SYNTHETIC_ROOT_ID = '__root__'
export function isSyntheticRoot(n: { id: string } | null | undefined): boolean {
  return !!n && n.id === SYNTHETIC_ROOT_ID
}

/**
 * Flatten a tree depth-first for the sidebar nav and List/Graph views.
 * The synthetic multi-root container is skipped — its children become the
 * top-level entries so no fake "Case Root" ever shows.
 */
export function flattenTree(root: CaseTreeNode | null): FlatCaseNode[] {
  if (!root) return []
  const out: FlatCaseNode[] = []
  const walk = (n: CaseTreeNode, depth: number) => {
    out.push({
      id: n.id,
      type: n.type,
      label: n.label,
      flows: n.flows,
      cost: n.cost,
      depth,
    })
    ;(n.children || []).forEach((c) => walk(c, depth + 1))
  }
  if (isSyntheticRoot(root)) {
    // Forest: emit each real root at depth 0, skip the container.
    ;(root.children || []).forEach((c) => walk(c, 0))
  } else {
    walk(root, 0)
  }
  return out
}
