// The computations behind the Magic Insights modal: which categories can be
// picked, the contributors and material shares of the active one, cost set
// against impact, and the facts sent for AI narration. Pure (no React, no
// browser globals), so the modal's hook and any redesigned screen share one
// tested core. The insight sentences live in ./insight-text, the citation
// tokens in ./citations.

import { consultantRead, type ConsultantItem } from '@/lib/insights/consultant'
import type { InsightFacts } from '@/lib/insights/prompt'

/** One step (component) under the active category: its value and share. */
export interface Contributor {
  id: string
  name: string
  pct: number
  value: number
}

/** A category total from the run, in the category's unit. */
export interface ImpactValue {
  value: number
  unit: string
}

/** One category's impact on one component. */
export interface ComponentImpact {
  category_name: string
  impact_value: number
  unit: string
}

/** Per-component breakdown of a run: one entry per step. */
export interface ComponentBreakdownEntry {
  component_id: string | number
  component_name: string
  impacts: ComponentImpact[]
}

/** Per-flow impact row (category, substance, step): names the lever by material. */
export type MaterialFlowRow = { category_name: string; name: string; value: number; step: string; tier?: string | null }

/** One step's cost columns, so cost can be set against impact step by step. */
export type StepCostRow = { id: string; name: string; labor: number; material: number; energy: number; other: number }

/** The insight modes offered as action chips. */
export type ChipId = 'summary' | 'reduce' | 'tradeoff' | 'base' | 'custom'

/** An action chip: its mode, label and icon. */
export interface InsightChip {
  id: ChipId
  label: string
  icon: 'sparkle' | 'arrow-down' | 'dollar' | 'layers' | 'message'
}

/**
 * State of the AI narration request. 'limited': the server's per-user hourly
 * narration limit answered 429.
 */
export type AiStatus = 'idle' | 'streaming' | 'done' | 'fallback' | 'limited'

/** A material's share of the active category, as the insight text uses it. */
export type MaterialShare = { name: string; pct: number; steps: number }

/** A material grouped across the steps that use it (value, share, step count). */
export interface MaterialRow extends MaterialShare {
  value: number
}

/** Cost split by kind, and each step's share of cost next to its share of impact. */
export interface CostView {
  split: { material: number; labor: number; energy: number; other: number }
  steps: Array<{ id: string; name: string; costPct: number; impactPct: number }>
}

/** The active category resolved: label, unit, total and contributors. */
export interface ActiveCategory {
  activeLabel: string
  activeUnit: string
  activeTotal: number | undefined
  contributors: Contributor[]
  /** Every step's share of the active category (not only the top five), by id. */
  stepShares: Map<string, number>
}

/** Select key of the "overall" option (not a real category name). */
export const OVERALL_KEY = '__overall__'
/** How long typing in the reduce target must pause before it applies. */
export const REDUCE_DEBOUNCE_MS = 400
/** Label of the "overall" option and of the load it describes. */
export const OVERALL_LABEL = 'Overall environmental load'
/** Reduce-target presets, in percent. */
export const REDUCE_PRESETS: readonly number[] = [10, 20, 30, 50]

/** The action chips, in display order. */
export const INSIGHT_CHIPS: InsightChip[] = [
  { id: 'summary', label: 'Summary', icon: 'sparkle' },
  { id: 'reduce', label: `Reduce environmental load by X%`, icon: 'arrow-down' },
  { id: 'tradeoff', label: 'Cost vs environmental load trade-off', icon: 'dollar' },
  { id: 'base', label: 'Compare to base', icon: 'layers' },
  { id: 'custom', label: 'Ask anything', icon: 'message' },
]

/** A chip's label; the reduce chip shows the current target in place of "X". */
export function chipLabel(chip: InsightChip, reducePct: number): string {
  // Render the reduce chip with the user-editable percentage in place of "X".
  return chip.id === 'reduce'
    ? `Reduce environmental load by ${reducePct}%`
    : chip.label
}

/** Available category options (real categories + an "overall" option first). */
export function buildCategoryOptions(impacts: Record<string, ImpactValue> | undefined): Array<{ key: string; label: string }> {
  const real = impacts ? Object.keys(impacts) : []
  return [{ key: OVERALL_KEY, label: OVERALL_LABEL }, ...real.map((k) => ({ key: k, label: k }))]
}

/** The category selected on open: the initial one if the run has it, else overall. */
export function initialCategoryKey(
  initialCategory: string | undefined,
  impacts: Record<string, ImpactValue> | undefined,
): string {
  return initialCategory && impacts?.[initialCategory] ? initialCategory : OVERALL_KEY
}

/**
 * Typed reduce target → the target to apply: rounded and clamped to 1–100,
 * or null when the text is not a number (the previous target stays).
 */
export function clampReduceTarget(input: string): number | null {
  const n = parseFloat(input)
  if (Number.isNaN(n)) return null
  return Math.max(1, Math.min(100, Math.round(n)))
}

/**
 * Resolve the active category, its unit, and the contributors under it: the
 * top five steps by value with their share of all positive steps.
 */
export function resolveActiveCategory(
  selectedCategory: string,
  impacts: Record<string, ImpactValue> | undefined,
  componentBreakdown: ComponentBreakdownEntry[] | undefined,
): ActiveCategory {
  if (selectedCategory === OVERALL_KEY) {
    // "Overall" = sum of per-category normalized loads. We approximate "overall"
    // by treating each category equally and summing each component's share
    // across categories. (The real tool does proper EPS weighting; this view
    // is an at-a-glance heuristic.)
    const perComp = new Map<string, { name: string; value: number }>()
    ;(componentBreakdown ?? []).forEach((c) => {
      const id = String(c.component_id)
      let total = 0
      c.impacts.forEach((i) => {
        const catTotal = impacts?.[i.category_name]?.value
        if (catTotal && catTotal > 0 && i.impact_value > 0) {
          total += i.impact_value / catTotal
        }
      })
      if (total > 0) {
        perComp.set(id, { name: c.component_name, value: total })
      }
    })
    const sorted = Array.from(perComp.entries())
      .map(([id, v]) => ({ id, name: v.name, value: v.value }))
      .sort((a, b) => b.value - a.value)
    const sum = sorted.reduce((s, c) => s + c.value, 0) || 1
    const contribs: Contributor[] = sorted.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      value: c.value,
      pct: (c.value / sum) * 100,
    }))
    return {
      activeLabel: OVERALL_LABEL,
      activeUnit: 'normalized share',
      activeTotal: undefined as number | undefined,
      contributors: contribs,
      stepShares: new Map(sorted.map((c) => [c.id, (c.value / sum) * 100])),
    }
  }

  const catTotal = impacts?.[selectedCategory]?.value
  const catUnit = impacts?.[selectedCategory]?.unit ?? ''
  const rows = (componentBreakdown ?? [])
    .map((c) => {
      const match = c.impacts.find((i) => i.category_name === selectedCategory)
      return {
        id: String(c.component_id),
        name: c.component_name,
        value: match?.impact_value ?? 0,
      }
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const sum = rows.reduce((s, c) => s + c.value, 0) || 1
  const contribs: Contributor[] = rows.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    value: c.value,
    pct: (c.value / sum) * 100,
  }))
  return {
    activeLabel: selectedCategory,
    activeUnit: catUnit,
    activeTotal: catTotal,
    contributors: contribs,
    stepShares: new Map(rows.map((c) => [c.id, (c.value / sum) * 100])),
  }
}

/**
 * The same result grouped by material (one material can sit on several
 * steps). This is the lever to name: a step only books where a part is used.
 * Empty for the overall view.
 */
export function materialShares(
  materialBreakdown: MaterialFlowRow[] | undefined,
  selectedCategory: string,
): MaterialRow[] {
  if (!materialBreakdown?.length || selectedCategory === OVERALL_KEY) return []
  const by = new Map<string, { value: number; steps: Set<string> }>()
  for (const f of materialBreakdown) {
    if (f.category_name !== selectedCategory || !(f.value > 0)) continue
    const e = by.get(f.name) ?? { value: 0, steps: new Set<string>() }
    e.value += f.value
    e.steps.add(f.step)
    by.set(f.name, e)
  }
  const sum = [...by.values()].reduce((s, e) => s + e.value, 0) || 1
  return [...by.entries()]
    .map(([name, e]) => ({ name, value: e.value, pct: (e.value / sum) * 100, steps: e.steps.size }))
    .sort((a, b) => b.value - a.value)
}

/**
 * What a sustainability consultant would look at first, triggered by this
 * run's own flows for the selected category (levers, not numbers). Empty for
 * the overall view.
 */
export function consultantForCategory(
  materialBreakdown: MaterialFlowRow[] | undefined,
  selectedCategory: string,
): ConsultantItem[] {
  if (!materialBreakdown?.length || selectedCategory === OVERALL_KEY) return []
  return consultantRead(
    materialBreakdown
      .filter((f) => f.category_name === selectedCategory)
      .map((f) => ({ name: f.name, value: f.value, step: f.step, tier: f.tier ?? null })),
    { categoryLabel: selectedCategory },
  )
}

/**
 * Cost set against impact: the case's cost split by kind, and each step's
 * share of cost next to its share of the selected category. Null when the
 * case has no positive cost.
 */
export function buildCostView(
  stepCosts: StepCostRow[] | undefined,
  stepShares: Map<string, number>,
): CostView | null {
  const steps = stepCosts ?? []
  const sums = { material: 0, labor: 0, energy: 0, other: 0 }
  for (const c of steps) {
    for (const k of ['material', 'labor', 'energy', 'other'] as const) sums[k] += c[k] > 0 ? c[k] : 0
  }
  const total = sums.material + sums.labor + sums.energy + sums.other
  if (!(total > 0)) return null
  const pctOf = (v: number) => (v / total) * 100
  return {
    split: {
      material: pctOf(sums.material),
      labor: pctOf(sums.labor),
      energy: pctOf(sums.energy),
      other: pctOf(sums.other),
    },
    steps: steps
      .map((c) => ({
        id: c.id,
        name: c.name,
        costPct: pctOf(c.labor + c.material + c.energy + c.other),
        impactPct: stepShares.get(c.id) ?? 0,
      }))
      .filter((st) => st.costPct > 0 || st.impactPct > 0)
      .sort((a, b) => b.impactPct - a.impactPct),
  }
}

/** Questions this case can actually answer, for the free-text box. */
export function exampleQuestions(
  selectedCategory: string,
  activeLabel: string,
  materials: MaterialShare[],
): string[] {
  return [
    `Can we cut ${selectedCategory === OVERALL_KEY ? 'the footprint' : activeLabel} by 30%?`,
    materials[0] ? `What if the ${materials[0].name.toLowerCase()} were recycled?` : 'What drives this result?',
  ]
}

/** Everything the AI narration request is built from. */
export interface InsightFactsInput {
  caseName: string
  method: string
  activeLabel: string
  activeUnit: string
  activeTotal: number | undefined
  totalCost: number | undefined
  contributors: Contributor[]
  materials: MaterialRow[]
  consultant: ConsultantItem[]
  costView: CostView | null
  activeChip: ChipId
  reducePct: number
  submittedPrompt: string
  impacts: Record<string, ImpactValue> | undefined
}

/**
 * The facts POSTed to /api/insights for AI narration (the request body): the
 * computed figures only, so the model phrases and never invents a number.
 */
export function buildInsightFacts({
  caseName,
  method,
  activeLabel,
  activeUnit,
  activeTotal,
  totalCost,
  contributors,
  materials,
  consultant,
  costView,
  activeChip,
  reducePct,
  submittedPrompt,
  impacts,
}: InsightFactsInput): InsightFacts {
  return {
    caseName,
    method,
    categoryLabel: activeLabel,
    total: activeTotal !== undefined ? { value: activeTotal, unit: activeUnit } : undefined,
    totalCost,
    contributors: contributors.map((c) => ({ name: c.name, pct: c.pct, value: c.value })),
    materials: materials.slice(0, 5).map((m) => ({ name: m.name, pct: m.pct, value: m.value })),
    levers: consultant.map((c) => ({ title: c.title, why: c.why, moves: c.moves })),
    costSplit: costView
      ? [
          { name: 'Purchased material', pct: costView.split.material },
          { name: 'Labor', pct: costView.split.labor },
          { name: 'Energy', pct: costView.split.energy },
          { name: 'Other', pct: costView.split.other },
        ].filter((c) => c.pct > 0)
      : undefined,
    stepCosts: costView?.steps.slice(0, 6).map((st) => ({ name: st.name, costPct: st.costPct, impactPct: st.impactPct })),
    mode: activeChip,
    reducePct: activeChip === 'reduce' ? reducePct : undefined,
    question: activeChip === 'custom' ? submittedPrompt : undefined,
    // Full impact profile (every category), so the model can reason across
    // categories instead of only restating the one on screen.
    allCategories: impacts
      ? Object.entries(impacts).map(([name, v]) => ({ name, value: v.value, unit: v.unit }))
      : [],
  }
}

/** What the body shows: the AI narration or the computed insight, and the cursor. */
export interface NarrationView {
  usingAI: boolean
  bodyText: string
  showCursor: boolean
}

/**
 * What actually renders: AI narration when in AI mode and it produced text,
 * otherwise the deterministic computed insight (also the fallback).
 */
export function narrationView(args: {
  aiMode: boolean
  aiStatus: AiStatus
  aiText: string
  streamed: string
  done: boolean
}): NarrationView {
  const { aiMode, aiStatus, aiText, streamed, done } = args
  const usingAI = aiMode && aiStatus !== 'fallback' && (aiStatus === 'streaming' || aiStatus === 'done')
  const bodyText = usingAI ? aiText : streamed
  const showCursor = usingAI ? aiStatus === 'streaming' : !done
  return { usingAI, bodyText, showCursor }
}
