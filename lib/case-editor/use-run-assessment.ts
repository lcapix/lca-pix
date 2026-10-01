'use client'

// Run Assessment from the case editor. One click actually RUNS the
// calculation (POST), then navigates to results. Previously this only
// navigated to the results page, forcing the user to click "Run new" there —
// so "Run Assessment" never actually computed.

import { useState } from 'react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import type { GoalScopeSummary } from '@/components/lcapix/case/goal-scope-card'
import {
  assessmentCompleteMessage,
  buildRunBody,
  isInventoryReady,
  readRunPrefs,
  runBlockedMessage,
} from './run-assessment'
import type { CompletenessReport } from './types'

type Router = { push: (href: string) => void }

/**
 * Whether the case may run. ISO 14044 goal & scope (4.2.3.2): a run needs a
 * functional unit, because a result that is not "per" anything cannot be
 * interpreted or compared. The Goal & scope card reports what is saved; until
 * it loads nothing is blocked. `goalOpenSignal` opens that card.
 */
export function useRunGate(completeness: CompletenessReport | null) {
  const [goalScope, setGoalScope] = useState<GoalScopeSummary | null>(null)
  const [goalOpenSignal, setGoalOpenSignal] = useState(0)
  const inventoryReady = isInventoryReady(completeness)
  const fuMissing = !!goalScope && !goalScope.functionalUnit.trim()
  const canRun = inventoryReady && !fuMissing
  const openGoalScope = () => setGoalOpenSignal((s) => s + 1)
  return { goalScope, setGoalScope, goalOpenSignal, openGoalScope, inventoryReady, fuMissing, canRun }
}

export function useRunAssessment({
  projectId,
  caseId,
  router,
  canRun,
  fuMissing,
  openGoalScope,
}: {
  projectId: string
  caseId: string
  router: Router
  canRun: boolean
  fuMissing: boolean
  openGoalScope: () => void
}) {
  const [isRunning, setIsRunning] = useState(false)
  const handleRunAssessment = async () => {
    if (isRunning) return
    if (!canRun) {
      toast.error(runBlockedMessage(fuMissing))
      if (fuMissing) openGoalScope()
      return
    }
    setIsRunning(true)
    try {
      // Honor the same per-case method/region memory the run modal writes —
      // a quick-run that silently switched a US case back to Global made the
      // latest run non-comparable with its own history (live-caught: run 119).
      // Nothing remembered: the server uses the study's scope (the project's
      // method, the case's region).
      const remembered = readRunPrefs(caseId)
      const res = await apiRequest(`/api/cases/${caseId}/assessments`, {
        method: 'POST',
        body: JSON.stringify(buildRunBody(remembered)),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText)
        throw new Error(msg || `Assessment failed (${res.status})`)
      }
      const data = await res.json().catch(() => ({}))
      toast.success(assessmentCompleteMessage(data))
      router.push(`/project/${projectId}/case/${caseId}/results`)
    } catch (e: any) {
      console.error('Run assessment failed:', e)
      toast.error(e?.message || 'Assessment failed')
    } finally {
      setIsRunning(false)
    }
  }
  return { isRunning, handleRunAssessment }
}
