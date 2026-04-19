"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Maximize2, Minimize2, Network, Package } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import Link from "next/link"
import { getColorsByComponentType, normalizeComponentType, HIERARCHY_COLORS } from "@/lib/hierarchy-colors"

interface CaseTreeVisualizationProps {
  caseId: string
  caseName: string
  projectId: string
  compact?: boolean  // When true, hide header/footer and remove top spacing
}

interface Component {
  id: number
  case_id: number
  parent_id: number | null
  component_type: string
  component_name: string
  component_description: string | null
  driver_category: string | null
  selected_driver: string | null
  mass: number | null
  mass_unit: string | null
  operational_cost_usd: number | null
  capital_cost_usd: number | null
  created_at: string
  updated_at: string
  flowCount?: number
}

interface TreeNode extends Component {
  children: TreeNode[]
  level: number
}

// Veridian Flow softened palette — aligned with VERIDIAN_FLOW_COLORS in
// app/project/[projectId]/page.tsx (fullscreen hierarchy modal). Values
// duplicated verbatim so the inline Hierarchy tab reads identically to the
// fullscreen view. Do not diverge without updating both maps.
const COMPONENT_TYPE_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  product: {
    color: "text-[#3a1a0f]",
    bgColor: "bg-surface-container-lowest",
    borderColor: "border border-outline-variant/15 border-l-4 border-l-[#d98568]",
    label: "Product"
  },
  machine_line: {
    color: "text-[#3a1a0f]",
    bgColor: "bg-surface-container-lowest",
    borderColor: "border border-outline-variant/15 border-l-4 border-l-[#d98568]",
    label: "Machine/Line"
  },
  subprocess: {
    color: "text-[#3a2a0a]",
    bgColor: "bg-surface-container-lowest",
    borderColor: "border border-outline-variant/15 border-l-4 border-l-[#d9a84a]",
    label: "Subprocess"
  },
  operation: {
    color: "text-[#0f2238]",
    bgColor: "bg-surface-container-lowest",
    borderColor: "border border-outline-variant/15 border-l-4 border-l-[#4f90c9]",
    label: "Operation"
  },
  elemental_task: {
    color: "text-[#1f1438]",
    bgColor: "bg-surface-container-lowest",
    borderColor: "border border-outline-variant/15 border-l-4 border-l-[#9f88cc]",
    label: "Elemental Task"
  }
}

export function CaseTreeVisualization({ caseId, caseName, projectId, compact = false }: CaseTreeVisualizationProps) {
  const [components, setComponents] = useState<Component[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [allExpanded, setAllExpanded] = useState(true)

  useEffect(() => {
    fetchComponents()
  }, [caseId])

  const fetchComponents = async () => {
    try {
      setIsLoading(true)
      const response = await apiRequest(`/api/cases/${caseId}/components`)
      const data = await response.json()

      if (data.success && data.components) {
        // Map API response to component interface (component_id -> id, parent_component_id -> parent_id)
        const mappedComponents = data.components.map((comp: any) => ({
          id: comp.component_id,
          case_id: comp.case_id,
          parent_id: comp.parent_component_id,
          component_type: comp.component_type,
          component_name: comp.component_name,
          component_description: comp.description,
          driver_category: comp.driver_category,
          selected_driver: comp.driver_type,
          mass: comp.quantity,
          mass_unit: comp.unit,
          operational_cost_usd: comp.opex,
          capital_cost_usd: comp.capex,
          created_at: comp.created_at,
          updated_at: comp.updated_at
        }))

        // Fetch flow counts for each component
        const componentsWithFlows = await Promise.all(
          mappedComponents.map(async (comp: Component) => {
            try {
              const flowsRes = await apiRequest(`/api/components/${comp.id}/flows`)
              const flowsData = await flowsRes.json()
              return {
                ...comp,
                flowCount: flowsData.success ? flowsData.flows.length : 0
              }
            } catch {
              return { ...comp, flowCount: 0 }
            }
          })
        )

        setComponents(componentsWithFlows)

        // Expand all nodes by default
        const allIds = new Set(componentsWithFlows.map((c: Component) => c.id))
        setExpandedNodes(allIds)
      }
    } catch (error) {
      console.error('Failed to fetch components:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const buildTree = (components: Component[]): TreeNode[] => {
    const nodeMap = new Map<number, TreeNode>()
    const roots: TreeNode[] = []

    // Create node map
    components.forEach((comp) => {
      nodeMap.set(comp.id, { ...comp, children: [], level: 0 })
    })

    // Build parent-child relationships
    components.forEach((comp) => {
      const node = nodeMap.get(comp.id)!
      if (comp.parent_id && nodeMap.has(comp.parent_id)) {
        const parent = nodeMap.get(comp.parent_id)!
        node.level = parent.level + 1
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  const toggleNode = (nodeId: number) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const toggleAllNodes = () => {
    if (allExpanded) {
      setExpandedNodes(new Set())
      setAllExpanded(false)
    } else {
      const allIds = new Set(components.map(c => c.id))
      setExpandedNodes(allIds)
      setAllExpanded(true)
    }
  }

  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const config = COMPONENT_TYPE_CONFIG[node.component_type] || COMPONENT_TYPE_CONFIG.product

    return (
      <div key={node.id} style={{ paddingLeft: `${node.level * 6}px` }}>
        {/* Node Row */}
        <div className="flex items-start gap-2 group">
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.id)}
              className="shrink-0 hover:bg-gray-100 rounded p-0.5 transition-colors mt-3"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0"></span>
          )}

          {/* Component Card */}
          <div className={`flex-1 rounded-lg ${config.borderColor} ${config.bgColor} p-3 mb-2 shadow-botanical hover:shadow-botanical-hover transition-shadow`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {/* Type & Name */}
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    href={`/project/${projectId}/case/${caseId}`}
                    className={`font-semibold ${config.color} hover:underline`}
                  >
                    {node.component_name}
                  </Link>
                  <Badge variant="outline" className={`text-xs ${config.color} border-current`}>
                    {config.label}
                  </Badge>
                </div>

                {/* Description */}
                {node.component_description && (
                  <p className="text-xs text-on-surface-variant">{node.component_description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Render Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={compact ? "animate-pulse" : "border-t pt-4 mt-4 animate-pulse"}>
        {!compact && <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>}
        <div className="space-y-2">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded ml-4"></div>
          <div className="h-16 bg-gray-200 rounded ml-8"></div>
        </div>
      </div>
    )
  }

  if (components.length === 0) {
    return (
      <div className={compact ? "" : "border-t pt-4 mt-4"}>
        {!compact && (
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Process Tree</span>
          </div>
        )}
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed">
          <Package className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No components yet</p>
          <p className="text-xs text-gray-500 mb-4">Add components to build your process hierarchy</p>
          <Link href={`/project/${projectId}/case/${caseId}`}>
            <Button variant="outline" size="sm">
              Add First Component
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const treeData = buildTree(components)

  // COMPACT MODE: Just render the tree nodes without header/footer
  if (compact) {
    return (
      <div className="space-y-1">
        {treeData.map((node) => renderTreeNode(node))}
      </div>
    )
  }

  // FULL MODE: Render with header, tree, and footer
  return (
    <div className="border-t pt-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">Process Tree</span>
          <Badge variant="secondary" className="text-xs">
            {components.length} component{components.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAllNodes}
          className="text-xs"
        >
          {allExpanded ? (
            <>
              <Minimize2 className="h-3 w-3 mr-1" />
              Collapse All
            </>
          ) : (
            <>
              <Maximize2 className="h-3 w-3 mr-1" />
              Expand All
            </>
          )}
        </Button>
      </div>

      {/* Tree */}
      <div className="space-y-1">
        {treeData.map((node) => renderTreeNode(node))}
      </div>

      {/* Footer Summary */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span>{components.length} Total Components</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Max Depth: {Math.max(...components.map(c => {
            let depth = 0
            let current = c
            while (current.parent_id) {
              depth++
              current = components.find(comp => comp.id === current.parent_id)!
              if (!current) break
            }
            return depth
          }))}</span>
        </div>
      </div>
    </div>
  )
}
