'use client'

// State, effects and actions of /project/[projectId]/import — document
// ingestion with a review gate. Upload a document → the server returns an
// ingestion PLAN → the reviewer confirms or edits it → apply creates the case
// (or adds the lines to an existing one). The page and its sections only render
// what this hook returns.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { IngestPlan } from '@/lib/ingest/maplca'
import { getDocType } from '@/lib/ingest/doc-types'
import { authHeaders } from '@/lib/import/auth-headers'
import {
  buildApplyBody,
  buildApplyFlows,
  buildOutNotes,
  createdCaseName,
  unplacedError,
  withCreatedCase,
  type ProjectCase,
} from '@/lib/import/apply-body'
import { backHref } from '@/lib/import/display'
import { appliedMessage, nextConnector } from '@/lib/import/done-summary'
import {
  stepChoiceReason,
  stepOptions,
  suggestPlacements,
  targetComponentsFrom,
  type PlacementWhy,
  type TargetComponent,
} from '@/lib/import/placement-suggestions'
import { isLLMImport, previewFields, previewValidationError } from '@/lib/import/preview'
import { mergeProjectStatus, projectCasesFrom, type ProjectStatus } from '@/lib/import/project-status'
import { countUnplaced, initialEdits, parseNotes, type FlowEdit } from '@/lib/import/review'
import { useSampleDocs } from '@/lib/import/use-sample-docs'

/** Where the page is: picking a document, reading it, reviewing the plan, applying it, done. */
export type ImportPhase = 'pick' | 'previewing' | 'review' | 'applying' | 'done'

/** The part of the Next router the page uses. */
export interface ImportRouter {
  push: (href: string) => void
}

/** Everything the import page renders and does. */
export function useImport(projectId: string, router: ImportRouter) {
  const [file, setFile] = useState<File | null>(null)
  const [plantId, setPlantId] = useState('')
  const [connector, setConnector] = useState<string>('itac')
  // Guided intake (item 1): arriving from project creation (?first=1) selects the
  // routing connector, since the process routing builds the case skeleton. Read
  // the param in an effect, NOT a useState initializer — window is undefined
  // during SSR, so an initializer keeps the server's 'itac' after hydration
  // (the banner would show while the dropdown still said ITAC).
  const [firstDoc, setFirstDoc] = useState(false)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('first') === '1'
    ) {
      setFirstDoc(true)
      setConnector('routing')
    }
  }, [])

  const [phase, setPhase] = useState<ImportPhase>('pick')
  const [plan, setPlan] = useState<IngestPlan | null>(null)
  const [caseName, setCaseName] = useState('')
  const [edits, setEdits] = useState<Record<number, FlowEdit>>({})
  const [error, setError] = useState<string | null>(null)
  const samples = useSampleDocs({ plantId, setFile, setPlantId, setError })
  const [idHints, setIdHints] = useState<string[]>([])
  const [applied, setApplied] = useState<any>(null)

  // Guided assembly: append into an existing case instead of creating a new one.
  const [targetCaseId, setTargetCaseId] = useState<number | null>(null) // null = create new
  const [attachComponentId, setAttachComponentId] = useState<number | null>(null)
  const [projectCases, setProjectCases] = useState<ProjectCase[]>([])
  const [targetComponents, setTargetComponents] = useState<TargetComponent[]>([])
  const [completeness, setCompleteness] = useState<any>(null)
  // Routing: units per setup, so setup time is spread per unit (setup ÷ lot).
  const [lotSize, setLotSize] = useState('')
  // Appending: the step each line goes to (keyed by its document row), plus
  // why it was suggested. A BOM does not say which step uses a part.
  const [placement, setPlacement] = useState<Record<string, number | null>>({})
  const [placementWhy, setPlacementWhy] = useState<Record<string, PlacementWhy>>({})

  // Review interactivity (items 3, 4): dismiss individual notes / review lines,
  // and assign a role to an unmapped column so it is acknowledged not dropped.
  const [dismissedNotes, setDismissedNotes] = useState<Set<number>>(new Set())
  const [dismissedReview, setDismissedReview] = useState<Set<number>>(new Set())
  const [columnRoles, setColumnRoles] = useState<Record<string, string>>({})

  // Project-level intake status (item 10): which layers this project already has
  // across ALL its cases, and which are still missing anywhere — a running
  // checklist so the reviewer knows what document to bring next.
  // Bumped after each apply so the "added so far" bar re-reads the cases.
  const [statusTick, setStatusTick] = useState(0)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  useEffect(() => {
    if (projectCases.length === 0) {
      setProjectStatus(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const reports: any[] = []
      for (const c of projectCases) {
        try {
          const r = await fetch(`/api/cases/${c.case_id}/completeness`, { headers: authHeaders() })
          const d = await r.json().catch(() => ({}))
          const rep = d?.report
          if (!rep) continue
          reports.push(rep)
        } catch {
          /* ignore a case that fails to report */
        }
      }
      const status = mergeProjectStatus(reports)
      if (!cancelled) {
        setProjectStatus(status)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectCases, statusTick])

  const { unmappedColumns, plainNotes } = parseNotes(plan?.notes ?? [])

  // Load this project's cases so a document can be added to an existing one.
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}/cases`, { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        const cases = projectCasesFrom(d)
        if (cases) {
          setProjectCases(cases)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [projectId])

  // When appending, load the target case's nodes so the user can pick the attach point.
  useEffect(() => {
    if (!targetCaseId) {
      setTargetComponents([])
      setAttachComponentId(null)
      return
    }
    ;(async () => {
      try {
        const r = await fetch(`/api/cases/${targetCaseId}/components`, { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        const comps = targetComponentsFrom(d)
        setTargetComponents(comps)
        // No silent default: each line gets its own suggested step at review.
        setAttachComponentId(null)
      } catch {
        /* ignore */
      }
    })()
  }, [targetCaseId])

  const placeSteps = stepOptions(targetComponents)

  // Suggest a step for every line when appending (document op column > name
  // match > assembly for purchased parts > unplaced). The reviewer confirms.
  useEffect(() => {
    if (!plan || targetCaseId === null || !targetComponents.length) return
    const { placement: next, why } = suggestPlacements(plan, targetComponents)
    setPlacement(next)
    setPlacementWhy(why)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, targetCaseId, targetComponents])

  // Lines (applied flows + costs) with no step yet, when appending.
  const unplacedCount = countUnplaced({
    plan,
    appending: targetCaseId !== null,
    edits,
    placement,
    attachComponentId,
  })

  const doc = getDocType(connector)
  const isLLM = isLLMImport(doc, connector, file)

  const preview = async () => {
    const invalid = previewValidationError({ hasFile: !!file, connector, plantId, targetCaseId })
    if (invalid !== null || !file) {
      setError(invalid)
      return
    }
    setPhase('previewing')
    setError(null)
    setIdHints([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      for (const [name, value] of previewFields({ connector, plantId, lotSize, targetCaseId })) {
        fd.append(name, value)
      }
      const r = await fetch('/api/ingest/preview', {
        method: 'POST',
        headers: authHeaders(false), // browser sets the multipart boundary
        body: fd,
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d?.error || 'Preview failed')
        if (Array.isArray(d?.matching_ids)) setIdHints(d.matching_ids)
        setPhase('pick')
        return
      }
      const p: IngestPlan = d.plan
      setPlan(p)
      setCaseName(p.case_name)
      setEdits(initialEdits(p.flows))
      setDismissedNotes(new Set())
      setDismissedReview(new Set())
      setColumnRoles({})
      setPhase('review')
    } catch (e: any) {
      setError(e?.message || 'Preview failed')
      setPhase('pick')
    }
  }

  const apply = async () => {
    if (!plan) return
    const appending = targetCaseId !== null
    if (appending && unplacedCount > 0) {
      setError(unplacedError(unplacedCount))
      return
    }
    setPhase('applying')
    setError(null)
    try {
      const flows = buildApplyFlows({ plan, edits, appending, placement, attachComponentId })
      const outNotes = buildOutNotes(plan.notes, dismissedNotes, columnRoles)
      const body = buildApplyBody({
        plan,
        projectId,
        caseName,
        targetCaseId,
        attachComponentId,
        placement,
        flows,
        notes: outNotes,
      })
      const r = await fetch('/api/ingest/apply', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d?.error || 'Apply failed')
        setPhase('review')
        return
      }
      // Lines the reviewer left unticked (no match, or not confirmed) were not
      // sent, so the server cannot count them: say how many stayed out.
      setApplied({ ...d, left_out: plan.flows.length - flows.length })
      setStatusTick((t) => t + 1)
      // Make the just-created case selectable in the "Add to" picker so a
      // follow-up document can be appended to it without reloading the page.
      if (!appending && d.case_id) {
        setProjectCases((prev) =>
          withCreatedCase(prev, d.case_id, createdCaseName(caseName, plan.case_name, d.case_id)),
        )
      }
      setPhase('done')
      toast.success(appliedMessage(appending, d.case_name))

      // Keep the document with the case. The importer reads it once and would
      // otherwise drop it, which leaves a person unable to look back at the
      // routing or BOM the numbers came from (Reference pane in the editor).
      if (d.case_id && file) {
        try {
          const docForm = new FormData()
          docForm.append('file', file)
          docForm.append('doc_type', connector)
          await fetch(`/api/cases/${d.case_id}/documents`, {
            method: 'POST',
            headers: authHeaders(false), // let the browser set the multipart boundary
            body: docForm,
          })
        } catch {
          // A case without its document is still a usable case; do not fail
          // the import over the copy kept for reading.
        }
      }
      // Pull the case completeness so the checklist shows what is still missing.
      try {
        const cr = await fetch(`/api/cases/${d.case_id}/completeness`, { headers: authHeaders() })
        const cd = await cr.json().catch(() => ({}))
        if (cd?.report) setCompleteness(cd.report)
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setError(e?.message || 'Apply failed')
      setPhase('review')
    }
  }

  // The reviewer picks (or clears) the step for one line when appending.
  const chooseStep = (key: string, v: number | null) => {
    setPlacement((p) => ({ ...p, [key]: v }))
    setPlacementWhy((w) => ({
      ...w,
      [key]: { confidence: 1, reason: stepChoiceReason(v, attachComponentId) },
    }))
  }
  const setFlowEdit = (i: number, edit: FlowEdit) => setEdits({ ...edits, [i]: edit })
  const dismissReview = (i: number) => setDismissedReview((s) => new Set(s).add(i))
  const dismissNote = (noteIndex: number) => setDismissedNotes((s) => new Set(s).add(noteIndex))
  const setColumnRole = (column: string, role: string) =>
    setColumnRoles((r) => ({ ...r, [column]: role }))

  const startOver = () => {
    setPlan(null)
    setPhase('pick')
  }
  const addAnotherDocument = () => {
    // Continue assembling THIS case with the next document:
    // the one that fills the first layer still missing.
    const next = nextConnector(completeness?.missing ?? [])
    if (next) setConnector(next)
    setFirstDoc(false)
    setTargetCaseId(applied.case_id)
    setPlan(null)
    setApplied(null)
    setEdits({})
    setFile(null)
    setPlantId('')
    setPhase('pick')
  }
  const startNewCase = () => {
    setPlan(null)
    setApplied(null)
    setEdits({})
    setFile(null)
    setPlantId('')
    setTargetCaseId(null)
    setCompleteness(null)
    setPhase('pick')
  }
  const goBack = () => router.push(backHref(projectId, targetCaseId))
  const openCase = () => router.push(`/project/${projectId}/case/${applied.case_id}`)

  return {
    // Pick: the document, where it goes, and the pick-step status card.
    file, setFile, plantId, setPlantId, connector, setConnector, firstDoc, doc, isLLM,
    lotSize, setLotSize, projectCases, targetCaseId, setTargetCaseId,
    attachComponentId, setAttachComponentId, placeSteps, projectStatus,
    // Samples: sampleView, loadSample, viewSample, downloadSample, downloadTemplate, copySample, closeSample.
    ...samples,
    // Phase and plan.
    phase, plan, error, idHints, preview,
    // Review.
    caseName, setCaseName, edits, setFlowEdit, placement, placementWhy, chooseStep, unplacedCount,
    unmappedColumns, plainNotes, dismissedNotes, dismissNote, dismissedReview, dismissReview,
    columnRoles, setColumnRole, apply, startOver,
    // Done, and navigation.
    applied, completeness, addAnotherDocument, startNewCase, openCase, goBack,
  }
}

/** What useImport returns. */
export type ImportController = ReturnType<typeof useImport>
