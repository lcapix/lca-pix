// The computed (deterministic) insight for each Magic Insights chip. Numbers
// come from the case's own result; values wrapped in {{…}} render as cited
// chips (see ./citations). Pure: no React, no browser globals.

import { fmtSig } from '@/components/lcapix/formatters'
import { stepLabel, type ConsultantItem } from '@/lib/insights/consultant'
import {
  OVERALL_KEY,
  type ChipId,
  type Contributor,
  type CostView,
  type MaterialShare,
} from '@/lib/insights/magic-insights'

/** A share as text: "12.3%", or "under 0.1%" for a positive sliver. */
export const fmtShare = (p: number) => (p > 0 && p < 0.1 ? 'under 0.1%' : `${p.toFixed(1)}%`)
/** Flows that are energy or freight rather than a material you buy. */
export const NOT_MATERIAL = /electric|energy|power|natural gas|diesel|fuel|heat|steam|transport|freight|truck|ship|ocean|rail|\bair\b/i

/** Everything the computed insight for one chip is built from. */
export interface InsightTextInput {
  activeChip: ChipId
  caseName: string
  method: string
  activeLabel: string
  activeUnit: string
  activeTotal: number | undefined
  selectedCategory: string
  totalCost: number | undefined
  contributors: Contributor[]
  materials: MaterialShare[]
  consultant: ConsultantItem[]
  costView: CostView | null
  reducePct: number
  submittedPrompt: string
  /** Example questions for the free-text box (see exampleQuestions). */
  exampleQs: string[]
}

/** The computed insight for the active chip, with {{…}} citation tokens. */
export function buildInsightText({
  activeChip,
  caseName,
  method,
  activeLabel,
  activeUnit,
  activeTotal,
  selectedCategory,
  totalCost,
  contributors,
  materials,
  consultant,
  costView,
  reducePct,
  submittedPrompt,
  exampleQs,
}: InsightTextInput): string {
  const top = contributors[0]
  const second = contributors[1]
  const totalStr =
    activeTotal !== undefined
      ? `${fmtSig(activeTotal)} ${activeUnit}`
      : 'an indicative overall load'
  const costStr = totalCost !== undefined ? `$${totalCost.toLocaleString()}` : '—'
  const loadLabel = selectedCategory === OVERALL_KEY ? 'environmental load' : activeLabel

  switch (activeChip) {
    case 'summary': {
      const m0 = materials[0]
      const byMaterial = m0
        ? ` By material, {{${m0.name}}} makes up {{${m0.pct.toFixed(1)}%}} of it, across ${m0.steps} step${m0.steps === 1 ? '' : 's'}: that is the biggest lever.`
        : ''
      return `Your ${caseName} assessment under ${method} totals {{${totalStr}}} for {{${loadLabel}}} at {{${costStr}}}.${byMaterial} By step, {{${top ? stepLabel(top.name) : 'your top step'}}} carries the most ({{${top?.pct.toFixed(1) ?? '—'}%}}), and the top two steps account for {{${((top?.pct ?? 0) + (second?.pct ?? 0)).toFixed(1)}%}}.`
    }

    case 'reduce': {
      const topShare = top?.pct ?? 0
      if (!top) {
        return `No contributor data yet for {{${loadLabel}}}. Run an assessment with this category enabled to get reduce-by-${reducePct}% guidance.`
      }
      // A material that spans several steps is the real lever.
      const m0 = materials[0]
      if (m0 && m0.pct >= topShare) {
        const need = Math.min(100, Math.ceil(reducePct / (m0.pct / 100 || 1)))
        return reducePct > m0.pct
          ? `Cutting {{${loadLabel}}} by {{${reducePct}%}} is more than {{${m0.name}}} carries ({{${m0.pct.toFixed(1)}%}}), though it is the biggest share. It takes changes to several materials, or a different design.`
          : `To cut {{${loadLabel}}} by {{${reducePct}%}}, start with {{${m0.name}}}: it is {{${m0.pct.toFixed(1)}%}} of the load, across ${m0.steps} step${m0.steps === 1 ? '' : 's'}. A {{${need}%}} cut in its footprint gets you there: use less of it, a lower-carbon grade, or another material. Duplicate the case, swap it on the step${m0.steps === 1 ? '' : 's'} that use${m0.steps === 1 ? 's' : ''} it, and run both.`
      }
      // If the target exceeds what's practically achievable on the top
      // contributor, say so plainly — that's the "magic" the user asked for.
      if (reducePct > topShare) {
        return `Cutting {{${loadLabel}}} by {{${reducePct}%}} is more than any one step carries: the largest, {{${stepLabel(top.name)}}}, is {{${topShare.toFixed(1)}%}}. It takes changes on several steps, or a different design. Open each step to see which flow drives it, and test every change on a copy of the case.`
      }
      const requiredOnTop = Math.min(100, Math.ceil(reducePct / (topShare / 100 || 1)))
      return `To cut {{${loadLabel}}} by {{${reducePct}%}}, start with {{${stepLabel(top.name)}}}: it carries {{${topShare.toFixed(1)}%}} of the load, so a {{${requiredOnTop}%}} cut on that step alone reaches the target. Open it to see which material or energy flow drives it, then use less of that flow, a lower-carbon grade or supplier, or a redesigned step.${second ? ` If that step cannot change, {{${stepLabel(second.name)}}} is next.` : ''}`
    }

    case 'tradeoff':
      return tradeoffText({ loadLabel, costStr, top, materials, costView })

    case 'base':
      return baseText({ loadLabel, top, materials })

    case 'custom': {
      if (!submittedPrompt.trim()) {
        return `Type a question in the box, for example "${exampleQs[0]}" or "${exampleQs[1]}". The answer comes from this case's result only.`
      }
      return answerFreeText({
        question: submittedPrompt,
        loadLabel,
        top,
        totalStr,
        material: materials[0],
        levers: consultant,
      })
    }
  }
}

/**
 * Cost against impact, from the case's own cost columns and this run's
 * shares. Labor carries cost but no flows, so it never moves an impact.
 */
export function tradeoffText(args: {
  loadLabel: string
  costStr: string
  top?: Contributor
  materials: MaterialShare[]
  costView: CostView | null
}): string {
  const { loadLabel, costStr, top, materials, costView } = args
  if (!top) return `No results yet for {{${loadLabel}}}. Run an assessment first.`
  if (!costView) {
    return `This case has no step costs yet, so there is nothing to set against {{${loadLabel}}}. Add labor, material or energy costs on the steps, then come back.`
  }
  const { split } = costView
  const parts: string[] = [
    `Purchased material is {{${fmtShare(split.material)}}} of the {{${costStr}}} cost, labor {{${fmtShare(split.labor)}}} and energy {{${fmtShare(split.energy)}}}${split.other > 0 ? `, other costs {{${fmtShare(split.other)}}}` : ''}.`,
  ]
  const topStep = costView.steps.find((st) => st.id === top.id)
  if (topStep) {
    parts.push(`By step, {{${stepLabel(top.name)}}} carries {{${top.pct.toFixed(1)}%}} of {{${loadLabel}}} and {{${fmtShare(topStep.costPct)}}} of cost.`)
  }
  const m0 = materials[0]
  const materialImpact = materials.filter((m) => !NOT_MATERIAL.test(m.name)).reduce((sum, m) => sum + m.pct, 0)
  if (m0 && !NOT_MATERIAL.test(m0.name)) {
    parts.push(`{{${m0.name}}} alone is {{${m0.pct.toFixed(1)}%}} of {{${loadLabel}}}, and labor carries none of it: an LCA counts materials, energy and emissions, not hours.`)
    if (split.material >= 50 && materialImpact >= 50) {
      parts.push(`So cost and {{${loadLabel}}} point the same way, at what you buy. The lever is a purchasing one: ask the ${m0.name.toLowerCase()} supplier to price a recycled or lower-carbon grade next to the current one. Cutting shop hours lowers cost but does not move {{${loadLabel}}}.`)
    } else if (split.labor >= 50 && materialImpact >= 50) {
      parts.push(`So cost and {{${loadLabel}}} sit in different places: most of the cost is labor, most of {{${loadLabel}}} is material. Cutting hours lowers cost without moving {{${loadLabel}}}; the {{${loadLabel}}} lever is the ${m0.name.toLowerCase()} you buy.`)
    }
  }
  return parts.join(' ')
}

/** How to compare copies of this case fairly, and which rows will move. */
export function baseText(args: { loadLabel: string; top?: Contributor; materials: MaterialShare[] }): string {
  const { loadLabel, top, materials } = args
  if (!top) {
    return `No results yet for {{${loadLabel}}}. Run an assessment first, so copies of this case have something to compare against.`
  }
  const m0 = materials[0]
  const watch =
    m0 && !NOT_MATERIAL.test(m0.name)
      ? `If you swap {{${m0.name}}}, the rows that can move are the ${m0.steps === 1 ? 'step' : `${m0.steps} steps`} that use it ({{${m0.pct.toFixed(1)}%}} of {{${loadLabel}}} in total). The biggest single row is {{${stepLabel(top.name)}}} at {{${top.pct.toFixed(1)}%}}.`
      : `The row most likely to move is {{${stepLabel(top.name)}}}, at {{${top.pct.toFixed(1)}%}} of {{${loadLabel}}}.`
  return `Compare Cases sets copies of this case side by side, step by step. Keep the functional unit, LCIA method and region the same on every copy (the page flags a mismatch), change one thing per copy so each difference has one cause, and run each copy after the change. ${watch} Its What differs tab lists every change, and its Cost tab sets each change's cost against its impact.`
}

/**
 * Local answer to a free-text question, from this case's own result: a
 * reduction target is checked against the biggest share, and anything else is
 * matched to the consultant lever it asks about.
 */
export function answerFreeText(args: {
  question: string
  loadLabel: string
  top?: Contributor
  totalStr: string
  material?: MaterialShare
  levers: ConsultantItem[]
}): string {
  const { question, loadLabel, top, totalStr, material, levers } = args
  const q = question.toLowerCase()
  const asked = `For {{"${question}"}}:`
  const close =
    ' To put a number on a change, the case needs a factor for the new option (from the library or a supplier EPD); then duplicate the case, apply it, and run both.'
  const pctMatch = question.match(/(\d{1,3})\s*%/)
  const target = pctMatch ? Math.min(100, parseInt(pctMatch[1], 10)) : undefined

  if (target !== undefined) {
    const lead = material ?? (top ? { name: stepLabel(top.name), pct: top.pct } : undefined)
    if (!lead) return `${asked} there are no results yet for {{${loadLabel}}}. Run an assessment first.`
    if (target > lead.pct) {
      return `${asked} a {{${target}%}} cut to {{${loadLabel}}} (now {{${totalStr}}}) is more than {{${lead.name}}} carries ({{${lead.pct.toFixed(1)}%}}), and that is the biggest share. No single change gets there: it takes several materials or steps, or a different design.`
    }
    const moves = levers[0]?.moves.slice(0, 2).join(' ')
    return `${asked} a {{${target}%}} cut to {{${loadLabel}}} (now {{${totalStr}}}) is within what {{${lead.name}}} carries ({{${lead.pct.toFixed(1)}%}}), so start there.${moves ? ` ${moves}` : ''}${close}`
  }

  // Match the question to a lever: a material it names, energy, or data.
  const subject = (l: ConsultantItem) => l.title.split(' is the ')[0].toLowerCase().slice(0, 5)
  const lever =
    levers.find((l) => / is the (biggest|next) lever$/.test(l.title) && q.includes(subject(l))) ??
    (/electric|energy|power|grid|solar|renewable|oven|booth|kwh/.test(q)
      ? levers.find((l) => /electricity/i.test(l.title))
      : undefined) ??
    (/\bepd|supplier|average|data quality|factor/.test(q) ? levers.find((l) => /supplier data/i.test(l.title)) : undefined)
  if (lever) {
    return `${asked} ${lever.title}. ${lever.why} What I would do: ${lever.moves.slice(0, 2).join(' ')}${close}`
  }
  if (levers[0]) {
    return `${asked} this case's result points first to one place. ${levers[0].title}: ${levers[0].why} ${levers[0].moves[0]}${close}`
  }
  if (top) {
    return `${asked} the biggest contributor is {{${stepLabel(top.name)}}} ({{${top.pct.toFixed(1)}%}} of {{${loadLabel}}}). Open that step to see which flow drives it.${close}`
  }
  return `${asked} there are no results yet for {{${loadLabel}}}. Run an assessment first.`
}
