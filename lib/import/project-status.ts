// Project-level intake status (item 10): which layers this project already has
// across ALL its cases, and which are still missing anywhere — a running
// checklist so the reviewer knows what document to bring next. Also the
// project's case list as the ADD TO picker uses it. Pure.

import type { ProjectCase } from '@/lib/import/apply-body'

/** Layers present in any case, and layers no case has yet (with the documents that would fill them). */
export interface ProjectStatus {
  present: string[]
  missing: Array<{ layer: string; label: string; docs: string[] }>
}

/** The project's cases from a /api/projects/:id/cases answer, or null when it has no cases array. */
export function projectCasesFrom(d: any): ProjectCase[] | null {
  if (!Array.isArray(d?.cases)) return null
  return d.cases.map((c: any) => ({
    case_id: c.case_id ?? c.id,
    case_name: c.case_name ?? c.name,
  }))
}

/**
 * Merge per-case completeness reports into the project's status. A layer
 * present in any case is not missing; for a missing layer the last report
 * naming it wins. A malformed report keeps whatever was read from it before
 * it failed and is otherwise skipped, like a case that fails to report.
 */
export function mergeProjectStatus(reports: any[]): ProjectStatus {
  const presentSet = new Set<string>()
  const missingMap = new Map<string, { label: string; docs: string[] }>()
  for (const rep of reports) {
    if (!rep) continue
    try {
      ;(rep.present ?? []).forEach((l: string) => presentSet.add(l))
      ;(rep.missing ?? []).forEach((m: any) =>
        missingMap.set(m.layer, { label: m.label, docs: m.suggestedDocs ?? [] }),
      )
    } catch {
      /* ignore a case that fails to report */
    }
  }
  for (const l of presentSet) missingMap.delete(l)
  return {
    present: Array.from(presentSet),
    missing: Array.from(missingMap.entries()).map(([layer, v]) => ({ layer, ...v })),
  }
}

/** " (A or B)" naming the documents that fill a missing layer, or '' when there are none. */
export function docsHint(docs: string[]): string {
  return docs.length ? ` (${docs.join(' or ')})` : ''
}
