import type { ProcessNode } from "@/types/component"

export type NodeType = "product" | "machine" | "subprocess" | "operation" | "elemental"

// Hierarchy rules: parent → allowed children
export const HIERARCHY_RULES: Record<NodeType, NodeType[]> = {
  product: ["machine"],
  machine: ["subprocess"], 
  subprocess: ["operation"],
  operation: ["elemental"],
  elemental: [], // No children allowed
}

// Get allowed child type for a parent type
export function getAllowedChildType(parentType: NodeType): NodeType | null {
  const allowedChildren = HIERARCHY_RULES[parentType]
  return allowedChildren.length > 0 ? allowedChildren[0] : null
}

// Get required parent type for a child type
export function getRequiredParentType(childType: NodeType): NodeType | null {
  for (const [parentType, children] of Object.entries(HIERARCHY_RULES)) {
    if (children.includes(childType)) {
      return parentType as NodeType
    }
  }
  return null
}

// Validate if a child type can have a specific parent type
export function validateParentChild(parentType: NodeType, childType: NodeType): boolean {
  return HIERARCHY_RULES[parentType]?.includes(childType) || false
}

// Get display label for node type
export function getTypeLabel(type: NodeType): string {
  const labels: Record<NodeType, string> = {
    product: "Product",
    machine: "Machine Line Process",
    subprocess: "Subprocess", 
    operation: "Operation",
    elemental: "Elemental Task",
  }
  return labels[type]
}

// Build breadcrumb path for a node
export function buildBreadcrumbPath(node: ProcessNode, allNodes: ProcessNode[]): string {
  const path: string[] = []
  let current: ProcessNode | undefined = node
  
  while (current && current.parentId) {
    current = allNodes.find(n => n.id === current?.parentId)
    if (current) {
      path.unshift(current.name)
    }
  }
  
  return path.join(" / ")
}