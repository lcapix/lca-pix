// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { FlowStatusPill, SourceTag, needAmountCount } from '@/components/lcapix/ds'

describe('the words the screens use (rules.md)', () => {
  it('source tags: exactly the five words, never "Industry average"', () => {
    const words = (['supplier', 'regional', 'global', 'hand', 'reference'] as const).map(
      (k) => render(<SourceTag kind={k} />).container.textContent,
    )
    expect(words).toEqual(['Supplier', 'Regional', 'Global average', 'Entered by hand', 'Reference'])
    expect(words.join(' ')).not.toMatch(/Industry/)
  })
  it('flow statuses: exactly the four phrases', () => {
    const words = (['counted', 'no_factor', 'needs_amount', 'left_out'] as const).map(
      (s) => render(<FlowStatusPill status={s} />).container.textContent,
    )
    expect(words).toEqual(['Counted', 'Counted, no climate factor', 'Needs an amount', "Left out, unit can't convert"])
    expect(needAmountCount(1)).toBe('1 needs an amount')
    expect(needAmountCount(2)).toBe('2 need an amount')
  })
})