// Tree questions the case editor asks of its component list: the canvas
// input, the outline filter, who may become a parent, what a new component
// defaults to, and which component is selected when the case opens.

import type { ComponentNode } from '@/lib/store'
import { normalizeType, type ComponentLike } from '@/lib/case-tree-adapter'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import type { ParentOption } from './types'

/** The fields the tree adapter reads, per component. */
export function toComponentLikes(components: ComponentNode[]): ComponentLike[] {
  return components.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    parentId: c.parentId ?? null,
    operationalCostUSD: c.operationalCostUSD ?? null,
    capitalCostUSD: c.capitalCostUSD ?? null,
    laborCost: (c as any).laborCost ?? null,
    energyCost: (c as any).energyCost ?? null,
    materialCost: (c as any).materialCost ?? null,
    transportationCost: (c as any).transportationCost ?? null,
    equipmentCost: (c as any).equipmentCost ?? null,
    overheadCost: (c as any).overheadCost ?? null,
    drivers: c.drivers ?? null,
    flowCount: (c as any).flowCount ?? null,
  }))
}

/** The outline's "Components" filter: case-insensitive match on the label. */
export function filterFlatByLabel(flat: FlatCaseNode[], query: string): FlatCaseNode[] {
  if (!query.trim()) return flat
  const q = query.toLowerCase()
  return flat.filter((n) => n.label.toLowerCase().includes(q))
}

/**
 * Every component below `id`, found by walking parent links. Insertion order
 * is the walk order (depth-first from the last child found).
 */
export function descendantIdsOf(
  components: Array<Pick<ComponentNode, 'id' | 'parentId'>>,
  id: string,
): Set<string> {
  const below = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const c of components) {
      if (c.parentId === cur && !below.has(c.id)) {
        below.add(c.id)
        stack.push(c.id)
      }
    }
  }
  return below
}

/** Tier rank by DB type: lower is coarser. */
export const TYPE_RANK: Record<string, number> = {
  product: 1,
  machine_line: 2,
  subprocess: 3,
  operation: 4,
  elemental_task: 5,
}

/**
 * Candidate re-parent targets for the inspector. A node may be moved under
 * any COARSER node (levels may be skipped — an Operation can sit directly
 * under a Product), across any branch of the tree, or made independent.
 * Self + descendants are excluded to prevent cycles. The product has none.
 */
export function parentOptionsFor(
  components: ComponentNode[],
  selected: ComponentNode | null,
): ParentOption[] {
  if (!selected) return []
  const ownRank = TYPE_RANK[selected.type as string]
  if (!ownRank || ownRank === 1) return []

  const descendants = descendantIdsOf(components, selected.id)
  return components
    .filter(
      (c) =>
        c.id !== selected.id &&
        !descendants.has(c.id) &&
        (TYPE_RANK[c.type as string] ?? 99) < ownRank,
    )
    .map((c) => {
      const tdef = HIERARCHY_TYPES.find(
        (h) => (h.id as string) === (normalizeType(c.type) as unknown as string),
      )
      return { id: c.id, label: `${c.name} (${tdef?.label ?? c.type})` }
    })
}

/** The tier a new component defaults to under a selected one. */
export const CHILD_OF: Record<string, string> = {
  product: 'machine_line',
  machine_line: 'subprocess',
  subprocess: 'operation',
  operation: 'elemental_task',
}

/**
 * Query string for /component/new: a new component defaults to being the
 * CHILD of the selected node (or its sibling, when a leaf is selected) —
 * never a guess from elsewhere in the tree. '' when nothing applies.
 */
export function newComponentQuery(sel: Pick<ComponentNode, 'id' | 'type' | 'parentId'> | null): string {
  if (!sel) return ''
  const childType = CHILD_OF[sel.type as string]
  if (childType) {
    return `?parent=${encodeURIComponent(sel.id)}&type=${encodeURIComponent(childType)}`
  }
  if (sel.parentId) {
    // Leaf selected → suggest a sibling under the same parent.
    return `?parent=${encodeURIComponent(sel.parentId)}&type=${encodeURIComponent(sel.type as string)}`
  }
  return ''
}

/**
 * The component selected when the case opens: ?componentId=<id>, else
 * ?component=<name> (the results page's deep link), else the first root,
 * else the first component.
 */
export function pickInitialComponent<T extends Pick<ComponentNode, 'id' | 'name' | 'parentId'>>(
  components: T[],
  preselect: { id?: string | null; name?: string | null },
): T | undefined {
  const byId = preselect.id ? components.find((c) => c.id === preselect.id) : null
  const named = preselect.name ? components.find((c) => c.name === preselect.name) : null
  return byId ?? named ?? components.find((c) => !c.parentId) ?? components[0]
}

/** The process steps a lesson can ask about (operations and subprocesses). */
export function lessonStepNames(components: Array<Pick<ComponentNode, 'type' | 'name'>>): string[] {
  return components
    .filter((c) => c.type === 'operation' || c.type === 'subprocess')
    .map((c) => c.name)
}
