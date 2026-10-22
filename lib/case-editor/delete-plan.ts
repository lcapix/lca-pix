// Deleting a step (EDIT-1). A step with children asks two plain questions,
// and Cancel on the last one never does anything: delete everything under it,
// or keep the children by moving them up to this step's parent.

import type { ComponentNode } from '@/lib/store'
import { descendantIdsOf } from './case-tree'

export type DeleteMode = 'delete' | 'reparent'

export interface DeletePlan<T extends Pick<ComponentNode, 'id' | 'name' | 'parentId'>> {
  comp: T
  /** Directly under the step. */
  children: T[]
  /** Everything under the step, at any depth. */
  below: Set<string>
}

export function planDelete<T extends Pick<ComponentNode, 'id' | 'name' | 'parentId'>>(
  components: T[],
  id: string,
): DeletePlan<T> | null {
  const comp = components.find((c) => c.id === id)
  if (!comp) return null
  return {
    comp,
    children: components.filter((c) => c.parentId === comp.id),
    below: descendantIdsOf(components, comp.id),
  }
}

export const stepsLabel = (n: number) => `${n} step${n === 1 ? '' : 's'}`

/**
 * Ask what to delete, through `confirm` (window.confirm in the editor).
 * Returns the mode the server is asked for, or null to do nothing.
 */
export function chooseDeleteMode<T extends Pick<ComponentNode, 'id' | 'name' | 'parentId'>>(
  plan: DeletePlan<T>,
  components: T[],
  confirm: (message: string) => boolean,
): DeleteMode | null {
  const { comp, children, below } = plan
  if (children.length === 0) {
    return confirm(`Delete "${comp.name}"? This cannot be undone.`) ? 'delete' : null
  }
  const parentName = comp.parentId ? components.find((c) => c.id === comp.parentId)?.name : null
  if (
    confirm(
      `Delete "${comp.name}" and the ${stepsLabel(below.size)} under it, with their flows and costs? This cannot be undone.\n\nOK deletes them all. Cancel lets you keep the steps under it instead.`,
    )
  ) {
    return 'delete'
  }
  if (
    confirm(
      `Keep the ${stepsLabel(children.length)} directly under "${comp.name}" by moving ${children.length === 1 ? 'it' : 'them'} up ${parentName ? `under "${parentName}"` : 'to the top level'}, and delete only "${comp.name}"?\n\nOK moves ${children.length === 1 ? 'it' : 'them'} and deletes "${comp.name}". Cancel does nothing.`,
    )
  ) {
    return 'reparent'
  }
  return null
}

/** The toast once the server has deleted. */
export function deleteSuccessMessage<T extends Pick<ComponentNode, 'id' | 'name' | 'parentId'>>(
  plan: DeletePlan<T>,
  mode: DeleteMode,
): string {
  const { comp, children, below } = plan
  return mode === 'delete'
    ? below.size > 0
      ? `Deleted "${comp.name}" and the ${stepsLabel(below.size)} under it`
      : `Deleted "${comp.name}"`
    : `Deleted "${comp.name}"; ${stepsLabel(children.length)} moved up`
}
