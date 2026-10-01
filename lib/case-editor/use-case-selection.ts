'use client'

// Which component the editor is on, and the tree views derived from the
// component list (canvas tree, outline, roll-ups, parent choices).

import { useEffect, useMemo, useState } from 'react'
import type { ComponentNode } from '@/lib/store'
import { componentsToTree, flattenTree, rollupTree } from '@/lib/case-tree-adapter'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import {
  filterFlatByLabel,
  parentOptionsFor,
  pickInitialComponent,
  toComponentLikes,
} from './case-tree'

/**
 * The selected component. Selecting loads it into the form; selecting the
 * synthetic '__root__' clears the selection. When the components first
 * arrive, the ?componentId= / ?component= deep-link target (else the first
 * root) is selected.
 */
export function useCaseSelection({
  components,
  loadFormFor,
  setIsEditing,
  preselectComponent,
  preselectComponentId,
}: {
  components: ComponentNode[]
  loadFormFor: (c: ComponentNode) => void
  setIsEditing: (editing: boolean) => void
  preselectComponent: string | null
  preselectComponentId: string | null
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  // Auto-select: the ?component=<name> deep-link target, else first root.
  useEffect(() => {
    if (components.length > 0 && !selectedNode) {
      const target = pickInitialComponent(components, {
        id: preselectComponentId,
        name: preselectComponent,
      })
      if (target) {
        setSelectedNode(target.id)
        loadFormFor(target)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.length, preselectComponent, preselectComponentId])

  const handleSelect = (id: string) => {
    if (id === '__root__') {
      setSelectedNode(null)
      setIsEditing(false)
      return
    }
    setSelectedNode(id)
    const c = components.find((x) => x.id === id)
    if (c) loadFormFor(c)
  }

  return { selectedNode, setSelectedNode, handleSelect }
}

/** The canvas tree, the outline (filtered by the sidebar query) and the selection's place in them. */
export function useCaseTree(components: ComponentNode[], selectedNode: string | null, sidebarQuery: string) {
  const tree = useMemo(() => componentsToTree(toComponentLikes(components)), [components])

  const flat: FlatCaseNode[] = useMemo(() => flattenTree(tree), [tree])

  const filteredFlat = useMemo(() => filterFlatByLabel(flat, sidebarQuery), [flat, sidebarQuery])

  const selectedFlatNode = useMemo(
    () => flat.find((n) => n.id === selectedNode) ?? null,
    [flat, selectedNode],
  )

  const selectedComponent = useMemo(
    () => (selectedNode ? components.find((c) => c.id === selectedNode) ?? null : null),
    [components, selectedNode],
  )

  // Subtree totals per node — parents are pure sums (terminating-node model).
  // Drives the Σ values in the detail strip and tells the inspector which
  // selected nodes are roll-ups (no flow/cost editing of their own).
  const rollups = useMemo(() => rollupTree(tree), [tree])
  const selectedRollup = selectedNode ? rollups.get(selectedNode) ?? null : null

  // Candidate re-parent targets for the inspector.
  const parentOptions = useMemo(
    () => parentOptionsFor(components, selectedComponent),
    [components, selectedComponent],
  )

  return { tree, flat, filteredFlat, selectedFlatNode, selectedComponent, selectedRollup, parentOptions }
}
