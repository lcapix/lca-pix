// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { useNumberDrafts } from '@/lib/case-editor/use-number-drafts'
import { useLaborRate } from '@/lib/case-editor/use-labor-rate'
import { useMachineEnergy } from '@/lib/case-editor/use-machine-energy'
import { useCostSuggestion } from '@/lib/case-editor/use-cost-suggestion'
import { getLaborRate } from '@/lib/integrations/reference-rates'
import type { InspectorEditFormData } from '@/lib/case-editor/types'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any

beforeEach(() => vi.clearAllMocks())

/** A controlled form around a hook, like the inspector inside the case editor. */
function withForm<T>(initial: InspectorEditFormData, use: (fd: InspectorEditFormData, onChange: (p: Partial<InspectorEditFormData>) => void) => T) {
  const spy = vi.fn()
  const hook = renderHook(() => {
    const [fd, setFd] = useState(initial)
    const onChange = (p: Partial<InspectorEditFormData>) => {
      spy(p)
      setFd((f) => ({ ...f, ...p }))
    }
    return { fd, out: use(fd, onChange) }
  })
  return { ...hook, spy }
}

describe('useNumberDrafts (EDIT-5)', () => {
  it('keeps the typed text, sends what parses, and blocks Save on an invalid number', () => {
    const { result, spy } = withForm({}, (fd, onChange) => useNumberDrafts({ nodeId: '4', editFormData: fd, onChange }))
    act(() => result.current.out.onNumberChange('laborCost', '12.'))
    expect(result.current.out.numberValue('laborCost')).toBe('12.')
    expect(spy).toHaveBeenLastCalledWith({ laborCost: 12 })

    act(() => result.current.out.onNumberChange('energyCost', 'abc'))
    expect(result.current.out.numberError('energyCost')).toBe('Not a number of 0 or more.')
    expect(result.current.out.invalidNumbers).toBe(true)
    const onSave = vi.fn()
    act(() => result.current.out.guardSave(onSave))
    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.out.saveBlocked).toBe(true)

    act(() => result.current.out.onNumberChange('energyCost', '3'))
    expect(result.current.out.saveBlocked).toBe(false)
    act(() => result.current.out.guardSave(onSave))
    expect(onSave).toHaveBeenCalled()
  })

  it('a value applied from elsewhere replaces a stale draft', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(({ fd }) => useNumberDrafts({ nodeId: '4', editFormData: fd, onChange }), {
      initialProps: { fd: { laborCost: 3 } as InspectorEditFormData },
    })
    act(() => result.current.onNumberChange('laborCost', '3.'))
    // The form did not change (3. is 3), so the draft shows.
    expect(result.current.numberValue('laborCost')).toBe('3.')
    rerender({ fd: { laborCost: 30 } })
    expect(result.current.numberValue('laborCost')).toBe('30')
  })

  it('drafts belong to one node', () => {
    const { result, rerender } = renderHook(({ id }) => useNumberDrafts({ nodeId: id, editFormData: { laborCost: 1 }, onChange: () => {} }), {
      initialProps: { id: '4' },
    })
    act(() => result.current.onNumberChange('laborCost', 'x'))
    expect(result.current.invalidNumbers).toBe(true)
    rerender({ id: '5' })
    expect(result.current.invalidNumbers).toBe(false)
    expect(result.current.numberValue('laborCost')).toBe('1')
  })

  it('does nothing when the inspector is read-only', () => {
    const { result } = renderHook(() => useNumberDrafts({ nodeId: '4' }))
    act(() => result.current.onNumberChange('laborCost', 'x'))
    expect(result.current.invalidNumbers).toBe(false)
    expect(result.current.numberValue('laborCost')).toBe('')
  })
})

describe('useLaborRate', () => {
  const ref = getLaborRate('Weld tab')

  it('costs typed hours at the national reference rate', () => {
    const { result, spy } = withForm({}, (fd, onChange) => useLaborRate({ nodeLabel: 'Weld tab', editFormData: fd, onChange }))
    expect(result.current.out.rate).toBe(ref.rate)
    expect(result.current.out.rateLabel).toBe(`${ref.label} · BLS OEWS national`)
    act(() => result.current.out.setHours('2'))
    expect(spy).toHaveBeenLastCalledWith({ laborHours: 2, laborOccupation: ref.soc, laborCost: Math.round(2 * ref.rate * 100) / 100 })
    expect(result.current.out.computed).toBe(Math.round(2 * ref.rate * 100) / 100)
  })

  it('a state wage from BLS re-costs the hours', async () => {
    vi.mocked(apiRequest).mockResolvedValue(json({ success: true, rate: { rateValue: 30, source: 'BLS OEWS' } }))
    const { result, spy } = withForm({ laborHours: 2 }, (fd, onChange) => useLaborRate({ nodeLabel: 'Weld tab', editFormData: fd, onChange }))
    await act(async () => result.current.out.pickState('CA'))
    const [url, init] = vi.mocked(apiRequest).mock.calls[0] as any
    expect(url).toBe('/api/integrations/bls/fetch-wage')
    expect(JSON.parse(init.body)).toEqual({ occupation: ref.soc, state: 'CA' })
    expect(spy).toHaveBeenLastCalledWith({ laborCost: 60, laborOccupation: ref.soc })
    expect(result.current.out.rate).toBe(30)
    expect(result.current.out.rateLabel).toBe('BLS OEWS · CA')
    expect(result.current.out.state).toBe('CA')

    act(() => {
      result.current.out.pickState('US')
    })
    expect(result.current.out.rate).toBe(ref.rate)
  })

  it('keeps the national rate when BLS fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('offline'))
    const { result, spy } = withForm({ laborHours: 2 }, (fd, onChange) => useLaborRate({ nodeLabel: 'Weld tab', editFormData: fd, onChange }))
    await act(async () => result.current.out.pickState('TX'))
    expect(result.current.out.rate).toBe(ref.rate)
    expect(result.current.out.wageLoading).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useMachineEnergy', () => {
  it('adds the kWh as an Electricity input and tells the editor', async () => {
    vi.mocked(apiRequest).mockImplementation(async (url: string) =>
      url === '/api/substances' ? json({ substances: [{ substance_id: 11, substance_name: 'Electricity' }] }) : json({ success: true }),
    )
    const events: string[] = []
    const on = (e: Event) => events.push(e.type)
    window.addEventListener('lcapix:flows-changed', on)
    window.addEventListener('lcapix:components-changed', on)
    const { result } = renderHook(() => useMachineEnergy('4'))
    act(() => {
      result.current.setHours('2')
      result.current.setKw('15')
      result.current.setLoadPct('60')
    })
    expect(result.current.kwh).toBe(18)
    await act(async () => result.current.addElectricityFlow())
    window.removeEventListener('lcapix:flows-changed', on)
    window.removeEventListener('lcapix:components-changed', on)
    const post = vi.mocked(apiRequest).mock.calls.find(([u]) => u === '/api/components/4/flows') as any
    expect(post[1].method).toBe('POST')
    expect(JSON.parse(post[1].body)).toEqual({
      substance_id: 11,
      flow_type: 'input',
      quantity: 18,
      unit: 'kWh',
      driver_description: 'Machine energy: 2 h × 15 kW × 60% load',
    })
    expect(events).toEqual(['lcapix:flows-changed', 'lcapix:components-changed'])
    expect(toast.success).toHaveBeenCalledWith('Added 18 kWh of electricity as an input')
  })

  it('says so when the catalog has no Electricity', async () => {
    vi.mocked(apiRequest).mockResolvedValue(json({ substances: [] }))
    const { result } = renderHook(() => useMachineEnergy('4'))
    act(() => {
      result.current.setHours('1')
      result.current.setKw('1')
      result.current.setLoadPct('100')
    })
    await act(async () => result.current.addElectricityFlow())
    expect(toast.error).toHaveBeenCalledWith('No "Electricity" substance in the catalog')
    expect(result.current.adding).toBe(false)
  })
})

describe('useCostSuggestion', () => {
  it('suggests, applies once and remembers it was applied', () => {
    const onApply = vi.fn()
    const { result } = renderHook(() =>
      useCostSuggestion({
        flows: [{ id: '1', substance: 'Electricity', dir: 'IN', amount: 10, unit: 'kWh' }],
        componentType: 'Operation',
        nodeName: 'Paint',
        onApply,
      }),
    )
    act(() => result.current.suggest())
    expect(result.current.result?.payload.energy).toBeGreaterThan(0)
    act(() => result.current.apply())
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ energy: expect.any(Number) }))
    expect(result.current.result).toBeNull()
    expect(result.current.applied).toBe(true)
    act(() => result.current.suggest())
    expect(result.current.applied).toBe(false)
    act(() => result.current.dismiss())
    expect(result.current.result).toBeNull()
  })
})
