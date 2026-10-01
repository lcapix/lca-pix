// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useCaseSelection, useCaseTree } from '@/lib/case-editor/use-case-selection'
import { transformComponentFromDB } from '@/lib/data-transformers'

const row = (id: number, type: string, parent: number | null, name: string, labor?: string) =>
  transformComponentFromDB({ component_id: id, case_id: 10, parent_component_id: parent, component_type: type, component_name: name, labor_cost: labor })

const COMPONENTS = [row(1, 'product', null, 'Bracket'), row(2, 'operation', 1, 'Cut', '5.00'), row(3, 'operation', 1, 'Paint', '2.00')]

function render(components: any[], pre: { name?: string | null; id?: string | null } = {}) {
  const loadFormFor = vi.fn()
  const setIsEditing = vi.fn()
  const hook = renderHook(
    ({ list }) =>
      useCaseSelection({
        components: list,
        loadFormFor,
        setIsEditing,
        preselectComponent: pre.name ?? null,
        preselectComponentId: pre.id ?? null,
      }),
    { initialProps: { list: components } },
  )
  return { ...hook, loadFormFor, setIsEditing }
}

describe('useCaseSelection', () => {
  it('selects the first root once components arrive', () => {
    const { result, rerender, loadFormFor } = render([])
    expect(result.current.selectedNode).toBeNull()
    rerender({ list: COMPONENTS })
    expect(result.current.selectedNode).toBe('1')
    expect(loadFormFor).toHaveBeenCalledWith(COMPONENTS[0])
  })

  it('honours ?componentId and ?component deep links (FLOW-8)', () => {
    expect(render(COMPONENTS, { id: '3' }).result.current.selectedNode).toBe('3')
    expect(render(COMPONENTS, { name: 'Cut' }).result.current.selectedNode).toBe('2')
  })

  it('selecting loads the form; the synthetic root clears the selection', () => {
    const { result, loadFormFor, setIsEditing } = render(COMPONENTS)
    act(() => result.current.handleSelect('3'))
    expect(result.current.selectedNode).toBe('3')
    expect(loadFormFor).toHaveBeenLastCalledWith(COMPONENTS[2])
    act(() => result.current.handleSelect('__root__'))
    expect(result.current.selectedNode).toBeNull()
    expect(setIsEditing).toHaveBeenCalledWith(false)
  })
})

describe('useCaseTree', () => {
  it('builds the tree, the filtered outline and the selection roll-up', () => {
    const { result } = renderHook(() => useCaseTree(COMPONENTS, '1', 'pai'))
    expect(result.current.tree?.id).toBe('1')
    expect(result.current.flat.map((n) => n.label)).toEqual(['Bracket', 'Cut', 'Paint'])
    expect(result.current.filteredFlat.map((n) => n.label)).toEqual(['Paint'])
    expect(result.current.selectedFlatNode?.label).toBe('Bracket')
    expect(result.current.selectedComponent?.name).toBe('Bracket')
    expect(result.current.selectedRollup).toMatchObject({ cost: 7, hasChildren: true })
    expect(result.current.parentOptions).toEqual([])
  })

  it('offers coarser nodes as parents for a step', () => {
    const { result } = renderHook(() => useCaseTree(COMPONENTS, '2', ''))
    expect(result.current.parentOptions).toEqual([{ id: '1', label: 'Bracket (Product)' }])
    expect(result.current.selectedRollup).toMatchObject({ cost: 5, hasChildren: false })
  })
})
