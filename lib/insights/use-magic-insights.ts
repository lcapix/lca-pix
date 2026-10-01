'use client'

import { useEffect, useMemo, useState } from 'react'
import { useStreamText } from '@/lib/hooks/use-stream-text'
import {
  INSIGHT_CHIPS,
  REDUCE_DEBOUNCE_MS,
  buildCategoryOptions,
  buildCostView,
  buildInsightFacts,
  clampReduceTarget,
  consultantForCategory,
  exampleQuestions,
  initialCategoryKey,
  materialShares,
  narrationView,
  resolveActiveCategory,
  type AiStatus,
  type ChipId,
  type ComponentBreakdownEntry,
  type ImpactValue,
  type MaterialFlowRow,
  type StepCostRow,
} from '@/lib/insights/magic-insights'
import { buildInsightText } from '@/lib/insights/insight-text'

/** The run context the Magic Insights modal is opened with. */
export interface MagicInsightsOptions {
  open: boolean
  caseName: string
  method: string
  /** All impact category totals (key = category name). */
  impacts?: Record<string, ImpactValue>
  /** Per-component breakdown so we can compute contributors per category. */
  componentBreakdown?: ComponentBreakdownEntry[]
  /** Per-flow impacts (category, substance, step): names the lever by material. */
  materialBreakdown?: MaterialFlowRow[]
  totalCost?: number
  /** Each step's cost columns, so cost can be set against impact step by step. */
  stepCosts?: StepCostRow[]
  /** Initially active category (e.g. the one selected on the results page). */
  initialCategory?: string
}

/**
 * State, derivations and the AI narration request behind the Magic Insights
 * modal. The modal (and any redesign of it) only renders what this returns.
 */
export function useMagicInsights({
  open,
  caseName,
  method,
  impacts,
  componentBreakdown,
  materialBreakdown,
  totalCost,
  stepCosts,
  initialCategory,
}: MagicInsightsOptions) {
  // Available category options (real categories + an "overall" option).
  const categoryOptions = useMemo(() => buildCategoryOptions(impacts), [impacts])

  const [activeChip, setActiveChip] = useState<ChipId>('summary')
  const [reducePct, setReducePct] = useState<number>(20)
  const [reducePctInput, setReducePctInput] = useState<string>('20')
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryKey(initialCategory, impacts),
  )
  const [prompt, setPrompt] = useState<string>('')
  const [submittedPrompt, setSubmittedPrompt] = useState<string>('')

  // AI narration mode (open model via Hugging Face). Off by default: the
  // deterministic computed insight is the always-available baseline and the
  // automatic fallback whenever no model key is configured or a call fails.
  const [aiMode, setAiMode] = useState<boolean>(false)
  const [aiText, setAiText] = useState<string>('')
  // 'limited': the server's per-user hourly narration limit answered 429.
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
  const [aiModel, setAiModel] = useState<string>('')

  // The typed reduce target reaches reducePct (the insight text and the AI
  // request) only after typing pauses, so each keystroke does not re-request
  // a narration (INS-2). Presets set both at once.
  useEffect(() => {
    const next = clampReduceTarget(reducePctInput)
    if (next === null) return
    const t = setTimeout(() => setReducePct(next), REDUCE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [reducePctInput])

  // Reset state when the modal re-opens with new context.
  useEffect(() => {
    if (open) {
      setActiveChip('summary')
      setReducePct(20)
      setReducePctInput('20')
      setSelectedCategory(
        initialCategoryKey(initialCategory, impacts),
      )
      setPrompt('')
      setSubmittedPrompt('')
      setAiText('')
      setAiStatus('idle')
    }
  }, [open, initialCategory, impacts])

  // Resolve the active category, its unit, and the contributors under it.
  const { activeLabel, activeUnit, activeTotal, contributors, stepShares } = useMemo(
    () => resolveActiveCategory(selectedCategory, impacts, componentBreakdown),
    [selectedCategory, impacts, componentBreakdown],
  )

  // The same result grouped by material (one material can sit on several
  // steps). This is the lever to name: a step only books where a part is used.
  const materials = useMemo(
    () => materialShares(materialBreakdown, selectedCategory),
    [materialBreakdown, selectedCategory],
  )

  // What a sustainability consultant would look at first, triggered by this
  // run's own flows for the selected category (levers, not numbers).
  const consultant = useMemo(
    () => consultantForCategory(materialBreakdown, selectedCategory),
    [materialBreakdown, selectedCategory],
  )

  // Cost set against impact: the case's cost split by kind, and each step's
  // share of cost next to its share of the selected category.
  const costView = useMemo(() => buildCostView(stepCosts, stepShares), [stepCosts, stepShares])

  // Questions this case can actually answer, for the free-text box.
  const exampleQs = exampleQuestions(selectedCategory, activeLabel, materials)

  const insightText = useMemo(
    () =>
      buildInsightText({
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
      }),
    [
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
    ],
  )

  const { value: streamed, done } = useStreamText(insightText)

  // When AI mode is on, stream a grounded narration from the open model for the
  // current facts. Re-runs whenever the facts change (chip/category/target/
  // question). Any failure or missing key degrades silently to the computed
  // insight — the AI path is strictly additive.
  useEffect(() => {
    if (!open || !aiMode) return
    // 'custom' with no submitted question: nothing to narrate yet.
    if (activeChip === 'custom' && !submittedPrompt.trim()) {
      setAiText('')
      setAiStatus('idle')
      return
    }
    const controller = new AbortController()
    const facts = buildInsightFacts({
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
    })
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    setAiText('')
    setAiStatus('streaming')
    ;(async () => {
      try {
        const res = await fetch('/api/insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: JSON.stringify(facts),
          signal: controller.signal,
        })
        // 429 = this user's narrations for the hour are used up.
        if (res.status === 429) {
          setAiStatus('limited')
          return
        }
        const ct = res.headers.get('content-type') || ''
        // JSON response = fallback signal (no key / upstream error).
        if (ct.includes('application/json')) {
          setAiStatus('fallback')
          return
        }
        setAiModel(res.headers.get('x-insights-model') || '')
        const reader = res.body?.getReader()
        if (!reader) {
          setAiStatus('fallback')
          return
        }
        const decoder = new TextDecoder()
        let acc = ''
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done: rdone, value } = await reader.read()
          if (rdone) break
          acc += decoder.decode(value, { stream: true })
          setAiText(acc)
        }
        setAiStatus(acc.trim() ? 'done' : 'fallback')
      } catch (e: any) {
        if (e?.name !== 'AbortError') setAiStatus('fallback')
      }
    })()
    return () => controller.abort()
  }, [
    open,
    aiMode,
    activeChip,
    selectedCategory,
    reducePct,
    submittedPrompt,
    caseName,
    method,
    activeLabel,
    activeUnit,
    activeTotal,
    totalCost,
    contributors,
  ])

  // What actually renders: AI narration when in AI mode and it produced text,
  // otherwise the deterministic computed insight (also the fallback).
  const { usingAI, bodyText, showCursor } = narrationView({ aiMode, aiStatus, aiText, streamed, done })

  /** A reduce preset sets the applied target and the typed value at once. */
  const pickReducePreset = (preset: number) => {
    setReducePct(preset)
    setReducePctInput(String(preset))
  }

  /** Asks the typed question (the form's submit). */
  const submitPrompt = () => setSubmittedPrompt(prompt)

  // Changes whenever the question does, so the body remounts for each answer.
  const bodyKey = `${activeChip}-${selectedCategory}-${reducePct}-${submittedPrompt}`

  return {
    // Selection
    activeChip,
    setActiveChip,
    selectedCategory,
    setSelectedCategory,
    reducePct,
    reducePctInput,
    setReducePctInput,
    pickReducePreset,
    prompt,
    setPrompt,
    submittedPrompt,
    submitPrompt,
    // AI narration
    aiMode,
    setAiMode,
    aiStatus,
    aiModel,
    aiText,
    // Derived from the run
    chips: INSIGHT_CHIPS,
    categoryOptions,
    activeLabel,
    activeUnit,
    activeTotal,
    contributors,
    stepShares,
    materials,
    consultant,
    costView,
    exampleQs,
    insightText,
    // What the body shows
    usingAI,
    bodyText,
    showCursor,
    bodyKey,
  }
}

/** Everything useMagicInsights returns. */
export type MagicInsights = ReturnType<typeof useMagicInsights>
