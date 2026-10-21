// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProjectSwitcher } from '@/components/lcapix/shell/project-switcher'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const projects = [
  { project_id: 1, project_name: 'Steel bracket · LCA 301', owner_id: 1, case_count: 34, pinned: true, pinned_at: '2026-10-20T00:00:00Z' },
  { project_id: 2, project_name: 'Aluminium enclosure', owner_id: 1, case_count: 1 },
  { project_id: 4, project_name: 'Wind turbine blade', owner_id: 7, owner_name: 'Dr. Omar Haddad', permission_name: 'editor' },
  { project_id: 5, project_name: 'Painted steel bracket', owner_id: 1, is_sample: true, case_count: 2 },
]

function setup(openId: number | null = 1) {
  const anchor = createRef<HTMLButtonElement>()
  const onClose = vi.fn()
  render(
    <>
      <button ref={anchor}>card</button>
      <ProjectSwitcher projects={projects} userId={1} openId={openId} anchorRef={anchor} onClose={onClose} />
    </>,
  )
  return { onClose, input: screen.getByRole('combobox') }
}

beforeEach(() => push.mockReset())

describe('ProjectSwitcher', () => {
  it('groups: Pinned, Your projects, Shared with you (with the owner), Sample; the open one ticked', () => {
    setup()
    const groups = screen.getAllByRole('group').map((g) => g.getAttribute('aria-labelledby') && g.textContent)
    expect(groups[0]).toMatch(/^PinnedSteel bracket · LCA 30134 cases\(open\)$/)
    expect(groups[1]).toMatch(/^Your projectsAluminium enclosure1 case$/)
    expect(groups[2]).toMatch(/^Shared with youWind turbine bladeDr\. Omar Haddad$/)
    expect(groups[3]).toMatch(/^SamplePainted steel bracket2 cases$/)
  })

  it('starts on the open project; arrows move; Enter opens', () => {
    const { input, onClose } = setup(2)
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[2].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/project/4')
    expect(onClose).toHaveBeenCalledWith(false)
  })

  it('typing filters (by name or owner); nothing matching says so', () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'haddad' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Wind turbine bladeDr. Omar Haddad'])
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.queryAllByRole('option')).toEqual([])
    expect(screen.getByText('No project matches.')).toBeTruthy()
  })

  it('Esc closes and asks for focus back on the card', () => {
    const { input, onClose } = setup()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith(true)
  })
})