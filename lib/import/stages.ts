/**
 * The life-cycle stage an import gives the steps it touches (F4). A stage is a
 * label on a step (lib/life-cycle.ts), so the rule is about steps:
 *
 *   - A step that takes in a material from a bill of materials is in the
 *     Materials stage: producing what you buy in, before it reaches your gate.
 *     The sample study does the same ("10. Cut blank" takes in the steel and is
 *     Materials). It replaces an unset stage or Production only, never one a
 *     person chose otherwise (Distribution, Use, End of life).
 *   - Every other step the import creates, or puts a line on, is Production
 *     (the plant's own steps), and only where no stage is set yet.
 *   - The product at the top is left alone: it holds no flows of its own.
 *
 * Without this every imported step read "Stage: Not set" while the results put
 * all of it in Production and warned that a cradle-to-gate study had nothing
 * in Materials, though the bill of materials was clearly in. Pure.
 */

import type { StageId } from '@/lib/life-cycle'
import { lineKind } from '@/lib/import/line-kind'

export interface StageStep {
  id: number
  name: string
  tier: string
  /** The stage the step has now (null: not set). */
  stage: string | null
  /** True when this import made the step. */
  created: boolean
}

export interface StageLine {
  step_id: number
  direction: string
  unit?: string | null
  substance_text?: string | null
  substance_name?: string | null
}

export interface StageChange {
  id: number
  name: string
  stage: StageId
}

/** The stage each step should get from this import; steps that keep theirs are left out. */
export function importStages(args: { docType: string | null | undefined; steps: StageStep[]; lines: StageLine[] }): StageChange[] {
  const fromBom = args.docType === 'bom'
  const takesMaterial = new Set<number>()
  const receives = new Set<number>()
  for (const l of args.lines) {
    receives.add(l.step_id)
    if (fromBom && l.direction === 'input' && lineKind(l) === 'material') takesMaterial.add(l.step_id)
  }
  const out: StageChange[] = []
  for (const s of args.steps) {
    if (s.tier === 'product') continue
    const now = (s.stage ?? '').trim().toLowerCase() || null
    if (takesMaterial.has(s.id)) {
      if (now === null || now === 'production') out.push({ id: s.id, name: s.name, stage: 'materials' })
      continue
    }
    if (now === null && (s.created || receives.has(s.id))) out.push({ id: s.id, name: s.name, stage: 'production' })
  }
  return out
}

/** "Stage set to Materials on 10. Cut tube and 30. Pack, because they take in the bill of materials." */
export function materialsStageNote(changes: Array<{ name: string; stage: string }>): string | null {
  const names = changes.filter((c) => c.stage === 'materials').map((c) => c.name)
  if (!names.length) return null
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `Stage set to Materials on ${list}, because ${names.length === 1 ? 'it takes' : 'they take'} in the bill of materials. Change it on the step if it is wrong.`
}
