/**
 * The life-cycle stage an import gives the steps it touches (F4). The steps a
 * routing, a bill of materials or an equipment list describe are the plant's
 * own work, so a step the import creates or puts a line on is Production where
 * no stage is set yet; a stage a person chose is never changed, and the
 * product at the top is left alone (it holds no flows of its own).
 *
 * Materials is not a step's stage here: a material going in counts in the
 * Materials stage through its flow (lib/life-cycle.ts flowStage), so welding,
 * assembly or packing stay Production while their steel, aluminium or
 * cardboard count under Materials. Pure.
 */
import type { StageId } from '@/lib/life-cycle'

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
  const receives = new Set<number>(args.lines.map((l) => l.step_id))
  const out: StageChange[] = []
  for (const s of args.steps) {
    if (s.tier === 'product') continue
    const now = (s.stage ?? '').trim().toLowerCase() || null
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
