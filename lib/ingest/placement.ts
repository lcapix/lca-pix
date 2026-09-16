// Which process step a bill-of-materials line belongs to. A BOM says what the
// product is made of, not which step uses each part, so each line gets a
// SUGGESTED step with a reason and a confidence, and the reviewer confirms or
// changes it. Order of evidence: the document names the step (an operation
// column on the BOM line) > the part shares words with a step's name >
// purchased parts default to the assembly step. Nothing is placed without a
// visible reason; a line with no evidence stays unplaced.

export interface PlaceableStep {
  id: number
  name: string
  tier: string
}

export interface PlacementSuggestion {
  stepId: number | null
  /** 0..1 — how strong the evidence is. */
  confidence: number
  reason: string
}

const STOP = new Set([
  'and', 'the', 'for', 'with', 'from', 'into', 'main', 'set', 'kit', 'pair', 'pack', 'part', 'parts',
  'each', 'unit', 'units', 'assy', 'sub', 'std', 'misc', 'other', 'final',
])

function tokens(s: string): string[] {
  return String(s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('ies') ? `${t.slice(0, -3)}y` : t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
}

const stepNumber = (s: string): string | null => s.match(/^\s*(?:op(?:eration)?\.?\s*|step\s*)?(\d{1,5})\b/i)?.[1] ?? null

/** Steps a material can be consumed at: operations (and tasks) — the unit processes. */
export function placeableSteps<T extends PlaceableStep>(all: T[]): T[] {
  const ops = all.filter((s) => s.tier === 'operation' || s.tier === 'elemental_task')
  return ops.length ? ops : all.filter((s) => s.tier !== 'product')
}

export function suggestPlacement(
  line: { label?: string; material?: string; opHint?: string },
  allSteps: PlaceableStep[],
): PlacementSuggestion {
  const steps = placeableSteps(allSteps)
  if (!steps.length) return { stepId: null, confidence: 0, reason: 'no steps in this case yet' }

  // 1. The document names the step.
  const hint = String(line.opHint ?? '').trim()
  if (hint) {
    const no = stepNumber(hint)
    const byNo = no ? steps.filter((s) => stepNumber(s.name) === no) : []
    if (byNo.length === 1) return { stepId: byNo[0].id, confidence: 0.95, reason: `document says step ${no}` }
    const h = hint.toLowerCase()
    const byName = steps.filter((s) => s.name.toLowerCase().includes(h) || h.includes(s.name.toLowerCase()))
    if (byName.length === 1) return { stepId: byName[0].id, confidence: 0.9, reason: `document names "${hint}"` }
  }

  // 2. The part shares words with a step's name ("Front Wheel" ~ "Build & true wheels").
  const want = new Set(tokens(`${line.label ?? ''} ${line.material ?? ''}`))
  let best: { step: PlaceableStep; shared: string[] } | null = null
  for (const s of steps) {
    const shared = [...new Set(tokens(s.name))].filter((t) => want.has(t))
    if (shared.length && (!best || shared.length > best.shared.length)) best = { step: s, shared }
  }
  if (best) {
    return {
      stepId: best.step.id,
      confidence: Math.min(0.85, 0.6 + 0.1 * best.shared.length),
      reason: `name match: "${best.shared.join('", "')}"`,
    }
  }

  // 3. A purchased part with no better evidence is consumed at assembly.
  const assembly = [...steps].reverse().find((s) => /assembl/i.test(s.name))
  if (line.label && assembly) {
    return { stepId: assembly.id, confidence: 0.4, reason: 'purchased part → assembly step (check)' }
  }
  return { stepId: null, confidence: 0, reason: 'no match — choose a step' }
}
