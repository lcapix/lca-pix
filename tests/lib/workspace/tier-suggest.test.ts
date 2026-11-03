/**
 * UX 4: the tier suggested for a new step, from its parent: the tier most of
 * the parent's steps already have (a tie goes to the higher one), else the
 * tier just below the parent; nothing below an elemental task.
 */
import { describe, expect, it } from 'vitest'
import { suggestTier } from '@/lib/workspace/tier-suggest'

const line = { id: 2, name: 'Fabrication', tier: 'machine_line' as const }

describe('suggestTier', () => {
  it('no steps under the parent yet: the tier just below it', () => {
    expect(suggestTier(line, [])).toEqual({ tier: 'subprocess', why: 'The tier just below machine / line.' })
  })

  it("the tier the parent's steps already use, skipping a level like a routing does", () => {
    const steps = [
      { parentId: 2, tier: 'operation' as const },
      { parentId: 2, tier: 'operation' as const },
      { parentId: 2, tier: 'subprocess' as const },
      { parentId: 9, tier: 'subprocess' as const },
    ]
    expect(suggestTier(line, steps)).toEqual({ tier: 'operation', why: 'Like the 2 steps already under Fabrication.' })
  })

  it('a tie goes to the higher tier; one step reads in the singular', () => {
    const tie = [
      { parentId: 2, tier: 'operation' as const },
      { parentId: 2, tier: 'subprocess' as const },
    ]
    expect(suggestTier(line, tie)?.tier).toBe('subprocess')
    expect(suggestTier(line, [{ parentId: 2, tier: 'operation' as const }])?.why).toBe('Like the step already under Fabrication.')
  })

  it('nothing goes below an elemental task', () => {
    expect(suggestTier({ id: 5, name: 'Weld bead', tier: 'elemental_task' }, [])).toBeNull()
  })
})
