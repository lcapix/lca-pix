'use client'

import { useMagicInsights } from '@/lib/insights/use-magic-insights'
import type {
  ComponentBreakdownEntry,
  ImpactValue,
  MaterialFlowRow,
  StepCostRow,
} from '@/lib/insights/magic-insights'
import { MagicInsightsShell } from '@/components/lcapix/magic-insights/modal-shell'
import { MagicInsightsHeader } from '@/components/lcapix/magic-insights/header'
import { InsightActionChips } from '@/components/lcapix/magic-insights/action-chips'
import { ReduceTargetRow } from '@/components/lcapix/magic-insights/reduce-target'
import { CustomPromptForm } from '@/components/lcapix/magic-insights/prompt-form'
import { InsightBody } from '@/components/lcapix/magic-insights/insight-body'
import { ConsultantList } from '@/components/lcapix/magic-insights/consultant-list'
import { ContributorsList } from '@/components/lcapix/magic-insights/contributors-list'
import { MagicInsightsFooter } from '@/components/lcapix/magic-insights/footer'

interface MagicInsightsModalProps {
  open: boolean
  onClose: () => void
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
  projectId: string
  caseId: string
}

export function MagicInsightsModal({
  open,
  onClose,
  caseName,
  method,
  impacts,
  componentBreakdown,
  materialBreakdown,
  totalCost,
  stepCosts,
  initialCategory,
  projectId,
  caseId,
}: MagicInsightsModalProps) {
  const ins = useMagicInsights({
    open,
    caseName,
    method,
    impacts,
    componentBreakdown,
    materialBreakdown,
    totalCost,
    stepCosts,
    initialCategory,
  })

  if (!open) return null

  return (
    <MagicInsightsShell onClose={onClose}>
      {/* Header */}
      <MagicInsightsHeader
        caseName={caseName}
        method={method}
        aiMode={ins.aiMode}
        onAiModeChange={ins.setAiMode}
        onClose={onClose}
        categoryOptions={ins.categoryOptions}
        selectedCategory={ins.selectedCategory}
        onCategoryChange={ins.setSelectedCategory}
      />

      {/* Action chips */}
      <InsightActionChips
        chips={ins.chips}
        activeChip={ins.activeChip}
        reducePct={ins.reducePct}
        onSelect={ins.setActiveChip}
      />

      {/* Reduce % input — only visible when the reduce chip is active. */}
      {ins.activeChip === 'reduce' && (
        <ReduceTargetRow
          reducePctInput={ins.reducePctInput}
          onInputChange={ins.setReducePctInput}
          reducePct={ins.reducePct}
          onPreset={ins.pickReducePreset}
        />
      )}

      {/* Free-text prompt — only when the custom chip is active. */}
      {ins.activeChip === 'custom' && (
        <CustomPromptForm
          prompt={ins.prompt}
          onPromptChange={ins.setPrompt}
          onSubmit={ins.submitPrompt}
          exampleQs={ins.exampleQs}
        />
      )}

      {/* Streamed body with cited data chips */}
      <InsightBody
        bodyKey={ins.bodyKey}
        bodyText={ins.bodyText}
        showCursor={ins.showCursor}
        contributors={ins.contributors}
        projectId={projectId}
        caseId={caseId}
        usingAI={ins.usingAI}
        aiMode={ins.aiMode}
        aiStatus={ins.aiStatus}
        aiModel={ins.aiModel}
      />

      {/* What a consultant would look at: levers triggered by this case */}
      {ins.consultant.length > 0 && <ConsultantList items={ins.consultant} />}

      {/* Top contributor mini-list (per active category) */}
      {ins.contributors.length > 0 && (
        <ContributorsList activeLabel={ins.activeLabel} contributors={ins.contributors} />
      )}

      {/* Footer actions */}
      <MagicInsightsFooter projectId={projectId} caseId={caseId} onClose={onClose} />
    </MagicInsightsShell>
  )
}
