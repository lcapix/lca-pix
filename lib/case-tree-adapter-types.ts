// Shared TreeNode shape for the case editor views.
// Both the demo tree (lcapix-demo) and the adapter (case-tree-adapter)
// produce these shapes so TreeCanvas/ListView/GraphView work uniformly.

import type { HierarchyNodeType } from '@/lib/lcapix-demo'

export interface CaseTreeNode {
  id: string
  type: HierarchyNodeType
  label: string
  flows: number
  cost: number
  children?: CaseTreeNode[]
}

export interface FlatCaseNode {
  id: string
  type: HierarchyNodeType
  label: string
  flows: number
  cost: number
  depth: number
}
