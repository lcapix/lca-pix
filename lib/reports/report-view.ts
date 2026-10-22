// What Reports (E11) says about an export, from what the export route and the
// generators actually produce: the PDF's nine sections (lib/pdf-generator.ts),
// the slides (lib/pptx-generator.ts), the inventory CSV (buildInventoryCsv).

export type ReportFormat = 'pdf' | 'pptx' | 'csv'

export const FORMAT_LABEL: Record<ReportFormat, string> = { pdf: 'PDF', pptx: 'PowerPoint', csv: 'CSV' }

/** The PDF's sections, in order (lib/pdf-generator.ts). Sources prints when the run recorded them. */
export const PDF_SECTIONS = [
  'General information',
  'Goal and scope',
  'Inventory: process tree',
  'Inventory: every flow',
  'Totals',
  'By process step',
  'Interpretation',
  'Assumptions and limits',
  'Sources',
]

/** What the report always holds today, and where in the PDF. */
export const INCLUDED = [
  { label: 'The answer', where: 'Section 5, Totals' },
  { label: 'By step', where: 'Section 6' },
  { label: 'Write-up', where: 'Sections 7 and 8' },
  { label: 'How far to trust it', where: 'In section 7' },
]

/** The line under Export: what the file holds and which moment it shows. */
export function formatNote(format: ReportFormat, runId: number): string {
  if (format === 'csv') return `Every flow of Run #${runId} by impact category: amount, factor, source and result, as it was when it ran.`
  if (format === 'pptx') return `Slides of Run #${runId} as it was when it ran. The write-up shows as it is now.`
  return `Prints Run #${runId} as it was when it ran. The write-up prints as it is now.`
}

/** "Plated housing · TRACI 2.1 · US · per 1 housing". */
export function scopeLine(parts: { project?: string | null; method?: string | null; region?: string | null; fu?: string | null }): string {
  return [parts.project, parts.method, parts.region, parts.fu ? `per ${parts.fu}` : null].filter(Boolean).join(' · ')
}

/** The case picker's option: "Base case · Run #301" or "Ana's case · not run yet". */
export function caseOption(c: { case_name: string; author?: string | null; latest_run: { run_id: number } | null }, showAuthor: boolean): string {
  const who = showAuthor && c.author ? ` (${c.author})` : ''
  return `${c.case_name}${who} · ${c.latest_run ? `Run #${c.latest_run.run_id}` : 'not run yet'}`
}
