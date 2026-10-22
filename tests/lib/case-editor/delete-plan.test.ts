import { describe, it, expect, vi } from 'vitest'
import { chooseDeleteMode, deleteSuccessMessage, planDelete } from '@/lib/case-editor/delete-plan'

const c = (id: string, parentId: string | null, name: string) => ({ id, parentId, name })
const TREE = [c('1', null, 'Bracket'), c('2', '1', 'Cut'), c('3', '2', 'Deburr'), c('4', '1', 'Paint'), c('5', '3', 'Wipe')]

describe('planDelete', () => {
  it('collects the children and everything below', () => {
    const plan = planDelete(TREE, '2')!
    expect(plan.comp.name).toBe('Cut')
    expect(plan.children.map((x) => x.id)).toEqual(['3'])
    expect([...plan.below].sort()).toEqual(['3', '5'])
    expect(planDelete(TREE, '99')).toBeNull()
  })
})

describe('chooseDeleteMode (EDIT-1)', () => {
  it('a leaf asks once', () => {
    const confirm = vi.fn().mockReturnValue(true)
    expect(chooseDeleteMode(planDelete(TREE, '4')!, TREE, confirm)).toBe('delete')
    expect(confirm).toHaveBeenCalledWith('Delete "Paint"? This cannot be undone.')
    expect(chooseDeleteMode(planDelete(TREE, '4')!, TREE, () => false)).toBeNull()
  })

  it('OK on the first question deletes the subtree', () => {
    const confirm = vi.fn().mockReturnValueOnce(true)
    expect(chooseDeleteMode(planDelete(TREE, '2')!, TREE, confirm)).toBe('delete')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toMatch(/^Delete "Cut" and the 2 steps under it/)
  })

  it('Cancel then OK keeps the children by moving them up to the parent', () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    expect(chooseDeleteMode(planDelete(TREE, '2')!, TREE, confirm)).toBe('reparent')
    expect(confirm.mock.calls[1][0]).toBe(
      'Keep the 1 step directly under "Cut" by moving it up under "Bracket", and delete only "Cut"?\n\nOK moves it and deletes "Cut". Cancel does nothing.',
    )
  })

  it('a root with children moves them to the top level; Cancel twice does nothing', () => {
    const confirm = vi.fn().mockReturnValue(false)
    expect(chooseDeleteMode(planDelete(TREE, '1')!, TREE, confirm)).toBeNull()
    expect(confirm.mock.calls[1][0]).toMatch(/moving them up to the top level/)
  })
})

describe('deleteSuccessMessage', () => {
  it('says what went', () => {
    expect(deleteSuccessMessage(planDelete(TREE, '4')!, 'delete')).toBe('Deleted "Paint"')
    expect(deleteSuccessMessage(planDelete(TREE, '2')!, 'delete')).toBe('Deleted "Cut" and the 2 steps under it')
    expect(deleteSuccessMessage(planDelete(TREE, '2')!, 'reparent')).toBe('Deleted "Cut"; 1 step moved up')
  })
})
