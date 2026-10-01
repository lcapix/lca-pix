'use client'

// Case Editor — LCAPIX 3-pane IDE layout.
// Phase LF.3: UI layer ported from LCAPIX/pages-app.jsx (CaseEditorPage).
// Business logic (fetch / save / delete / create / run-assessment) is
// preserved from the prior implementation.

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import {
  transformCaseFromDB,
  transformComponentFromDB,
} from '@/lib/data-transformers'
import { useProjectStore, type ComponentNode, type Case } from '@/lib/store'
import { componentsToTree, flattenTree, rollupTree } from '@/lib/case-tree-adapter'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import type { CompletenessReport, EditFormData } from '@/lib/case-editor/types'
import {
  COMPONENT_TYPES,
  buildComponentUpdatePayload,
  costOrNull,
  formDataFromComponent,
  pendingRescale,
  scaleSuccessMessage,
  validateComponentSave,
} from '@/lib/case-editor/component-payload'
import {
  filterFlatByLabel,
  lessonStepNames,
  newComponentQuery,
  parentOptionsFor,
  pickInitialComponent,
  toComponentLikes,
} from '@/lib/case-editor/case-tree'
import { chooseDeleteMode, deleteSuccessMessage, planDelete } from '@/lib/case-editor/delete-plan'
import {
  assessmentCompleteMessage,
  buildRunBody,
  completedRuns,
  hasRunSibling,
  isInventoryReady,
  readRunPrefs,
  runBlockedMessage,
  runButtonTitle,
  topClimateStep,
} from '@/lib/case-editor/run-assessment'
import { deriveCaseStatus } from '@/lib/case-editor/case-status'

import { Breadcrumb, Icon } from '@/components/lcapix'
import {
  TreeCanvas,
  NodeDetailsStrip,
  InspectorPanel,
  type CanvasView,
  type InspectorEditFormData,
} from '@/components/lcapix/case'
import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import {
  GoalScopeCard,
  type GoalScopeSummary,
} from '@/components/lcapix/case/goal-scope-card'
import { PhaseStepper } from '@/components/lcapix/case/phase-stepper'
import { ScaleDialog, type PendingScale } from '@/components/lcapix/case/scale-dialog'
import { CaseNameDialog } from '@/components/lcapix/case/case-name-dialog'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { ReferencePane } from '@/components/lcapix/case/reference-pane'
import { LessonRail } from '@/components/lcapix/case/lesson-rail'

export default function CaseViewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const caseId = params.caseId as string
  // Deep-link target: the results page links each flow row to
  // ?component=<name> so "click a flow → edit its component" works.
  const preselectComponent = searchParams.get('component')
  // ?componentId=<id>: the same, by id (the old /component/:id/edit URL lands here).
  const preselectComponentId = searchParams.get('componentId')

  const { updateComponentNode, deleteComponentNode } = useProjectStore()

  // ---------- Fetch state (preserved) ----------
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [components, setComponents] = useState<ComponentNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Bumped when the component-create/edit modal reports a change, forcing the
  // fetch effect below to re-run so new nodes appear without a full reload.
  const [refreshKey, setRefreshKey] = useState(0)
  // Duplicate asks for the copy's name before creating it.
  const [dupOpen, setDupOpen] = useState(false)
  const [dupBusy, setDupBusy] = useState(false)
  const [dupError, setDupError] = useState<string | null>(null)
  // ?duplicate=1 (the results page's "Duplicate and change one thing") opens
  // the Duplicate dialog once the case has loaded, then drops the param so a
  // reload or Back does not open it again (RES-6).
  const wantsDuplicate = searchParams.get('duplicate') === '1'
  const duplicateFromUrlHandled = useRef(false)
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1)
    window.addEventListener('lcapix:components-changed', handler)
    return () => window.removeEventListener('lcapix:components-changed', handler)
  }, [])
  useEffect(() => {
    if (!wantsDuplicate || !currentCase || duplicateFromUrlHandled.current) return
    duplicateFromUrlHandled.current = true
    setDupOpen(true)
    const rest = new URLSearchParams(searchParams.toString())
    rest.delete('duplicate')
    const qs = rest.toString()
    router.replace(`/project/${projectId}/case/${caseId}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [wantsDuplicate, currentCase, searchParams, router, projectId, caseId])
  // Fetched once for the breadcrumb so it reads "<project name>" instead of "Project".
  const [projectName, setProjectName] = useState<string>('')
  // The document a person types their quantities from, kept open beside the
  // editor. Remembered per case so it survives a reload mid-build.
  const [referenceOpen, setReferenceOpen] = useState(false)

  // Guided lessons. Opened by ?learn=1 (the build-by-hand path) or the Learn
  // button; progress lives on the case, so an instructor sees it next to the
  // model the student built.
  const [learnOpen, setLearnOpen] = useState(false)
  const [learningState, setLearningState] = useState<unknown>(null)
  const [hasWriteUp, setHasWriteUp] = useState(false)
  const [topStep, setTopStep] = useState<string | null>(null)
  const [hasComparableCase, setHasComparableCase] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('learn') === '1') {
      setLearnOpen(true)
      setReferenceOpen(true)
    }
  }, [])

  // A sibling case that has been run is what makes lesson 5 (compare) possible.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}/cases`)
        const d = await r.json().catch(() => ({}))
        const comparable = hasRunSibling(d?.cases, caseId)
        if (!cancelled) setHasComparableCase(comparable)
      } catch {
        /* advisory only */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, caseId, refreshKey])
  const [studyMethod, setStudyMethod] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}`)
        const d = await r.json()
        if (!cancelled && d?.success) {
          setProjectName(d.project?.project_name ?? '')
          setStudyMethod(d.project?.lcia_method ?? undefined)
        }
      } catch {
        // breadcrumb falls back to 'Project'
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // ---------- Case completeness (which layers present / missing) ----------
  // Drives the "what to add next" strip and gates Run Assessment. Re-fetched on
  // refreshKey so it tracks live edits (add a flow → strip and gate update).
  const [completeness, setCompleteness] = useState<CompletenessReport | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/cases/${caseId}/completeness`)
        const d = await r.json()
        if (!cancelled && d?.success) setCompleteness(d.report ?? null)
      } catch {
        // completeness is advisory; a failure just hides the strip
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, refreshKey])

  // A case can be assessed only if it has at least one impact-bearing flow
  // layer (materials / energy / emissions / transport). Skeleton + costs alone
  // characterize to nothing, so a run would return a misleading 0. This is the
  // honest gate; tightening it to require specific layers (e.g. block until
  // energy is present too) is a product decision — change IMPACT_LAYERS.
  const inventoryReady = isInventoryReady(completeness)

  // ISO 14044 goal & scope (4.2.3.2): a run needs a functional unit, because a
  // result that is not "per" anything cannot be interpreted or compared. The
  // Goal & scope card reports what is saved; until it loads nothing is blocked.
  const [goalScope, setGoalScope] = useState<GoalScopeSummary | null>(null)
  const [goalOpenSignal, setGoalOpenSignal] = useState(0)
  const fuMissing = !!goalScope && !goalScope.functionalUnit.trim()
  const canRun = inventoryReady && !fuMissing

  // Has this case been assessed yet? Moves the journey phase in the status panel
  // from Inventory to Interpretation. Re-checked on refreshKey.
  const [hasAssessment, setHasAssessment] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/cases/${caseId}/assessments`)
        const d = await r.json()
        // A run that produced no results (nothing to characterize) does not
        // count as assessed.
        const runs = completedRuns(d?.assessments)
        if (!cancelled) setHasAssessment(runs.length > 0)

        // Which step actually carried the most climate impact, for the reveal
        // after a prediction. Newest run, headline category.
        const top = topClimateStep(runs[0])
        if (top !== undefined && !cancelled) setTopStep(top)
      } catch {
        /* advisory — panel falls back to the Inventory phase */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, refreshKey])

  // ---------- UI state ----------
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [canvasView, setCanvasView] = useState<CanvasView>('Tree')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarQuery, setSidebarQuery] = useState('')

  // ---------- Edit / create state (preserved) ----------
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editFormData, setEditFormData] = useState<EditFormData>({})
  // A change to the product's quantity waits here until the user says what it
  // means (scale the inputs, or the data already covers that many units).
  const [pendingScale, setPendingScale] = useState<(PendingScale & { fd: EditFormData }) | null>(null)
  const skipScaleCheck = useRef(false)

  // ---------- Fetch: full-page loader on the first load only ----------
  // Later refetches (lcapix:components-changed, delete, goal & scope) run in
  // the background with the editor mounted, so calculator and form state
  // survive them (EDIT-6). Every components response carries a sequence
  // number and only the newest one is applied, and the effect aborts its
  // requests when it re-runs, so an older response can never overwrite a
  // newer one.
  const loadedCaseId = useRef<string | null>(null)
  const componentsSeq = useRef(0)

  /** Fetch the case's components; returns them, or null if a newer fetch won. */
  const reloadComponents = async (signal?: AbortSignal): Promise<ComponentNode[] | null> => {
    const seq = ++componentsSeq.current
    const r = await apiRequest(`/api/cases/${caseId}/components`, signal ? { signal } : undefined)
    const data = await r.json()
    if (seq !== componentsSeq.current || signal?.aborted) return null
    const list: ComponentNode[] =
      data?.success && Array.isArray(data.components)
        ? data.components.map((dbComp: any) => transformComponentFromDB(dbComp))
        : []
    setComponents(list)
    return list
  }

  useEffect(() => {
    const controller = new AbortController()
    const firstLoad = loadedCaseId.current !== caseId
    const fetchCaseData = async () => {
      if (firstLoad) setIsLoading(true)
      try {
        const [caseResponse, list] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`, { signal: controller.signal }),
          reloadComponents(controller.signal),
        ])
        const caseData = await caseResponse.json()
        if (controller.signal.aborted) return

        if (caseData.success && caseData.case) {
          const transformedCase = transformCaseFromDB(caseData.case)
          setCurrentCase((prev) => ({
            ...transformedCase,
            components: list ?? prev?.components ?? [],
          }))
          setLearningState(caseData.case.learning_state ?? null)
          setHasWriteUp(!!String(caseData.case.interpretation ?? '').trim())
          loadedCaseId.current = caseId
        } else {
          toast.error('Case not found')
          router.push(`/project/${projectId}`)
        }
      } catch (error: any) {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        console.error('Failed to fetch case:', error)
        if (firstLoad) {
          toast.error('Failed to load case details')
          router.push(`/project/${projectId}`)
        } else {
          // A failed background refresh keeps what is on screen.
          toast.error('Could not refresh the case. What you see may be out of date.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    fetchCaseData()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, projectId, router, refreshKey])

  // ---------- Auto-select: the ?component=<name> deep-link target, else first root ----------
  useEffect(() => {
    if (components.length > 0 && !selectedNode) {
      const target = pickInitialComponent(components, {
        id: preselectComponentId,
        name: preselectComponent,
      })
      if (target) {
        setSelectedNode(target.id)
        loadFormFor(target)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.length, preselectComponent, preselectComponentId])

  // ---------- Tree adapter (memoized) ----------
  const tree = useMemo(() => componentsToTree(toComponentLikes(components)), [components])

  const flat: FlatCaseNode[] = useMemo(() => flattenTree(tree), [tree])

  const filteredFlat = useMemo(() => filterFlatByLabel(flat, sidebarQuery), [flat, sidebarQuery])

  const selectedFlatNode = useMemo(
    () => flat.find((n) => n.id === selectedNode) ?? null,
    [flat, selectedNode],
  )

  const selectedComponent = useMemo(
    () => (selectedNode ? components.find((c) => c.id === selectedNode) ?? null : null),
    [components, selectedNode],
  )

  // Subtree totals per node — parents are pure sums (terminating-node model).
  // Drives the Σ values in the detail strip and tells the inspector which
  // selected nodes are roll-ups (no flow/cost editing of their own).
  const rollups = useMemo(() => rollupTree(tree), [tree])
  const selectedRollup = selectedNode ? rollups.get(selectedNode) ?? null : null

  // Candidate re-parent targets for the inspector. A node may be moved under
  // any COARSER node (levels may be skipped — an Operation can sit directly
  // under a Product), across any branch of the tree, or made independent.
  // Self + descendants are excluded to prevent cycles.
  const parentOptions = useMemo(
    () => parentOptionsFor(components, selectedComponent),
    [components, selectedComponent],
  )

  // ---------- Form helpers ----------
  function loadFormFor(c: ComponentNode) {
    setEditFormData(formDataFromComponent(c))
    setIsEditing(true)
    setIsCreating(false)
  }

  // ---------- Selection ----------
  const handleSelect = (id: string) => {
    if (id === '__root__') {
      setSelectedNode(null)
      setIsEditing(false)
      return
    }
    setSelectedNode(id)
    const c = components.find((x) => x.id === id)
    if (c) loadFormFor(c)
  }

  // ---------- Run Assessment ----------
  // One click actually RUNS the calculation (POST), then navigates to results.
  // Previously this only navigated to the results page, forcing the user to
  // click "Run new" there — so "Run Assessment" never actually computed.
  const [isRunning, setIsRunning] = useState(false)
  const handleRunAssessment = async () => {
    if (isRunning) return
    if (!canRun) {
      toast.error(runBlockedMessage(fuMissing))
      if (fuMissing) setGoalOpenSignal((s) => s + 1)
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

  // ---------- Create component ----------
  // Routes to the /component/new URL; an intercepting parallel route renders
  // that page as a modal over this editor while keeping the case canvas
  // mounted underneath.
  const handleCreateComponent = () => {
    // Carry the selection as placement context: a new component defaults to
    // being the CHILD of the node the user is standing on (or its sibling,
    // when a leaf is selected) — never a guess from elsewhere in the tree.
    const query = newComponentQuery(selectedComponent)
    router.push(`/project/${projectId}/case/${caseId}/component/new${query}`)
  }

  // ---------- Rescale (product quantity changed, user chose what it means) ----------
  const applyScale = async (mode: 'scale-inputs' | 'data-covers') => {
    if (!pendingScale) return
    const { from, to, fd } = pendingScale
    setPendingScale(null)
    try {
      const r = await apiRequest(`/api/cases/${caseId}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, mode }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || 'Could not rescale the case')
      toast.success(scaleSuccessMessage(mode, j.flows_scaled, from, to))
      // Save the rest of the edited fields; the quantity is already set.
      skipScaleCheck.current = true
      await handleSaveComponent({ ...fd, mass: to })
      window.dispatchEvent(new Event('lcapix:flows-changed'))
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      toast.error(e?.message || 'Could not rescale the case')
    }
  }

  // ---------- Save (preserved) ----------
  // Accepts an optional override merged over the current form state, so callers
  // (e.g. the cost "Apply" affordance) can apply-and-save in one action without
  // waiting for a separate Save click or a React state flush.
  const handleSaveComponent = async (override?: Partial<EditFormData>) => {
    const fd = { ...editFormData, ...(override || {}) }
    const invalid = validateComponentSave(fd)
    if (invalid) {
      toast.error(invalid)
      return
    }

    // Changing the product's quantity rescales the case: ask first.
    const current = components.find((c) => c.id === selectedNode)
    if (isEditing && !skipScaleCheck.current) {
      const change = pendingRescale(current, fd)
      if (change) {
        setPendingScale({ ...change, fd })
        return
      }
    }
    skipScaleCheck.current = false

    try {
      if (isEditing && selectedNode) {
        const updatePayload = buildComponentUpdatePayload(fd)

        const response = await apiRequest(`/api/components/${selectedNode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Failed to update component')

        const transformed = await reloadComponents()
        if (transformed) {
          // Re-fill the panel from what was just saved. It used to be cleared
          // (setEditFormData({}) below), so every field went blank after Save
          // and only came back when the step was selected again.
          const saved = transformed.find((c: any) => String(c.id) === String(selectedNode))
          if (saved) loadFormFor(saved)
        }
        toast.success('Component updated successfully')
      } else if (isCreating) {
        if (editFormData.processType === COMPONENT_TYPES.PRODUCT) {
          if (components.some((c) => c.type === COMPONENT_TYPES.PRODUCT)) {
            toast.error('Only one Product component is allowed per case')
            return
          }
        }
        const createPayload = {
          component_name: fd.processName!.trim(),
          component_type: fd.processType,
          component_description: fd.processDescription || null,
          parent_component_id: fd.parentId
            ? parseInt(fd.parentId)
            : null,
          process_type: fd.processType,
          driver_category: fd.driverCategory || null,
          driver_type: fd.selectedDriver || null,
          drivers:
            fd.drivers && fd.drivers.length > 0
              ? JSON.stringify(fd.drivers)
              : null,
          quantity: fd.mass || null,
          unit: fd.massUnit || null,
          opex: costOrNull(fd.operationalCostUSD),
          capex: costOrNull(fd.capitalCostUSD),
          labor_cost: costOrNull(fd.laborCost),
          energy_cost: costOrNull(fd.energyCost),
          transportation_cost: costOrNull(fd.transportationCost),
          material_cost: costOrNull(fd.materialCost),
          equipment_cost: costOrNull(fd.equipmentCost),
          overhead_cost: costOrNull(fd.overheadCost),
          currency: fd.currency || 'USD',
          cost_allocation_type: fd.costAllocationType || 'manual',
        }

        const response = await apiRequest(`/api/cases/${caseId}/components`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Failed to create component')

        const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
        const componentsData = await componentsResponse.json()
        if (componentsData.success && componentsData.components) {
          const transformed = componentsData.components.map(transformComponentFromDB)
          setComponents(transformed)
          if (result.component?.component_id) {
            const newId = String(result.component.component_id)
            setSelectedNode(newId)
            const made = transformed.find((c: any) => String(c.id) === newId)
            if (made) loadFormFor(made)
          }
        }
        toast.success('Component created successfully')
      }

      setIsCreating(false)
    } catch (error: any) {
      console.error('Error saving component:', error)
      toast.error(error.message || 'Failed to save component')
    }
  }

  // ---------- Delete ----------
  // Deletes on the server (DELETE /api/components/:id), then refetches; the
  // node only disappears once the server says it is gone (EDIT-1). A step
  // with children asks two plain questions, and Cancel on the last one never
  // does anything: delete everything under it, or keep the children by
  // moving them up to this step's parent.
  const [isDeleting, setIsDeleting] = useState(false)
  const handleDeleteSelected = async () => {
    if (!selectedNode || isDeleting) return
    const plan = planDelete(components, selectedNode)
    if (!plan) return
    const { comp, children, below } = plan

    const mode = chooseDeleteMode(plan, components, (message) => confirm(message))
    if (!mode) return

    setIsDeleting(true)
    try {
      const res = await apiRequest(
        `/api/components/${encodeURIComponent(comp.id)}?children=${mode}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Could not delete "${comp.name}" (${res.status})`)
      }
      // Keep the persisted local cache in step with the server.
      if (mode === 'delete') {
        ;[comp.id, ...below].forEach((id) => deleteComponentNode(id))
      } else {
        children.forEach((ch) => updateComponentNode(ch.id, { parentId: comp.parentId ?? null }))
        deleteComponentNode(comp.id)
      }
      toast.success(deleteSuccessMessage(plan, mode))
      setSelectedNode(null)
      setIsEditing(false)
      setEditFormData({})
      // Background refetch of the tree, completeness and journey.
      setRefreshKey((k) => k + 1)
    } catch (e: any) {
      // The node stays: nothing was removed locally.
      toast.error(e?.message || `Could not delete "${comp.name}"`)
    } finally {
      setIsDeleting(false)
    }
  }

  // ---------- Goal & scope saved (EDIT-8) ----------
  // Saving the data basis also rewrites the product's quantity on the server.
  // Pull the tree again and carry the new quantity into an open product form,
  // or the next inspector Save would send the old one and revert it.
  const handleGoalScopeSaved = async () => {
    try {
      const list = await reloadComponents()
      const product = list?.find((c) => c.type === COMPONENT_TYPES.PRODUCT && !c.parentId)
      if (product && product.id === selectedNode) {
        setEditFormData((f) => ({ ...f, mass: product.mass }))
      }
    } catch {
      toast.error('Could not refresh the steps after saving goal & scope')
    }
  }

  // ---------- Render ----------
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        Loading case...
      </div>
    )
  }

  if (!currentCase) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Case not found</div>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/home')}>
          Return to Home
        </button>
      </div>
    )
  }

  // Flows for a selected component are loaded live by EnvironmentalFlowsEditor
  // inside InspectorPanel (GET /api/components/:id/flows). The `flows` prop is
  // only a read-only fallback for non-editable contexts, so it stays empty here.

  return (
    <div
      className="app-shell"
      style={{
        // Fix the editor to the viewport below the 56px AppTopBar —
        // the page itself must NOT scroll. Each pane (left tree, center
        // canvas, right Inspector) scrolls internally so the bottom
        // details + right inspector stay reachable regardless of how
        // tall the process hierarchy gets.
        height: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          {
            label: projectName || 'Project',
            onClick: () => router.push(`/project/${projectId}`),
          },
          { label: currentCase.name },
        ]}
      />

      {/* Toolbar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface-base)',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            gap: 4,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {(() => {
            const tabs = ['Tree', 'List', 'Graph'] as CanvasView[]
            const activeIdx = tabs.indexOf(canvasView)
            const tabW = 100 / tabs.length
            return (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 2,
                  bottom: 2,
                  left: `calc(${activeIdx} * ${tabW}% + 2px)`,
                  width: `calc(${tabW}% - 4px)`,
                  background: 'var(--surface-overlay)',
                  borderRadius: 4,
                  transition: 'left 240ms cubic-bezier(0.2, 0.8, 0.2, 1), width 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                  zIndex: 0,
                }}
              />
            )
          })()}
          {(['Tree', 'List', 'Graph'] as CanvasView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCanvasView(v)}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '6px 12px',
                borderRadius: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color:
                  canvasView === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                fontWeight: canvasView === v ? 500 : 400,
                transition: 'color 200ms',
                flex: '1 0 auto',
                textAlign: 'center',
              }}
            >
              {v === 'Graph' ? 'Plot' : v}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '0 10px',
            height: 32,
            width: 280,
          }}
        >
          <Icon name="search" size={14} style={{ color: 'var(--text-tertiary)' }} />
          <input
            placeholder="Find substance, component, or flow…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 12,
              flex: 1,
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            setSearchQuery('')
            setSidebarQuery('')
          }}
        >
          <Icon name="refresh" size={14} /> Reset
        </button>
        <button
          className={learnOpen ? 'btn btn-primary btn-sm' : 'btn btn-toggle btn-sm'}
          type="button"
          title="Five short lessons that follow the ISO phases, done on this case"
          onClick={() => setLearnOpen((v) => !v)}
          aria-pressed={learnOpen}
        >
          <Icon name="target" size={14} /> Learn
        </button>
        <button
          className={referenceOpen ? 'btn btn-primary btn-sm' : 'btn btn-toggle btn-sm'}
          type="button"
          title="Open the document you are reading your quantities from"
          onClick={() => setReferenceOpen((v) => !v)}
          aria-pressed={referenceOpen}
        >
          <Icon name="file" size={14} /> Reference
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          title="Copy this case (tree, flows, costs) as a what-if with one change"
          onClick={() => setDupOpen(true)}
        >
          <Icon name="layers" size={14} /> Duplicate
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleRunAssessment}
          disabled={isRunning || !canRun}
          title={runButtonTitle(fuMissing, canRun)}
        >
          <Icon name="run" size={14} /> {isRunning ? 'Running…' : 'Run Assessment'}
        </button>
      </div>

      {/* Status panel — the "where am I / what's blocking me / what's next"
          orientation for a classroom user. Journey phase stepper + a plain
          headline (blocked / ready / assessed) + the single next action + the
          missing-layer checklist. Run is still gated on canRun. */}
      {completeness &&
        (() => {
          // Phases reflect the data actually in the case: a run on half an
          // inventory shows Impact as partial, never a free tick.
          const { phases, partialRun, addedLabels, status, accent, missingPhrase, ...view } =
            deriveCaseStatus({
              completeness,
              goalScopeLoaded: !!goalScope,
              fuMissing,
              canRun,
              hasAssessment,
            })
          const primary = {
            label: view.primary.label,
            run: view.primary.run,
            onClick:
              view.primary.action === 'set-functional-unit'
                ? () => setGoalOpenSignal((s) => s + 1)
                : view.primary.action === 'add-inputs'
                  ? () => router.push(`/project/${projectId}/import`)
                  : view.primary.action === 'run'
                    ? handleRunAssessment
                    : () => router.push(`/project/${projectId}/case/${caseId}/results`),
          }
          return (
            <div
              className="card"
              style={{ margin: '0 0 12px', padding: '12px 16px', borderLeft: `3px solid ${accent}` }}
            >
              {/* Phase stepper — restores the 5-phase orientation from project setup */}
              <div style={{ marginBottom: 10 }}>
                <PhaseStepper phases={phases} accent={accent} />
              </div>
              {/* Headline + what's blocking + the next action */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {status === 'blocked'
                      ? fuMissing
                        ? 'Blocked — functional unit not set'
                        : 'Blocked — nothing to assess yet'
                      : status === 'ready'
                        ? 'Ready to run'
                        : partialRun
                          ? 'Assessed on partial data'
                          : 'Assessed'}{' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                      · Data added: {addedLabels.length ? addedLabels.join(', ') : 'nothing yet'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {status === 'blocked' && fuMissing ? (
                      <>
                        Every result is reported per functional unit (for example per bike, or per
                        1,000 km of riding). Next: set it in Goal &amp; scope below.
                      </>
                    ) : status === 'blocked' ? (
                      <>
                        This case has no inputs or emissions, so an assessment would be 0.
                        Next: add a material or energy input to a process step.
                      </>
                    ) : status === 'ready' ? (
                      missingPhrase ? (
                        <>
                          You can run now (partial). To make it complete, next add{' '}
                          <strong>{missingPhrase}</strong>.
                        </>
                      ) : (
                        <>All the data is in. Next: run the assessment.</>
                      )
                    ) : missingPhrase ? (
                      <>
                        Results are in. To improve accuracy, add <strong>{missingPhrase}</strong>{' '}
                        and re-run. Otherwise, interpret your results.
                      </>
                    ) : (
                      <>Results are in and all the data is in. Next: interpret them.</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={primary.onClick}
                  disabled={primary.run && isRunning}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {primary.run && isRunning ? 'Running…' : primary.label} →
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push(`/project/${projectId}/import`)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Icon name="file" size={13} /> Add a document
                </button>
              </div>
              {/* Full missing checklist: goal & scope first, then inventory layers */}
              {(fuMissing || completeness.missing.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {fuMissing && (
                    <span className="chip" style={{ fontSize: 10.5 }}>
                      To add: Functional unit → Goal &amp; scope
                    </span>
                  )}
                  {completeness.missing.map((m) => (
                    <span
                      key={m.layer}
                      className="chip"
                      title={
                        m.suggestedDocs.length
                          ? `Comes from: ${m.suggestedDocs.join(' or ')}`
                          : 'No document type for this yet: enter it by hand on the step that uses it.'
                      }
                      style={{ fontSize: 10.5 }}
                    >
                      To add: {m.label}
                      {m.suggestedDocs.length ? ` → ${m.suggestedDocs[0]}` : ' (by hand)'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

      <CaseNameDialog
        open={dupOpen}
        title="Duplicate this case"
        initialName={`${currentCase.name} (copy)`}
        confirmLabel="Duplicate"
        help={ISO_HELP.caseCopyName}
        busy={dupBusy}
        error={dupError}
        onCancel={() => {
          setDupOpen(false)
          setDupError(null)
        }}
        onSubmit={async (name) => {
          setDupBusy(true)
          setDupError(null)
          try {
            const r = await fetch(`/api/cases/${caseId}/duplicate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('auth_token')
                  ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                  : {}),
              },
              body: JSON.stringify({ case_name: name }),
            })
            const j = await r.json().catch(() => null)
            if (r.ok && j?.case_id) {
              toast.success(`Created "${j.case_name}": ${j.components_copied} nodes and ${j.flows_copied} flows copied`)
              setDupOpen(false)
              router.push(`/project/${projectId}/case/${j.case_id}`)
            } else {
              setDupError(j?.error || 'Could not duplicate case')
            }
          } catch {
            setDupError('Could not duplicate case')
          } finally {
            setDupBusy(false)
          }
        }}
      />

      <ScaleDialog
        pending={pendingScale}
        unit={components.find((c) => c.type === COMPONENT_TYPES.PRODUCT)?.massUnit}
        onChoose={applyScale}
        onCancel={() => {
          // Put the field back to the saved quantity so nothing looks changed.
          if (pendingScale) setEditFormData((f) => ({ ...f, mass: pendingScale.from }))
          setPendingScale(null)
        }}
      />

      <GoalScopeCard
        key={`goal-scope-${refreshKey}`}
        projectId={projectId}
        caseId={caseId}
        openSignal={goalOpenSignal}
        onChange={setGoalScope}
        onSaved={handleGoalScopeSaved}
      />

      {learnOpen && (
        <LessonRail
          caseId={caseId}
          initialState={learningState}
          facts={{
            functionalUnitSet: !!goalScope && !fuMissing,
            layers: completeness?.present ?? [],
            hasRun: hasAssessment,
            hasComparableCase,
            hasWriteUp,
          }}
          steps={lessonStepNames(components)}
          topStep={topStep}
          onClose={() => setLearnOpen(false)}
        />
      )}

      {/* 3-pane */}
      <div
        className="case-panes"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: referenceOpen
            ? '220px minmax(320px, 1fr) 340px 420px'
            : '220px minmax(400px, 1fr) 340px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left sidebar */}
        <aside
          className="case-sidebar"
          style={{
            borderRight: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '0 10px',
                height: 30,
              }}
            >
              <Icon name="search" size={13} style={{ color: 'var(--text-tertiary)' }} />
              <input
                placeholder="Components"
                value={sidebarQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSidebarQuery(e.target.value)
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  flex: 1,
                  fontFamily: 'var(--font-ui)',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '8px 6px' }}>
            {filteredFlat.length === 0 && (
              <div
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                }}
              >
                {components.length === 0
                  ? 'No components yet.'
                  : 'No components match that search.'}
              </div>
            )}
            {filteredFlat.map((n) => {
              const active = selectedNode === n.id
              const t = HIERARCHY_TYPES.find((h) => h.id === n.type)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleSelect(n.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    paddingLeft: 8 + n.depth * 14,
                    border: 'none',
                    borderLeft:
                      '3px solid ' +
                      (active ? 'var(--brand-primary)' : 'transparent'),
                    background: active ? 'var(--surface-overlay)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-ui)',
                    borderRadius: 4,
                    marginBottom: 1,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: t?.color,
                      background: 'oklch(from ' + t?.color + ' l c h / 0.15)',
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {t?.short}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {n.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            style={{
              padding: 10,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              type="button"
              onClick={handleCreateComponent}
            >
              <Icon name="plus" size={12} /> Add Component
            </button>
          </div>
        </aside>

        {/* Center canvas */}
        <section
          style={{
            background: 'var(--surface-sunken)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            id="case-canvas-host"
            style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            />
            {tree ? (
              <TreeCanvas
                root={tree}
                flat={flat}
                selected={selectedNode}
                onSelect={handleSelect}
                view={canvasView}
                highlightQuery={searchQuery}
              />
            ) : (
              <div
                style={{
                  padding: 48,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 10 }}>
                  No components in this case yet.
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={handleCreateComponent}
                >
                  <Icon name="plus" size={12} /> Create your first component
                </button>
              </div>
            )}
          </div>
          <NodeDetailsStrip
            node={selectedFlatNode}
            totalComponents={components.length}
            rolled={selectedRollup}
            hasChildren={!!selectedRollup?.hasChildren}
          />
        </section>

        {/* Right inspector */}
        <aside
          className="case-inspector"
          style={{
            borderLeft: '1px solid var(--border-subtle)',
            background: 'var(--surface-base)',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {isCreating ? (
            <CreateComponentBanner
              formData={editFormData}
              onChange={(patch) => setEditFormData((f) => ({ ...f, ...patch }))}
              onSave={() => handleSaveComponent()}
              onCancel={() => {
                setIsCreating(false)
                setEditFormData({})
              }}
              components={components}
            />
          ) : (
            <InspectorPanel
              node={selectedFlatNode}
              studyMethod={studyMethod}
              editFormData={selectedComponent ? editFormData : undefined}
              onChange={
                selectedComponent
                  ? (patch) => setEditFormData((f) => ({ ...f, ...patch }))
                  : undefined
              }
              onSave={selectedComponent ? () => handleSaveComponent() : undefined}
              onDelete={selectedComponent ? handleDeleteSelected : undefined}
              parentOptions={parentOptions}
              hasChildren={!!selectedRollup?.hasChildren}
              rolled={selectedRollup}
              onApplyCosts={
                selectedComponent
                  ? (patch) => {
                      setEditFormData((f) => ({ ...f, ...patch }))
                      // Save with the patch merged directly (avoids stale state).
                      handleSaveComponent(patch as any)
                    }
                  : undefined
              }
            />
          )}
        </aside>

        {referenceOpen && (
          <ReferencePane caseId={caseId} onClose={() => setReferenceOpen(false)} />
        )}
      </div>
    </div>
  )
}

// Lightweight create-component panel (reuses the inspector sections' look
// but wires the minimum fields required by the POST payload).
function CreateComponentBanner({
  formData,
  onChange,
  onSave,
  onCancel,
  components,
}: {
  formData: EditFormData
  onChange: (patch: Partial<EditFormData>) => void
  onSave: () => void
  onCancel: () => void
  components: ComponentNode[]
}) {
  const TYPE_OPTIONS = [
    { value: 'product', label: 'Product' },
    { value: 'machine_line', label: 'Machine/Line' },
    { value: 'subprocess', label: 'Subprocess' },
    { value: 'operation', label: 'Operation' },
    { value: 'elemental_task', label: 'Elemental Task' },
  ]
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
        New Component
      </div>
      <label className="label">Type</label>
      <select
        className="input"
        style={{ height: 32, fontSize: 13 }}
        value={formData.processType || ''}
        onChange={(e) => onChange({ processType: e.target.value })}
      >
        <option value="">— Select type —</option>
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="label">Name</label>
      <input
        className="input"
        style={{ height: 32, fontSize: 13 }}
        value={formData.processName || ''}
        onChange={(e) => onChange({ processName: e.target.value })}
      />
      <label className="label">Parent</label>
      <select
        className="input"
        style={{ height: 32, fontSize: 13 }}
        value={formData.parentId || ''}
        onChange={(e) => onChange({ parentId: e.target.value })}
      >
        <option value="">(no parent — floating)</option>
        {components.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="label">Description</label>
      <textarea
        className="input"
        style={{ height: 60, padding: 8, fontSize: 12, resize: 'vertical' }}
        value={formData.processDescription || ''}
        onChange={(e) => onChange({ processDescription: e.target.value })}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
          Cancel
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" type="button" onClick={onSave}>
          Create
        </button>
      </div>
    </div>
  )
}
