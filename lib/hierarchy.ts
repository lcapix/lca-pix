import type { ProcessNode } from "@/types/component"

export type NodeType = "product" | "machine" | "subprocess" | "operation" | "elemental"

// Coarse-to-fine rank. Tiers are labels, not a fixed ladder (patent US
// 6,490,569 claim 4: "more or fewer" levels): a child only has to be finer than
// its parent, so levels may be skipped (an operation directly under a product).
export const TYPE_RANK: Record<NodeType, number> = {
  product: 1,
  machine: 2,
  subprocess: 3,
  operation: 4,
  elemental: 5,
}

/** True when a `childType` node may sit under a `parentType` node. */
export function canParent(parentType: NodeType, childType: NodeType): boolean {
  const p = TYPE_RANK[parentType]
  const c = TYPE_RANK[childType]
  return p !== undefined && c !== undefined && p < c
}

// Hierarchy rules: parent → allowed children (any finer tier)
export const HIERARCHY_RULES: Record<NodeType, NodeType[]> = {
  product: ["machine", "subprocess", "operation", "elemental"],
  machine: ["subprocess", "operation", "elemental"],
  subprocess: ["operation", "elemental"],
  operation: ["elemental"],
  elemental: [], // No children allowed
}

// Default child type for a parent type: the next finer tier.
export function getAllowedChildType(parentType: NodeType): NodeType | null {
  const allowedChildren = HIERARCHY_RULES[parentType]
  return allowedChildren.length > 0 ? allowedChildren[0] : null
}

// Default parent type for a child type: the next coarser tier (a suggestion;
// any coarser tier is allowed — see canParent).
export function getRequiredParentType(childType: NodeType): NodeType | null {
  const rank = TYPE_RANK[childType]
  if (!rank || rank === 1) return null
  return (Object.keys(TYPE_RANK) as NodeType[]).find((t) => TYPE_RANK[t] === rank - 1) ?? null
}

// Validate if a child type can have a specific parent type
export function validateParentChild(parentType: NodeType, childType: NodeType): boolean {
  return canParent(parentType, childType)
}

// Get display label for node type
export function getTypeLabel(type: NodeType): string {
  const labels: Record<NodeType, string> = {
    product: "Product",
    machine: "Machine Line Process",
    subprocess: "Subprocess", 
    operation: "Operation",
    elemental: "Task",
  }
  return labels[type]
}

// Build breadcrumb path for a node
export function buildBreadcrumbPath(node: ProcessNode, allNodes: ProcessNode[]): string {
  const path: string[] = []
  // A parent cycle (A under B under A) must end the walk, not hang the page.
  const seen = new Set<string>([node.id])
  let current: ProcessNode | undefined = node

  while (current && current.parentId) {
    const parentId: string = current.parentId
    if (seen.has(parentId)) break
    seen.add(parentId)
    current = allNodes.find(n => n.id === parentId)
    if (current) {
      path.unshift(current.name)
    }
  }
  
  return path.join(" / ")
}