/**
 * Where this case stands (F2.4): six rows after a file is saved (goal and
 * scope, tree, labour hours, materials, energy, run), each done or not yet
 * with the next thing to bring, and the next action. Pure.
 */

export interface StandsInput {
  project: { functional_unit: string | null; system_boundary: string | null; lcia_method: string | null; region_code: string | null }
  steps: Array<{ name: string; type: string; labor_hours: number | null }>
  /** Layers present, from /api/cases/:id/completeness (materials, energy, …). */
  layers: string[]
  latestRunId: number | null
}

export interface StandsRow {
  key: 'scope' | 'tree' | 'labour' | 'materials' | 'energy' | 'run'
  label: string
  detail: string
  value: string
  done: boolean
}

const words = (s: string | null) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '')

export function caseStands(i: StandsInput): StandsRow[] {
  const ops = i.steps.filter((s) => s.type === 'operation')
  const withHours = ops.filter((s) => (s.labor_hours ?? 0) > 0)
  const product = i.steps.find((s) => s.type === 'product')?.name
  const lines = i.steps.filter((s) => s.type === 'machine_line').map((s) => s.name)
  const scopeDone = !!(i.project.functional_unit && i.project.functional_unit.trim())
  return [
    {
      key: 'scope',
      label: 'Goal and scope',
      detail: [i.project.functional_unit, words(i.project.system_boundary), i.project.lcia_method, i.project.region_code].filter(Boolean).join(' · ') || 'No functional unit yet',
      value: scopeDone ? 'Done' : 'Not yet',
      done: scopeDone,
    },
    {
      key: 'tree',
      label: 'Tree',
      detail: [product, ...lines.slice(0, 2)].filter(Boolean).join(' · ') || 'No steps yet',
      value: `${i.steps.length} ${i.steps.length === 1 ? 'step' : 'steps'}`,
      done: i.steps.length > 0,
    },
    {
      key: 'labour',
      label: 'Labour hours',
      detail: withHours.length ? 'Hours per unit, costed at a labour rate' : 'No hours yet. A routing gives them.',
      value: ops.length ? `${withHours.length} of ${ops.length}` : 'Not yet',
      done: ops.length > 0 && withHours.length === ops.length,
    },
    {
      key: 'materials',
      label: 'Materials',
      detail: i.layers.includes('materials') ? 'What goes in, placed on its steps' : 'Add the bill of materials.',
      value: i.layers.includes('materials') ? 'In' : 'Not yet',
      done: i.layers.includes('materials'),
    },
    {
      key: 'energy',
      label: 'Energy',
      detail: i.layers.includes('energy') ? 'Electricity and fuels on their steps' : 'Add the equipment list for machine energy.',
      value: i.layers.includes('energy') ? 'In' : 'Not yet',
      done: i.layers.includes('energy'),
    },
    {
      key: 'run',
      label: 'Run',
      detail: i.latestRunId ? 'Results are frozen with the run' : 'Nothing is computed until you run the case.',
      value: i.latestRunId ? `Run #${i.latestRunId}` : 'Not yet',
      done: !!i.latestRunId,
    },
  ]
}

/** The next file to add, as an action: the bill of materials, then the equipment list. */
export function nextFile(rows: StandsRow[]): { connector: 'bom' | 'equipment'; label: string } | null {
  if (!rows.find((r) => r.key === 'materials')?.done) return { connector: 'bom', label: 'Add the bill of materials' }
  if (!rows.find((r) => r.key === 'energy')?.done) return { connector: 'equipment', label: 'Add the equipment list' }
  return null
}
