// Pure helpers for the project workspace's "View Full Hierarchy" dialog: the
// flowchart palette, tree walking over raw /api/cases/:id/components rows,
// search filtering, expand/collapse and zoom.

import { normalizeComponentType } from '@/lib/hierarchy-colors'

/** A raw component row as /api/cases/:id/components returns it. */
export interface HierarchyComponentRow {
  component_id: number
  component_name: string
  parent_component_id?: number | null
  component_type?: string
  process_type?: string
  flows?: unknown[]
  flow_count?: number | null
  [key: string]: unknown
}

/** Flowchart palette — preserved for the tree modal. */
export const VERIDIAN_FLOW_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  product: { bg: '#a7d3b8', border: '#4f8a6a', text: '#16331f' },
  machine_line: { bg: '#f0a68a', border: '#c45a3a', text: '#3a1a0f' },
  subprocess: { bg: '#f5c971', border: '#d9a84a', text: '#3a2a0a' },
  operation: { bg: '#7bb5e8', border: '#4f90c9', text: '#0f2238' },
  elemental_task: { bg: '#c8b5e8', border: '#9f88cc', text: '#1f1438' },
}

/** Colours of one flowchart node by its component type (product when unknown). */
export function flowChartColors(componentType: string): {
  bg: string
  border: string
  text: string
  connectionLine: string
} {
  const normalizedType = normalizeComponentType(componentType || 'product')
  const colorConfig = VERIDIAN_FLOW_COLORS[normalizedType] || VERIDIAN_FLOW_COLORS.product
  return {
    bg: colorConfig.bg,
    border: colorConfig.border,
    text: colorConfig.text,
    connectionLine: '#bccabf',
  }
}

/** The tier caption printed on a flowchart node. */
export const HIERARCHY_TYPE_LABEL: Record<string, string> = {
  product: 'PRODUCT',
  machine_line: 'MACHINE/LINE',
  subprocess: 'SUBPROCESS',
  operation: 'OPERATION',
  elemental_task: 'ELEMENTAL TASK',
}

/** Rows with no parent: the roots of the flowchart. */
export function rootComponents<T extends HierarchyComponentRow>(components: T[]): T[] {
  return components.filter((c) => !c.parent_component_id || c.parent_component_id === null)
}

/** Direct children of a row. */
export function childComponents<T extends HierarchyComponentRow>(components: T[], parentId: number): T[] {
  return components.filter((c) => c.parent_component_id === parentId)
}

/** Whether a row's name contains the search text (case-insensitive). */
export function nameMatches(node: { component_name: string }, query: string): boolean {
  return node.component_name.toLowerCase().includes(query.toLowerCase())
}

/** Whether any descendant of `nodeId` matches the search text. */
export function hasMatchingDescendant(components: HierarchyComponentRow[], nodeId: number, query: string): boolean {
  const directChildren = childComponents(components, nodeId)
  return directChildren.some(
    (child) => nameMatches(child, query) || hasMatchingDescendant(components, child.component_id, query),
  )
}

/** A node stays in the chart when there is no search, it matches, or something below it does. */
export function isVisibleInSearch(components: HierarchyComponentRow[], node: HierarchyComponentRow, query: string): boolean {
  if (query && !nameMatches(node, query)) {
    return hasMatchingDescendant(components, node.component_id, query)
  }
  return true
}

/** How many rows match the search text (the dialog footer's count). */
export function countMatches(components: HierarchyComponentRow[], query: string): number {
  return components.filter((c) => nameMatches(c, query)).length
}

/** Flow count printed on a node: its flow list, else its flow_count, else 0. */
export function nodeFlowCount(node: { flows?: unknown; flow_count?: number | null }): number {
  return Array.isArray(node.flows) ? node.flows.length : (node.flow_count ?? 0)
}

/**
 * The connector from a parent (top centre) to child `idx` of `n`, in the
 * 100 × 36 viewBox the children row is drawn in.
 */
export function connectorPath(idx: number, n: number): string {
  const childCx = ((idx + 0.5) / n) * 100
  const startX = 50
  const startY = 0
  const endX = childCx
  const endY = 36
  const midY = 18
  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
}

/**
 * The set of collapsed nodes after toggling one. The set holds the nodes that
 * are collapsed: a node not in it is expanded.
 */
export function toggleCollapsed(collapsed: Set<number>, id: number): Set<number> {
  const newSet = new Set(collapsed)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  return newSet
}

/** "Collapse All" when nothing is collapsed (collapses every row), else "Expand All". */
export function toggleAllCollapsed(components: HierarchyComponentRow[], collapsed: Set<number>): Set<number> {
  if (collapsed.size === 0) {
    return new Set<number>(components.map((c) => c.component_id))
  }
  return new Set()
}

/** Zoom limits of the dialog, in percent. */
export const HIERARCHY_ZOOM_MIN = 30
export const HIERARCHY_ZOOM_MAX = 200

/** The zoom after a step of `delta` percent, kept within 30–200 %. */
export function stepZoom(zoom: number, delta: number): number {
  return Math.max(HIERARCHY_ZOOM_MIN, Math.min(HIERARCHY_ZOOM_MAX, zoom + delta))
}
