// Pure helpers for the project workspace's case tree preview (MiniCanvas) and
// the node-details card under it.

import { componentsToTree } from '@/lib/case-tree-adapter'
import { transformComponentFromDB } from '@/lib/data-transformers'
import type { DemoTreeNode } from '@/lib/lcapix-demo'

/** The case tree from a /api/cases/:id/components answer; null when it has no component list or no root. */
export function buildCaseTree(data: any): DemoTreeNode | null {
  if (!(data?.success && Array.isArray(data.components))) return null
  const transformed = data.components.map(transformComponentFromDB)
  return componentsToTree(
    transformed.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      type: c.type,
      parentId: c.parentId ? String(c.parentId) : null,
      operationalCostUSD: c.operationalCostUSD,
      capitalCostUSD: c.capitalCostUSD,
      laborCost: c.laborCost,
      energyCost: c.energyCost,
      materialCost: c.materialCost,
      transportationCost: c.transportationCost,
      equipmentCost: c.equipmentCost,
      overheadCost: c.overheadCost,
      drivers: c.drivers,
      flowCount: (c as any).flowCount ?? null,
    })),
  ) as DemoTreeNode | null
}

/**
 * The node selected when a tree loads. Never the synthetic multi-root
 * container: the first real root, so the inspector shows an actual component,
 * not "Case Root".
 */
export function initialTreeSelection(tree: DemoTreeNode): DemoTreeNode | null {
  return tree.id === '__root__' ? (tree.children?.[0] ?? null) : tree
}

/**
 * Impact, cost and flow count of a node and everything below it. Leaves carry
 * the real numbers; ancestors aggregate. Impact is looked up by node label in
 * the run's per-component map; only positive values count.
 */
export function aggregateSubtree(
  node: DemoTreeNode,
  impactByComponent: Record<string, number> | undefined,
): { co2: number; cost: number; flows: number } {
  let co2 = 0
  let cost = 0
  let flows = 0
  const leafImpact = impactByComponent?.[node.label] ?? 0
  if (leafImpact > 0) co2 += leafImpact
  const nodeCost = (node as any).cost ?? 0
  if (nodeCost > 0) cost += nodeCost
  const nodeFlows = (node as any).flows ?? 0
  if (nodeFlows > 0) flows += nodeFlows
  for (const c of node.children ?? []) {
    const sub = aggregateSubtree(c as DemoTreeNode, impactByComponent)
    co2 += sub.co2
    cost += sub.cost
    flows += sub.flows
  }
  return { co2, cost, flows }
}

/** What the node-details card shows for the selected node. */
export interface NodeDetailsMetrics {
  /** Null until the case has an assessment with a positive total. */
  co2: number | null
  cost: number
  flows: number
  childCount: number
  /** The node's share of the case total, 0–100, rounded. */
  co2Pct: number
}

/** The node-details card's numbers for `node`, given the case's latest run. */
export function nodeDetailsMetrics(
  node: DemoTreeNode,
  caseImpact: { totalImpact: number | null; impactByComponent?: Record<string, number> } | null,
): NodeDetailsMetrics {
  const childCount = node.children?.length ?? 0
  const hasAssessment = caseImpact?.totalImpact != null && caseImpact.totalImpact > 0
  const agg = aggregateSubtree(node, caseImpact?.impactByComponent)
  const co2: number | null = hasAssessment ? agg.co2 : null
  const totalImpactRef = caseImpact?.totalImpact ?? 0
  const co2Pct =
    co2 !== null && totalImpactRef > 0 ? Math.min(100, Math.round((co2 / totalImpactRef) * 100)) : 0
  return { co2, cost: agg.cost, flows: agg.flows, childCount, co2Pct }
}

/**
 * The "Path:" line of the node-details card. The synthetic '__root__'
 * container never shows: top-level nodes read as roots themselves.
 */
export function nodePathLabel(caseTree: DemoTreeNode | null, node: DemoTreeNode): string {
  return caseTree && caseTree.id !== '__root__' && caseTree.id !== node.id
    ? `${caseTree.label} › ${node.label}`
    : node.label
}
