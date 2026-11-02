/**
 * What a line from a file is, in the words the review uses: energy (power or
 * a fuel, read by its unit or its name) or a material. An electricity line
 * from an equipment list is not "saved as a material". Pure.
 */

export type LineKind = 'energy' | 'material'

// Units that only ever measure energy. A fuel bought by mass or volume (diesel
// in litres, coal in kg) is caught by its name below instead.
const ENERGY_UNITS = new Set(['kwh', 'mwh', 'gwh', 'wh', 'mj', 'gj', 'kj', 'j', 'therm', 'therms', 'btu', 'mmbtu', 'kbtu'])

// Names of energy carriers as files write them.
const ENERGY_NAME = /\b(electricity|electric power|grid power|natural gas|diesel|fuel oil|heating oil|gasoline|petrol|propane|lpg|kerosene|steam|district heat|heat)\b/i

/** Energy when the unit is an energy unit or the name is an energy carrier; else a material. */
export function lineKind(line: { substance_text?: string | null; substance_name?: string | null; unit?: string | null }): LineKind {
  const unit = String(line.unit ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (ENERGY_UNITS.has(unit)) return 'energy'
  const names = `${line.substance_name ?? ''} ${line.substance_text ?? ''}`
  return ENERGY_NAME.test(names) ? 'energy' : 'material'
}

/** "energy use" or "a material", for "Save X as …". */
export function lineKindWord(kind: LineKind): string {
  return kind === 'energy' ? 'energy use' : 'a material'
}

/**
 * The foot of the lines table: what the ticked lines are saved as, counted by
 * kind, so an equipment list says "energy use" and a bill of materials says
 * "materials". "The 5 ticked lines are saved as energy use."
 */
export function tickedLinesSentence(kinds: LineKind[]): string {
  const n = kinds.length
  if (n === 0) return 'No line is ticked, so none is saved.'
  const energy = kinds.filter((k) => k === 'energy').length
  const material = n - energy
  const lead = `The ${n} ticked ${n === 1 ? 'line is' : 'lines are'} saved as`
  if (energy === 0) return `${lead} ${material === 1 ? 'a material' : 'materials'}.`
  if (material === 0) return `${lead} energy use.`
  return `${lead} ${material} ${material === 1 ? 'material' : 'materials'} and ${energy} energy ${energy === 1 ? 'line' : 'lines'}.`
}
