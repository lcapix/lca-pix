/**
 * Which column is which, for the three spreadsheet kinds (bill of materials,
 * routing, equipment list). The readers find columns by their header; when a
 * file's headers are not ones they know, the person says what each column
 * holds and the file is read again with that choice. The choice is kept per
 * project and header layout, so the next file laid out the same way reads in
 * without asking. No model is involved: the same file and choice read the
 * same way every time. Pure.
 */
import { createHash } from 'node:crypto'
import { detectBomColumns, type BomColumnMap } from './bom'
import { detectRoutingColumns, type RoutingColumnMap } from './routing'
import { detectEquipmentColumns, type EquipmentColumnMap } from './equipment'
import type { TimeUnit } from './parse-values'

export type MappedConnector = 'bom' | 'routing' | 'equipment'
export const MAPPED_CONNECTORS: MappedConnector[] = ['bom', 'routing', 'equipment']
export const isMappedConnector = (c: string): c is MappedConnector => (MAPPED_CONNECTORS as string[]).includes(c)

/** What a person can say a column holds, in their words, per kind of file. */
export const COLUMN_FIELDS: Record<MappedConnector, Array<{ id: string; label: string }>> = {
  bom: [
    { id: 'part', label: 'Part number' },
    { id: 'description', label: 'Name or description' },
    { id: 'material', label: 'Material' },
    { id: 'quantity', label: 'Quantity' },
    { id: 'unit', label: 'Unit of the quantity' },
    { id: 'weight', label: 'Weight of one' },
    { id: 'weightUnit', label: 'Unit of the weight' },
    { id: 'unitCost', label: 'Cost of one' },
    { id: 'extCost', label: 'Line total cost' },
    { id: 'opHint', label: 'Step it is used at' },
    { id: 'level', label: 'BOM level' },
  ],
  routing: [
    { id: 'seq', label: 'Step number' },
    { id: 'description', label: 'Step name or description' },
    { id: 'workCenter', label: 'Work center or machine' },
    { id: 'line', label: 'Line or department' },
    { id: 'setupHrs', label: 'Setup time' },
    { id: 'runHrs', label: 'Run time per unit' },
    { id: 'laborHrs', label: 'Labor time' },
    { id: 'machineHrs', label: 'Machine time' },
    { id: 'lotSize', label: 'Lot size' },
    { id: 'baseQty', label: 'Base quantity' },
    { id: 'timeUnit', label: 'Time unit' },
  ],
  equipment: [
    { id: 'asset', label: 'Asset ID' },
    { id: 'description', label: 'Equipment name' },
    { id: 'workCenter', label: 'Work center' },
    { id: 'power', label: 'Rated power' },
    { id: 'load', label: 'Load factor' },
    { id: 'count', label: 'How many' },
  ],
}

/** What a file needs before it can be read, in words for the person. */
export const COLUMNS_NEEDED: Record<MappedConnector, string> = {
  bom: 'a name, part number or material column, and a quantity or weight column',
  routing: 'a step name or step number column',
  equipment: 'a work center column and a rated power column',
}

/** Column → field, as the person sees and edits it. 'ignore' leaves a column out. */
export type ColumnChoice = Record<string, string>
/** Field → column, as the readers use it. */
export type FieldMap = Record<string, string | undefined>

/** The readers' field → column map, turned round for the person. */
export function choiceFromFields(fields: FieldMap): ColumnChoice {
  const out: ColumnChoice = {}
  for (const [field, header] of Object.entries(fields)) if (header && !(header in out)) out[header] = field
  return out
}

/**
 * The map a reader uses: what it found by header, with the person's choice on
 * top. A column the person named moves to the field they gave it (or to none,
 * for 'ignore'), and a field they gave a column loses whatever column it had.
 */
export function applyChoice(auto: FieldMap, choice: ColumnChoice, connector: MappedConnector): FieldMap {
  const known = new Set(COLUMN_FIELDS[connector].map((f) => f.id))
  const out: FieldMap = { ...auto }
  for (const [field, header] of Object.entries(out)) if (header && header in choice) delete out[field]
  for (const [header, field] of Object.entries(choice)) if (known.has(field)) out[field] = header
  return out
}

/** The field → column map a file is read with, for its headers and the person's choice. */
export function fieldMapFor(
  connector: MappedConnector,
  headers: string[],
  rows: Array<Record<string, unknown>>,
  timeHints: Record<string, TimeUnit>,
  choice: ColumnChoice,
): FieldMap {
  const auto: FieldMap =
    connector === 'bom'
      ? (detectBomColumns(headers) as FieldMap)
      : connector === 'routing'
        ? (detectRoutingColumns(headers, rows, timeHints) as FieldMap)
        : (detectEquipmentColumns(headers) as FieldMap)
  return applyChoice(auto, choice, connector)
}

/** Whether a map has the columns the kind of file needs (COLUMNS_NEEDED). */
export function columnsReady(connector: MappedConnector, m: FieldMap): boolean {
  if (connector === 'bom') return !!(m.description || m.part || m.material) && !!(m.quantity || m.weight)
  if (connector === 'routing') return !!(m.description || m.seq)
  return !!(m.workCenter && m.power)
}

/** A choice sent by the browser, kept only where it names a real column and a real field. */
export function cleanChoice(raw: unknown, headers: string[], connector: MappedConnector): ColumnChoice | null {
  let v = raw
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const fields = new Set([...COLUMN_FIELDS[connector].map((f) => f.id), 'ignore'])
  const cols = new Set(headers)
  const out: ColumnChoice = {}
  for (const [h, f] of Object.entries(v as Record<string, unknown>)) {
    if (cols.has(h) && typeof f === 'string' && fields.has(f)) out[h] = f
  }
  return out
}

/** One id for a header layout: the same headers, in any order or case, give the same id. */
export function headerSignature(headers: string[]): string {
  const norm = headers.map((h) => String(h).trim().toLowerCase()).filter(Boolean).sort()
  return createHash('sha256').update(norm.join('\u0000')).digest('hex').slice(0, 40)
}

/** Each column with the first value under it, for the person to recognise. */
export function columnSamples(headers: string[], rows: Array<Record<string, unknown>>): Array<{ name: string; sample: string }> {
  return headers.map((name) => {
    const hit = rows.find((r) => String(r[name] ?? '').trim() !== '')
    return { name, sample: hit ? String(hit[name]).trim().slice(0, 40) : '' }
  })
}

/** Narrow a field map to one reader's type. */
export const asBom = (m: FieldMap) => m as BomColumnMap
export const asRouting = (m: FieldMap) => m as RoutingColumnMap
export const asEquipment = (m: FieldMap) => m as EquipmentColumnMap
