// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTreeCanvas } from '@/lib/case-editor/use-tree-canvas'

const n = (id: string, children: any[] = [], cost = 0) => ({ id, type: 'Operation', label: id, flows: 1, cost, children }) as any
const ROOT = n('1', [n('2', [], 5), n('3', [], 7)])

/** A mousedown on (or off) a node, as React would deliver it. */
const mouse = (x: number, y: number, nodeId?: string) => {
  const target = document.createElement('div')
  if (nodeId) target.dataset.nodeId = nodeId
  return { target, clientX: x, clientY: y, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any
}

describe('useTreeCanvas', () => {
  it('lays out the tree and rolls costs up', () => {
    const { result } = renderHook(() => useTreeCanvas({ root: ROOT, onSelect: vi.fn() }))
    expect(result.current.nodes.map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(result.current.rollup.get('1')).toMatchObject({ cost: 12, flows: 3 })
    expect(result.current.transform).toEqual({ x: 40, y: 40, k: 1 })
  })

  it('a click without movement on a node selects it; a drag moves it', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() => useTreeCanvas({ root: ROOT, onSelect }))
    act(() => result.current.onMouseDown(mouse(100, 100, '2')))
    expect(result.current.cursor).toBe('grabbing')
    act(() => result.current.endInteraction(mouse(101, 101)))
    expect(onSelect).toHaveBeenCalledWith('2')

    onSelect.mockClear()
    const before = result.current.positions['2']
    act(() => result.current.onMouseDown(mouse(100, 100, '2')))
    expect(result.current.isDragging('2')).toBe(true)
    act(() => result.current.onMouseMove(mouse(150, 120)))
    act(() => result.current.endInteraction(mouse(150, 120)))
    expect(onSelect).not.toHaveBeenCalled()
    expect(result.current.positions['2']).toEqual({ x: before.x + 50, y: before.y + 20 })
    expect(result.current.cursor).toBe('grab')
  })

  it('mousedown on empty space pans', () => {
    const { result } = renderHook(() => useTreeCanvas({ root: ROOT, onSelect: vi.fn() }))
    act(() => result.current.onMouseDown(mouse(10, 10)))
    act(() => result.current.onMouseMove(mouse(30, 50)))
    expect(result.current.transform).toEqual({ x: 60, y: 80, k: 1 })
    act(() => result.current.onMouseLeave())
    act(() => result.current.onMouseMove(mouse(90, 90)))
    expect(result.current.transform).toEqual({ x: 60, y: 80, k: 1 })
  })

  it('zoom buttons step by 0.15 and Reset puts nodes back', () => {
    const { result } = renderHook(() => useTreeCanvas({ root: ROOT, onSelect: vi.fn() }))
    act(() => result.current.zoomIn())
    expect(result.current.transform.k).toBeCloseTo(1.15)
    act(() => result.current.zoomOut())
    act(() => result.current.zoomOut())
    expect(result.current.transform.k).toBeCloseTo(0.85)
    const home = result.current.positions['3']
    act(() => result.current.onMouseDown(mouse(0, 0, '3')))
    act(() => result.current.onMouseMove(mouse(40, 0)))
    act(() => result.current.endInteraction(mouse(40, 0)))
    expect(result.current.positions['3']).not.toEqual(home)
    act(() => result.current.resetLayout())
    expect(result.current.positions['3']).toEqual(home)
  })
})
