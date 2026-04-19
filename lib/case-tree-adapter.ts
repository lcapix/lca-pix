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

  // Multi-root — wrap with synthetic Product root so views can render
  return {
    id: '__root__',
    type: 'Product',
    label: 'Case Root',
    flows: roots.reduce((s, r) => s + r.flows, 0),
    cost: roots.reduce((s, r) => s + r.cost, 0),
    children: roots,
  }
}

/**
 * Flatten a tree depth-first for the sidebar nav and List/Graph views.
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
  walk(root, 0)
  return out
}
