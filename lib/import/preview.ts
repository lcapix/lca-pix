// The pick step of the import page: which path reads the document, what must
// be filled in before a preview, the preview form fields, and the bundled
// sample's defaults and blank template. Pure.

import type { DocType } from '@/lib/ingest/doc-types'

// A spreadsheet routing is read deterministically; a PDF/HTML traveler goes
// through the AI path.
/** Whether the document goes through the AI (LLM) path: an llm doc type, or a routing that is not a spreadsheet. */
export function isLLMImport(doc: DocType | undefined, connector: string, file: { name: string } | null): boolean {
  return (
    doc?.mode === 'llm' ||
    (connector === 'routing' && !!file && !/\.(csv|xlsx?|tsv)$/i.test(file.name))
  )
}

/** " Also called: a, b, c." from the doc type's first three aliases, or '' when it has none. */
export function akaHint(doc: DocType | undefined): string {
  return doc?.aka?.length ? ` Also called: ${doc.aka.slice(0, 3).join(', ')}.` : ''
}

/**
 * Why a preview cannot start yet, or null when it can: a file is needed (and
 * an assessment ID for ITAC), and an equipment list needs a target case.
 */
export function previewValidationError(args: {
  hasFile: boolean
  connector: string
  plantId: string
  targetCaseId: number | null
}): string | null {
  const { hasFile, connector, plantId, targetCaseId } = args
  if (!hasFile || (connector === 'itac' && !plantId.trim())) {
    return connector === 'itac'
      ? 'Choose a file and enter an assessment ID (e.g. WV0661).'
      : 'Choose a file (.csv or .xlsx).'
  }
  if (connector === 'equipment' && targetCaseId === null) {
    return 'An equipment list adds energy to the steps of an existing case: choose that case under ADD TO.'
  }
  return null
}

/**
 * The preview form's fields after the file, in order: connector, trimmed
 * plant_id, lot_size (routing only, when a positive number) and
 * target_case_id (when appending).
 */
export function previewFields(args: {
  connector: string
  plantId: string
  lotSize: string
  targetCaseId: number | null
}): Array<[string, string]> {
  const { connector, plantId, lotSize, targetCaseId } = args
  const fields: Array<[string, string]> = []
  fields.push(['connector', connector])
  fields.push(['plant_id', plantId.trim()])
  if (connector === 'routing' && Number(lotSize) > 0) fields.push(['lot_size', String(Number(lotSize))])
  if (targetCaseId !== null) fields.push(['target_case_id', String(targetCaseId)])
  return fields
}

/** The product name a loaded sample fills in: "Touring bike" for a routing or BOM when none is typed, else null. */
export function sampleProductName(conn: string, plantId: string): string | null {
  return (conn === 'routing' || conn === 'bom') && !plantId.trim() ? 'Touring bike' : null
}

/** A blank template from a sample CSV: its header row plus a newline. */
export function templateCsv(content: string): string {
  return content.split('\n')[0] + '\n'
}

/** File name of a connector's blank template. */
export function templateFilename(conn: string): string {
  return `${conn}-template.csv`
}
