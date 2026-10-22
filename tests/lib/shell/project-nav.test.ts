import { describe, expect, it } from 'vitest'
import {
  PROJECT_TINTS,
  SAMPLE_TINT,
  placesFor,
  projectInitials,
  projectMeta,
  projectPagesFor,
  projectTint,
  pushRecent,
  recentProjects,
  showsNewProject,
  switcherGroups,
  switcherOrder,
  type NavProject,
} from '@/lib/shell/project-nav'

const ME = 1
const p = (id: number, name: string, over: Partial<NavProject> = {}): NavProject => ({
  project_id: id,
  project_name: name,
  owner_id: ME,
  case_count: 1,
  updated_at: `2026-10-${String(id).padStart(2, '0')}T10:00:00Z`,
  ...over,
})

const all = [
  p(1, 'Steel bracket · LCA 301', { case_count: 34, pinned: true, pinned_at: '2026-10-20T09:00:00Z', member_count: 31 }),
  p(2, 'Aluminium enclosure'),
  p(3, 'Bamboo bike frame', { case_count: 4 }),
  p(4, 'Wind turbine blade', { owner_id: 7, owner_name: 'Dr. Omar Haddad', permission_name: 'editor' }),
  p(5, 'Painted steel bracket', { is_sample: true, case_count: 2 }),
  p(6, 'Concrete mix · CE 340', { permission_name: 'admin', owner_id: 8, owner_name: 'Prof. Lee' }),
]

describe('project nav', () => {
  it('initials, tints in order, the sample its own green', () => {
    expect(projectInitials('Steel bracket · LCA 301')).toBe('SB')
    expect(projectInitials('Concrete mix · CE 340')).toBe('CM')
    expect(projectInitials('Mycelium')).toBe('MY')
    expect(projectTint(all[0], all)).toBe(PROJECT_TINTS[0])
    expect(projectTint(all[1], all)).toBe(PROJECT_TINTS[1])
    expect(projectTint(all[4], all)).toBe(SAMPLE_TINT)
    expect(projectTint(all[5], all)).toBe(PROJECT_TINTS[4]) // the 5th non-sample by id
  })

  it("meta line: owner, shared (who it is from), sample", () => {
    expect(projectMeta(all[0], ME)).toBe('34 cases · you own it')
    expect(projectMeta(all[3], ME)).toBe('From Dr. Omar Haddad')
    expect(projectMeta(all[4], ME)).toBe('2 cases')
    expect(projectMeta(p(9, 'x', { case_count: 1 }), ME)).toBe('1 case · you own it')
  })

  it('switcher groups: pinned only once, yours (owner or admin), shared, sample', () => {
    const g = switcherGroups(all, ME)
    expect(g.pinned.map((x) => x.project_id)).toEqual([1])
    expect(g.yours.map((x) => x.project_id)).toEqual([6, 3, 2]) // latest activity first
    expect(g.shared.map((x) => x.project_id)).toEqual([4])
    expect(g.sample.map((x) => x.project_id)).toEqual([5])
    expect(switcherOrder(g).map((x) => x.project_id)).toEqual([1, 6, 3, 2, 4, 5])
  })

  it('typing filters by name and by the owner of a shared project', () => {
    expect(switcherOrder(switcherGroups(all, ME, 'bra')).map((x) => x.project_id)).toEqual([1, 5])
    expect(switcherOrder(switcherGroups(all, ME, 'haddad')).map((x) => x.project_id)).toEqual([4])
    expect(switcherOrder(switcherGroups(all, ME, 'zzz'))).toEqual([])
  })

  it('recent: this device first, never the open project, at most three', () => {
    expect(recentProjects(all, [2, 1, 3], 1).map((x) => x.project_id)).toEqual([2, 3, 6])
    expect(recentProjects(all, [], 1).map((x) => x.project_id)).toEqual([6, 5, 4])
    expect(pushRecent([2, 1, 3], 3)).toEqual([3, 2, 1])
    expect(pushRecent(Array.from({ length: 10 }, (_, i) => i + 10), 99)).toHaveLength(10)
  })

  it('places: Home, Findings and Reports for everyone, no Analytics', () => {
    expect(placesFor()).toEqual(['home', 'findings', 'reports'])
  })

  it('nested pages: People for owner and admins; students get Overview, Cases, Compare', () => {
    expect(projectPagesFor(all[0], ME)).toEqual(['overview', 'cases', 'compare', 'people'])
    expect(projectPagesFor(all[5], ME)).toEqual(['overview', 'cases', 'compare', 'people'])
    expect(projectPagesFor(all[3], ME)).toEqual(['overview', 'cases', 'compare'])
  })

  it('+ New project: shown unless every project is a shared one (a student)', () => {
    expect(showsNewProject(all, ME)).toBe(true)
    expect(showsNewProject([all[3]], ME)).toBe(false)
    expect(showsNewProject([all[3], all[4]], ME)).toBe(false)
    expect(showsNewProject([all[4]], ME)).toBe(true)
    expect(showsNewProject([], ME)).toBe(true)
  })
})
