'use client'

// The flowchart inside the "View Full Hierarchy" dialog: one card per
// component, its children below joined by curved connectors, filtered by the
// search text. `collapsed` holds the nodes whose children are hidden.

import { type Dispatch, type ReactElement, type SetStateAction } from 'react'
import { ChevronDown } from 'lucide-react'
import { normalizeComponentType } from '@/lib/hierarchy-colors'
import { componentCostUSD } from '@/lib/case-tree-adapter'
import {
  HIERARCHY_TYPE_LABEL,
  childComponents,
  connectorPath,
  flowChartColors,
  isVisibleInSearch,
  nameMatches,
  nodeFlowCount,
  rootComponents,
  toggleCollapsed,
} from '@/lib/project/hierarchy-chart'

export interface HierarchyFlowChartProps {
  components: any[]
  searchQuery: string
  collapsed: Set<number>
  setCollapsed: Dispatch<SetStateAction<Set<number>>>
}

export function HierarchyFlowChart({
  components,
  searchQuery,
  collapsed,
  setCollapsed,
}: HierarchyFlowChartProps): ReactElement {
  const renderFlowNode = (node: any, level: number = 0): ReactElement | null => {
    const children = childComponents(components, node.component_id)
    const colors = flowChartColors(node.component_type || node.process_type)
    const isSearchMatch = searchQuery && nameMatches(node, searchQuery)
    const isExpanded = !collapsed.has(node.component_id)

    if (!isVisibleInSearch(components, node, searchQuery)) {
      return null
    }

    const normalizedType = normalizeComponentType(node.component_type || node.process_type || 'product')
    const flowsCount = nodeFlowCount(node)
    // Numbers, not concatenated DECIMAL strings; the canvas's rule (PROJ-4).
    const cost = componentCostUSD(node)

    return (
      <div key={node.component_id} className="flex flex-col items-center relative">
        <div
          className={`
              group relative
              rounded-lg
              cursor-pointer transition-all duration-200
              font-['Inter_Tight',Inter,sans-serif]
              ${isSearchMatch ? 'ring-2 ring-primary/60 animate-pulse' : ''}
            `}
          style={{
            minWidth: 220,
            maxWidth: 260,
            backgroundColor: colors.bg,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: colors.border,
            boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 4px 10px rgba(15,23,42,0.06)',
            color: colors.text,
            padding: '14px 16px',
          }}
        >
          <div className="text-left">
            <div
              className="font-mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: colors.text,
                opacity: 0.72,
                marginBottom: 3,
              }}
            >
              {HIERARCHY_TYPE_LABEL[normalizedType]}
            </div>
            <p
              className="leading-snug tracking-tight"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: colors.text,
                marginBottom: 3,
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {node.component_name}
            </p>
            <p
              className="font-mono"
              style={{ fontSize: 10.5, color: colors.text, opacity: 0.72 }}
            >
              {flowsCount} flows · ${Math.round(cost)}
            </p>
          </div>
          {children.length > 0 && (
            <button
              className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center hover:bg-black/10 z-20"
              style={{ background: 'rgba(255,255,255,0.35)' }}
              onClick={(e) => {
                e.stopPropagation()
                setCollapsed((prev) => toggleCollapsed(prev, node.component_id))
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  !isExpanded ? '-rotate-90' : ''
                }`}
                style={{ color: colors.text, opacity: 0.7 }}
              />
            </button>
          )}
        </div>

        {children.length > 0 && isExpanded && (
          <>
            <div
              className="relative w-full"
              style={{ height: 36, marginTop: 4 }}
            >
              <svg
                width="100%"
                height="36"
                viewBox="0 0 100 36"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
              >
                {children.map((_child, idx) => {
                  return (
                    <path
                      key={idx}
                      d={connectorPath(idx, children.length)}
                      stroke={colors.connectionLine}
                      strokeWidth={1.5}
                      fill="none"
                      opacity={0.6}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })}
              </svg>
            </div>
            <div className="flex gap-6 justify-center items-start relative">
              {children.map((child) => (
                <div
                  key={child.component_id}
                  className="flex flex-col items-center"
                >
                  {renderFlowNode(child, level + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-10 justify-center items-start">
      {rootComponents(components).map((root) => renderFlowNode(root))}
    </div>
  )
}
