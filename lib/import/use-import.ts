'use client'

// State, effects and actions of /project/[projectId]/import — document
// ingestion with a review gate. Upload a document → the server returns an
// ingestion PLAN → the reviewer confirms or edits it → apply creates the case
// (or adds the lines to an existing one). The page and its sections only render
// what this hook returns.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useShellStore } from '@/lib/shell/use-shell'

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
  withStepDecisions,
  type PlacementWhy,
  type TargetComponent,
} from '@/lib/import/placement-suggestions'
import { isLLMImport, previewFields, previewValidationError } from '@/lib/import/preview'
import { mergeProjectStatus, projectCasesFrom, type ProjectStatus } from '@/lib/import/project-status'
import {
  applyNodeEdits,
  buildNodeActions,
  nodeTreeError,
  parseStepActionValue,
  suggestStepActions,
  type NodeEdit,
  type StepAction,
} from '@/lib/import/node-edits'
import { countUnplaced, initialEdits, parseNotes, type FlowEdit } from '@/lib/import/review'
import { costConflicts } from '@/lib/import/cost-conflicts'
import { flowConflicts, type ExistingFlow } from '@/lib/import/flow-conflicts'
import type { CostMode } from '@/lib/ingest/cost-columns'
import { useSampleDocs } from '@/lib/import/use-sample-docs'
import { uploadTooLargeMessage } from '@/lib/upload-limits'
import { readFailureKind, type ReadFailure } from '@/lib/import/file-rules'
import { withoutSteps } from '@/lib/import/steps-hours'

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
  // F2.2 starts on Routing: the file that gives the steps and their hours.
  const [connector, setConnector] = useState<string>('routing')
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
  // Edits to the step tree itself, keyed by each step's ORIGINAL name (how
  // flows and costs refer to it), so a rename reaches every reference.
  const [nodeEdits, setNodeEdits] = useState<Record<string, NodeEdit>>({})
  const [error, setError] = useState<string | null>(null)
  // F2.2b: which way a failed read went (scanned, the hourly limit, …) and the
  // wait the limit gives, so the screen offers the right ways forward.
  const [readFailure, setReadFailure] = useState<{ kind: ReadFailure; retryAfter: number | null; fileName: string | null } | null>(null)
  // F2.2: "Uses 1 of your 10 reads this hour".
  const [readsLeft, setReadsLeft] = useState<{ limit: number; remaining: number } | null>(null)
  // Asked of the server on open and after every read, kept or failed: a failed
  // read uses one too, so the page never guesses.
  const [readsTick, setReadsTick] = useState(0)
  // F2.3: steps the reviewer unticked (by the plan's own names), for a new case.
  const [droppedSteps, setDroppedSteps] = useState<Set<string>>(new Set())
  const toggleDropStep = (name: string) =>
    setDroppedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  useEffect(() => {
    let live = true
    fetch('/api/ingest/reads-left', { headers: authHeaders(false) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d && Number.isFinite(Number(d.limit)) && setReadsLeft({ limit: Number(d.limit), remaining: Number(d.remaining) }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [readsTick])
  const samples = useSampleDocs({ plantId, setFile, setPlantId, setError })
  const [idHints, setIdHints] = useState<string[]>([])
  const [applied, setApplied] = useState<any>(null)

  // Guided assembly: append into an existing case instead of creating a new one.
  // null = create new. ?case=<id> (the empty tree's "Or add a file instead")
  // starts on that case; the server still checks the caller may change it.
  const [targetCaseId, setTargetCaseId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const v = new URLSearchParams(window.location.search).get('case')
    return v && /^\d{1,12}$/.test(v) ? Number(v) : null
  })
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
  // Lines whose step the reviewer picked by hand: those beat the document's
  // own step decisions below.
  const [chosenKeys, setChosenKeys] = useState<Set<string>>(new Set())
  // Keep / replace / add for a step that already has a cost the document
  // writes, keyed "<component_id>|<column>"; keep unless the reviewer says.
  const [costModes, setCostModes] = useState<Record<string, CostMode>>({})
  // The same for a step that already has a flow of the document's substance,
  // keyed "<component_id>|<substance_id>|<direction>".
  const [flowModes, setFlowModes] = useState<Record<string, CostMode>>({})
  // The flows already on the target case's steps (only steps that have any),
  // and whether they could be read: without them a duplicate cannot be seen.
  const [existingFlows, setExistingFlows] = useState<Record<number, ExistingFlow[]>>({})
  const [existingFlowsError, setExistingFlowsError] = useState<string | null>(null)
  // Whether the target case's steps (and the flows on them) have been read.
  // Until they have, every step of the document looks new and every flow
  // looks unique, so applying would duplicate the case: apply waits.
  const [targetLoad, setTargetLoad] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  // The step list the existing flows were last read for (or failed for): the
  // flows are current only when it is the step list on screen.
  const [flowsReadFor, setFlowsReadFor] = useState<TargetComponent[] | null>(null)
  // Appending a document that describes STEPS (a routing) onto a live case:
  // each of its steps is matched against the case's own, and the reviewer
  // decides: attach, create, or skip. Creating blindly is how a case ends up
  // with two "70. Final assembly" and double the hours.
  const [stepActions, setStepActions] = useState<Record<string, StepAction>>({})

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
      setTargetLoad('idle')
      return
    }
    let cancelled = false
    setTargetLoad('loading')
    ;(async () => {
      try {
        const r = await fetch(`/api/cases/${targetCaseId}/components`, { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error || `status ${r.status}`)
        const comps = targetComponentsFrom(d)
        if (cancelled) return
        setTargetComponents(comps)
        // No silent default: each line gets its own suggested step at review.
        setAttachComponentId(null)
        setTargetLoad('ready')
      } catch (e: any) {
        // Not ignored: without the case's steps every step of the document
        // would be created again.
        if (cancelled) return
        setTargetComponents([])
        setTargetLoad('error')
        setError(`The steps of this case could not be read (${e?.message || 'network error'}), so nothing can be added to it yet. Try again.`)
      }
    })()
    return () => {
      cancelled = true
    }
    // statusTick: after an apply the steps' costs and flows have changed, and
    // the next document may go to the same case.
  }, [targetCaseId, statusTick])

  // The flows already on the target case's steps, so a re-imported document
  // shows what it would add to. A step with no flows is not asked.
  useEffect(() => {
    const withFlows = targetComponents.filter((c) => (c.flow_count ?? 0) > 0)
    if (targetCaseId === null || withFlows.length === 0) {
      setExistingFlows({})
      setExistingFlowsError(null)
      setFlowsReadFor(targetComponents)
      return
    }
    let cancelled = false
    ;(async () => {
      const out: Record<number, ExistingFlow[]> = {}
      try {
        for (const c of withFlows) {
          const r = await fetch(`/api/components/${c.component_id}/flows`, { headers: authHeaders() })
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d?.error || `could not read the flows of ${c.name}`)
          out[c.component_id] = d.flows ?? []
        }
        if (!cancelled) {
          setExistingFlows(out)
          setExistingFlowsError(null)
          setFlowsReadFor(targetComponents)
        }
      } catch (e: any) {
        if (!cancelled) {
          setFlowsReadFor(targetComponents)
          setExistingFlows({})
          setExistingFlowsError(
            `The flows already in this case could not be read (${e?.message || 'network error'}), so a flow this document repeats cannot be flagged.`,
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [targetCaseId, targetComponents])

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

  // Suggested step decisions, recomputed when the plan or the target case
  // changes. Only a routing creates unmatched steps by default; a BOM's
  // placeholder step is skipped so it never lands in the case unseen.
  useEffect(() => {
    if (!plan || targetCaseId === null || plan.nodes.length === 0) {
      setStepActions({})
      return
    }
    setStepActions(suggestStepActions(plan.nodes, targetComponents, connector === 'routing'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, targetCaseId, targetComponents])

  // Where each line actually goes: a line on a step the document attaches or
  // creates follows that step, unless the reviewer picked one for it.
  const lineSteps =
    plan && targetCaseId !== null
      ? withStepDecisions(
          plan,
          { placement, why: placementWhy },
          stepActions,
          chosenKeys,
          (name) => (nodeEdits[name]?.name ?? name).trim() || name,
        )
      : { placement, why: placementWhy, newStep: {} as Record<string, string> }

  // Steps the document would write a cost over, and what the reviewer decided.
  const costClashes =
    plan && targetCaseId !== null
      ? costConflicts({
          plan,
          placement: lineSteps.placement,
          newStep: lineSteps.newStep,
          attachComponentId,
          components: targetComponents,
          finalName: (name) => (nodeEdits[name]?.name ?? name).trim() || name,
        })
      : []
  const costModeOf = (key: string): CostMode => costModes[key] ?? 'keep'
  const flowClashes =
    plan && targetCaseId !== null
      ? flowConflicts({
          plan,
          edits,
          placement: lineSteps.placement,
          newStep: lineSteps.newStep,
          attachComponentId,
          components: targetComponents,
          existingFlows,
          finalName: (name) => (nodeEdits[name]?.name ?? name).trim() || name,
        })
      : []
  const flowModeOf = (key: string): CostMode => flowModes[key] ?? 'keep'

  // Appending waits for the case's steps and the flows on them (a failed flow
  // read is shown on the review and does not block; a failed step read does).
  const appendWaiting =
    targetCaseId !== null && (targetLoad !== 'ready' || flowsReadFor !== targetComponents)

  // Lines (applied flows + costs) with no step yet, when appending.
  const unplacedCount = countUnplaced({
    plan,
    appending: targetCaseId !== null,
    edits,
    placement: lineSteps.placement,
    attachComponentId,
    newStep: lineSteps.newStep,
  })

  const doc = getDocType(connector)
  const isLLM = isLLMImport(doc, connector, file)

  const preview = async () => {
    const invalid = previewValidationError({ hasFile: !!file, connector, plantId, targetCaseId })
    if (invalid !== null || !file) {
      setError(invalid)
      return
    }
    // Check the size here: over the hosting limit the platform refuses the
    // upload before our route can explain why.
    const tooLarge = uploadTooLargeMessage(file)
    if (tooLarge) {
      setError(tooLarge)
      return
    }
    setPhase('previewing')
    setError(null)
    setReadFailure(null)
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
        setReadFailure({
          kind: readFailureKind(r.status, d?.error),
          retryAfter: Number.isFinite(Number(d?.retry_after)) ? Number(d.retry_after) : null,
          fileName: file.name,
        })
        setReadsTick((t) => t + 1)
        setError(
          d?.error ||
            (r.status === 413
              ? 'This file is too large to send here. Save a smaller copy and try again.'
              : `The file could not be read (the server answered ${r.status}). Try again.`),
        )
        if (Array.isArray(d?.matching_ids)) setIdHints(d.matching_ids)
        setPhase('pick')
        return
      }
      setReadsTick((t) => t + 1)
      const p: IngestPlan = d.plan
      setPlan(p)
      setCaseName(p.case_name)
      setEdits(initialEdits(p.flows))
      setNodeEdits({})
      setChosenKeys(new Set())
      setCostModes({})
      setFlowModes({})
      setDismissedNotes(new Set())
      setDismissedReview(new Set())
      setColumnRoles({})
      setDroppedSteps(new Set())
      setPhase('review')
    } catch (e: any) {
      setError(e?.message || 'Preview failed')
      setPhase('pick')
    }
  }

  const apply = async () => {
    if (!plan) return
    const appending = targetCaseId !== null
    if (appending && appendWaiting) {
      setError(
        targetLoad === 'error'
          ? 'The steps of this case could not be read, so nothing can be added to it yet. Try again.'
          : 'Still reading the steps of this case. Apply again in a moment.',
      )
      return
    }
    if (appending && unplacedCount > 0) {
      setError(unplacedError(unplacedCount))
      return
    }
    // The reviewer's edits to the step tree; a rename has to reach the step's
    // children, flows and costs, or apply would attach them to a name that no
    // longer exists.
    const { nodes: editedNodes, finalName } = applyNodeEdits(plan.nodes, nodeEdits)
    const treeError = nodeTreeError(editedNodes)
    if (treeError) {
      setError(treeError)
      return
    }
    setPhase('applying')
    setError(null)
    try {
      const flows = buildApplyFlows({ plan, edits, appending, placement: lineSteps.placement, attachComponentId, finalName })
      const outNotes = buildOutNotes(plan.notes, dismissedNotes, columnRoles)
      const built = buildApplyBody({
        plan,
        projectId,
        caseName,
        targetCaseId,
        attachComponentId,
        placement: lineSteps.placement,
        flows,
        notes: outNotes,
        steps: {
          nodes: editedNodes,
          finalName,
          nodeActions: buildNodeActions(editedNodes, plan.nodes, stepActions),
        },
        costModes: appending ? Object.fromEntries(costClashes.map((c) => [c.key, costModeOf(c.key)])) : undefined,
        flowModes: appending ? Object.fromEntries(flowClashes.map((c) => [c.key, flowModeOf(c.key)])) : undefined,
      })
      // A new case leaves out the steps the reviewer unticked, with what hangs off them.
      const body = appending
        ? built
        : withoutSteps(built as any, new Set([...droppedSteps].map((n) => finalName(n) ?? n)))
      const sentFlows: unknown[] = (body as any).flows ?? flows
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
      setApplied({ ...d, left_out: plan.flows.length - sentFlows.length })
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
      // A new case changes the project's counts in the sidebar.
      if (!appending) void useShellStore.getState().refresh()

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
    // The empty option means "no pick of my own": the line follows its
    // document step again (or the default), so it is not marked as chosen.
    setChosenKeys((s) => {
      const next = new Set(s)
      if (v === null) next.delete(key)
      else next.add(key)
      return next
    })
    setPlacement((p) => ({ ...p, [key]: v }))
    setPlacementWhy((w) => ({
      ...w,
      [key]: { confidence: 1, reason: stepChoiceReason(v, attachComponentId) },
    }))
  }
  const setFlowEdit = (i: number, edit: FlowEdit) => setEdits({ ...edits, [i]: edit })
  const setCostMode = (key: string, mode: CostMode) => setCostModes((m) => ({ ...m, [key]: mode }))
  const setFlowMode = (key: string, mode: CostMode) => setFlowModes((m) => ({ ...m, [key]: mode }))
  const setNodeEdit = (originalName: string, patch: NodeEdit) =>
    setNodeEdits((all) => ({ ...all, [originalName]: { ...all[originalName], ...patch } }))
  const chooseStepAction = (originalName: string, value: string) =>
    setStepActions((all) => ({ ...all, [originalName]: parseStepActionValue(value) }))
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
    setNodeEdits({})
    setFile(null)
    setPlantId('')
    setPhase('pick')
  }
  const startNewCase = () => {
    setPlan(null)
    setApplied(null)
    setEdits({})
    setNodeEdits({})
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
    phase, plan, error, idHints, preview, readFailure, readsLeft, droppedSteps, toggleDropStep,
    // Review.
    caseName, setCaseName, edits, setFlowEdit, chooseStep, unplacedCount, appendWaiting,
    placement: lineSteps.placement, placementWhy: lineSteps.why, newStep: lineSteps.newStep,
    nodeEdits, setNodeEdit, stepActions, chooseStepAction, targetComponents,
    costClashes, costModeOf, setCostMode, flowClashes, flowModeOf, setFlowMode, existingFlowsError,
    unmappedColumns, plainNotes, dismissedNotes, dismissNote, dismissedReview, dismissReview,
    columnRoles, setColumnRole, apply, startOver,
    // Done, and navigation.
    applied, completeness, addAnotherDocument, startNewCase, openCase, goBack,
  }
}

/** What useImport returns. */
export type ImportController = ReturnType<typeof useImport>
