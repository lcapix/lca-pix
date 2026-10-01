import { describe, it, expect } from 'vitest'
import {
  ISO_STEPS,
  coerceProject,
  filterProjects,
  formatRelative,
  greetingName,
  homeKpis,
  initialsOf,
  libraryCounts,
  projectTotals,
  type CoercedProject,
} from '@/lib/home/projects'

const NOW = Date.parse('2026-09-30T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)
const MIN = 60_000
const DAY = 24 * 60 * MIN

describe('formatRelative', () => {
  it('steps from minutes to years', () => {
    expect(formatRelative(ago(30_000), NOW)).toBe('just now')
    expect(formatRelative(ago(5 * MIN), NOW)).toBe('5m ago')
    expect(formatRelative(ago(3 * 60 * MIN), NOW)).toBe('3h ago')
    expect(formatRelative(ago(2 * DAY), NOW)).toBe('2d ago')
    expect(formatRelative(ago(8 * DAY), NOW)).toBe('1w ago')
    expect(formatRelative(ago(40 * DAY), NOW)).toBe('1mo ago')
    expect(formatRelative(ago(800 * DAY), NOW)).toBe('2y ago')
  })
  it('reads a future date as just now and an invalid one as a dash', () => {
    expect(formatRelative(new Date(NOW + DAY), NOW)).toBe('just now')
    expect(formatRelative(new Date('nope'), NOW)).toBe('—')
  })
})

describe('coerceProject', () => {
  it('falls back to defaults for an empty project', () => {
    expect(coerceProject({}, NOW)).toEqual({
      id: '',
      name: 'Untitled project',
      description: '',
      type: 'base',
      status: 'active',
      cases: 0,
      components: 0,
      lastRun: '—',
      updated: '—',
    })
  })
  it('reads more than one case as a comparison and archived projects', () => {
    const p = coerceProject({ id: 7, name: 'Bike', caseCount: 2, componentCount: 9, archived: true, updatedAt: ago(5 * MIN) }, NOW)
    expect(p).toMatchObject({ id: '7', type: 'comparative', status: 'archived', cases: 2, components: 9, updated: '5m ago', lastRun: '5m ago' })
  })
  it('counts loaded cases and their components when the totals are missing', () => {
    const p = coerceProject({ cases: [{ components: [1, 2] }, { components: [3] }, {}] }, NOW)
    expect(p.cases).toBe(3)
    expect(p.components).toBe(3)
  })
  it('prefers the last run over the update time', () => {
    expect(coerceProject({ updatedAt: ago(DAY), lastRun: ago(3 * 60 * MIN) }, NOW).lastRun).toBe('3h ago')
    expect(coerceProject({ updatedAt: ago(DAY), lastAssessmentAt: ago(2 * DAY) }, NOW).lastRun).toBe('2d ago')
  })
})

const list: CoercedProject[] = [
  { id: '1', name: 'Bike frame', description: 'Steel vs aluminium', type: 'comparative', status: 'active', cases: 2, components: 9, lastRun: '', updated: '' },
  { id: '2', name: 'Kettle', description: '', type: 'base', status: 'archived', cases: 1, components: 3, lastRun: '', updated: '' },
]

describe('filterProjects', () => {
  it('filters by chip', () => {
    expect(filterProjects(list, 'all', '').map((p) => p.id)).toEqual(['1', '2'])
    expect(filterProjects(list, 'base', '').map((p) => p.id)).toEqual(['2'])
    expect(filterProjects(list, 'comp', '').map((p) => p.id)).toEqual(['1'])
    expect(filterProjects(list, 'active', '').map((p) => p.id)).toEqual(['1'])
  })
  it('searches name and description, case-insensitively; blank search is no search', () => {
    expect(filterProjects(list, 'all', 'ALUM').map((p) => p.id)).toEqual(['1'])
    expect(filterProjects(list, 'all', 'kett').map((p) => p.id)).toEqual(['2'])
    expect(filterProjects(list, 'all', '   ')).toHaveLength(2)
    expect(filterProjects(list, 'base', 'bike')).toEqual([])
  })
})

describe('totals and names', () => {
  it('sums cases and steps', () => {
    expect(projectTotals(list)).toEqual({ totalCases: 3, totalComponents: 12 })
    expect(projectTotals([])).toEqual({ totalCases: 0, totalComponents: 0 })
  })
  it('greets by first name, else "there"', () => {
    expect(greetingName('Ada Lovelace')).toBe('Ada')
    expect(greetingName('')).toBe('there')
    expect(greetingName(undefined)).toBe('there')
  })
  it('takes up to two initials, else KP', () => {
    expect(initialsOf('ada byron lovelace')).toBe('AB')
    expect(initialsOf('Plato')).toBe('P')
    expect(initialsOf('')).toBe('KP')
    expect(initialsOf(null)).toBe('KP')
  })
})

describe('libraryCounts', () => {
  it('sums factors across methods and reads the substance total', () => {
    expect(libraryCounts({ success: true, factorsByMethod: [{ factors: 120 }, { factors: '30' }, {}], substances: { total: '77' } })).toEqual({ factors: 150, components: 77 })
  })
  it('is null when the status call failed', () => {
    expect(libraryCounts(null)).toBeNull()
    expect(libraryCounts({ success: false })).toBeNull()
  })
  it('reads missing lists as zero', () => {
    expect(libraryCounts({ success: true })).toEqual({ factors: 0, components: 0 })
  })
})

describe('homeKpis', () => {
  const fmtInt = (n: number) => n.toLocaleString('en-US')
  it('shows honest empty states', () => {
    const k = homeKpis({ projectCount: 0, totalCases: 0, totalComponents: 0, factors: 0, substances: 0, fmtInt })
    expect(k.map((t) => [t.label, t.numeric, t.sub])).toEqual([
      ['PROJECTS', 0, 'None yet'],
      ['CASES', 0, 'Designs being assessed'],
      ['FACTORS', 0, 'Awaiting sync'],
      ['SUBSTANCES', 0, 'In substance catalog'],
    ])
  })
  it('links the library tiles and formats step counts', () => {
    const k = homeKpis({ projectCount: 2, totalCases: 3, totalComponents: 1200, factors: 5, substances: 9, fmtInt })
    expect(k[0].sub).toBe('2 total')
    expect(k[1].sub).toBe('1,200 process steps')
    expect(k[2]).toMatchObject({ sub: 'In factor library', href: '/library/factors', hrefHint: 'Browse factor library', icon: 'database' })
    expect(k[3]).toMatchObject({ href: '/library/substances', icon: 'layers' })
    expect(k[0].href).toBeUndefined()
  })
})

describe('ISO_STEPS', () => {
  it('lists the five ISO 14040 phases in order', () => {
    expect(ISO_STEPS.map((s) => s.title)).toEqual(['Goal & scope', 'Inventory', 'Impact assessment', 'Interpretation', 'Report'])
  })
})
