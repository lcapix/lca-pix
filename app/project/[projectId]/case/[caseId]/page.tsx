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
import {
  componentsToTree,
  flattenTree,
  normalizeType,
  rollupTree,
  type ComponentLike,
} from '@/lib/case-tree-adapter'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'

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
import { journeyPhases } from '@/lib/case-journey'
import { LAYER_LABEL, type CaseLayer } from '@/lib/ingest/doc-types'

// A typed 0 is a real cost ("this operation costs nothing"), distinct from an
// empty field (unknown). `x || null` collapsed both to null, and the component
// PUT's COALESCE then kept the previous number — so editing a cost to 0 silently
// reverted. This preserves 0 and any valid number; only truly-empty inputs → null.
const costOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

// Component type constants matching DB enum.
const COMPONENT_TYPES = {
  PRODUCT: 'product',
  MACHINE_LINE: 'machine_line',
  SUBPROCESS: 'subprocess',
  OPERATION: 'operation',
  ELEMENTAL_TASK: 'elemental_task',
} as const

interface EditFormData extends InspectorEditFormData {
  processType?: string
  parentId?: string
  driverCategory?: string
  selectedDriver?: string
  drivers?: string[]
  operationalCostUSD?: number
  capitalCostUSD?: number
  currency?: string
  costAllocationType?: 'manual' | 'calculated' | 'allocated'
}

export default function CaseViewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const caseId = params.caseId as string
  // Deep-link target: the results page links each flow row to
  // ?component=<name> so "click a flow → edit its component" works.
  const preselectComponent = searchParams.get('component')

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
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1)
    window.addEventListener('lcapix:components-changed', handler)
    return () => window.removeEventListener('lcapix:components-changed', handler)
  }, [])
  // Fetched once for the breadcrumb so it reads "<project name>" instead of "Project".
  const [projectName, setProjectName] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}`)
        const d = await r.json()
        if (!cancelled && d?.success) {
          setProjectName(d.project?.project_name ?? '')
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
  type CompletenessReport = {
    present: string[]
    missing: Array<{ layer: string; label: string; suggestedDocs: string[] }>
    score: number
  }
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
  const IMPACT_LAYERS = ['materials', 'energy', 'emissions', 'transport']
  const inventoryReady =
    !completeness || completeness.present.some((l) => IMPACT_LAYERS.includes(l))

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
        const runs = (d?.assessments ?? []).filter(
          (a: any) =>
            (!a.status || a.status === 'completed') && Object.keys(a.impacts ?? {}).length > 0,
        )
        if (!cancelled) setHasAssessment(runs.length > 0)
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

  // ---------- Fetch on mount (unchanged logic) ----------
  useEffect(() => {
    const fetchCaseData = async () => {
      setIsLoading(true)
      try {
        const [caseResponse, componentsResponse] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`),
          apiRequest(`/api/cases/${caseId}/components`),
        ])

        const caseData = await caseResponse.json()
        const componentsData = await componentsResponse.json()

        if (caseData.success && caseData.case) {
          const transformedCase = transformCaseFromDB(caseData.case)
          const transformedComponents =
            componentsData.success && componentsData.components
              ? componentsData.components.map((dbComp: any) =>
                  transformComponentFromDB(dbComp),
                )
              : []

          setCurrentCase({ ...transformedCase, components: transformedComponents })
          setComponents(transformedComponents)
        } else {
          toast.error('Case not found')
          router.push(`/project/${projectId}`)
        }
      } catch (error) {
        console.error('Failed to fetch case:', error)
        toast.error('Failed to load case details')
        router.push(`/project/${projectId}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCaseData()
  }, [caseId, projectId, router, refreshKey])

  // ---------- Auto-select: the ?component=<name> deep-link target, else first root ----------
  useEffect(() => {
    if (components.length > 0 && !selectedNode) {
      const named = preselectComponent
        ? components.find((c) => c.name === preselectComponent)
        : null
      const target = named ?? components.find((c) => !c.parentId) ?? components[0]
      if (target) {
        setSelectedNode(target.id)
        loadFormFor(target)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.length, preselectComponent])

  // ---------- Tree adapter (memoized) ----------
  const tree = useMemo(() => {
    const likes: ComponentLike[] = components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId ?? null,
      operationalCostUSD: c.operationalCostUSD ?? null,
      capitalCostUSD: c.capitalCostUSD ?? null,
      laborCost: (c as any).laborCost ?? null,
      energyCost: (c as any).energyCost ?? null,
      materialCost: (c as any).materialCost ?? null,
      transportationCost: (c as any).transportationCost ?? null,
      equipmentCost: (c as any).equipmentCost ?? null,
      overheadCost: (c as any).overheadCost ?? null,
      drivers: c.drivers ?? null,
      flowCount: (c as any).flowCount ?? null,
    }))
    return componentsToTree(likes)
  }, [components])

  const flat: FlatCaseNode[] = useMemo(() => flattenTree(tree), [tree])

  const filteredFlat = useMemo(() => {
    if (!sidebarQuery.trim()) return flat
    const q = sidebarQuery.toLowerCase()
    return flat.filter((n) => n.label.toLowerCase().includes(q))
  }, [flat, sidebarQuery])

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
  const parentOptions = useMemo(() => {
    if (!selectedComponent) return []
    const RANK_DB: Record<string, number> = {
      product: 1,
      machine_line: 2,
      subprocess: 3,
      operation: 4,
      elemental_task: 5,
    }
    const ownRank = RANK_DB[selectedComponent.type as string]
    if (!ownRank || ownRank === 1) return []

    const descendants = new Set<string>()
    const stack = [selectedComponent.id]
    while (stack.length) {
      const cur = stack.pop()!
      for (const c of components) {
        if (c.parentId === cur && !descendants.has(c.id)) {
          descendants.add(c.id)
          stack.push(c.id)
        }
      }
    }
    return components
      .filter(
        (c) =>
          c.id !== selectedComponent.id &&
          !descendants.has(c.id) &&
          (RANK_DB[c.type as string] ?? 99) < ownRank,
      )
      .map((c) => {
        const tdef = HIERARCHY_TYPES.find(
          (h) => (h.id as string) === (normalizeType(c.type) as unknown as string),
        )
        return { id: c.id, label: `${c.name} (${tdef?.label ?? c.type})` }
      })
  }, [components, selectedComponent])

  // ---------- Form helpers ----------
  function loadFormFor(c: ComponentNode) {
    setEditFormData({
      processName: c.name,
      processType: c.type,
      processDescription: c.description || '',
      driverCategory: c.driverCategory || '',
      selectedDriver: c.selectedDriver || '',
      mass: c.mass ?? undefined,
      massUnit: c.massUnit || '',
      operationalCostUSD: c.operationalCostUSD ?? undefined,
      capitalCostUSD: c.capitalCostUSD ?? undefined,
      parentId: c.parentId || undefined,
      laborCost: (c as any).laborCost ?? undefined,
      laborHours: (c as any).laborHours ?? undefined,
      laborOccupation: (c as any).laborOccupation ?? undefined,
      energyCost: (c as any).energyCost ?? undefined,
      transportationCost: (c as any).transportationCost ?? undefined,
      materialCost: (c as any).materialCost ?? undefined,
      equipmentCost: (c as any).equipmentCost ?? undefined,
      overheadCost: (c as any).overheadCost ?? undefined,
      currency: (c as any).currency || 'USD',
      costAllocationType: (c as any).costAllocationType ?? undefined,
      allocationMethod: c.allocationMethod ?? 'none',
      allocationFactor: c.allocationFactor ?? 1,
      allocationNote: c.allocationNote ?? undefined,
    })
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
      toast.error(
        fuMissing
          ? 'Set the functional unit first (Goal & scope), so the result is per something.'
          : 'Nothing to assess yet — add at least one input or emission (materials, energy, or a direct output). A case with no flows would return 0.',
      )
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
      let remembered: { method?: string; region?: string } = {}
      try {
        remembered = JSON.parse(localStorage.getItem(`lcapix-run-prefs:${caseId}`) || '{}')
      } catch { /* corrupt prefs are ignorable */ }
      const res = await apiRequest(`/api/cases/${caseId}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          run_name: 'Assessment',
          ...(remembered.method ? { calculation_method: remembered.method } : {}),
          ...(remembered.region ? { region_code: remembered.region } : {}),
        }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText)
        throw new Error(msg || `Assessment failed (${res.status})`)
      }
      const data = await res.json().catch(() => ({}))
      const total = data?.total_impacts?.find?.(
        (t: any) => /global warming/i.test(t.category_name),
      )?.impact_value
      toast.success(
        typeof total === 'number'
          ? `Assessment complete — ${total.toFixed(3)} kg CO₂-eq`
          : 'Assessment complete',
      )
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
    const CHILD_OF: Record<string, string> = {
      product: 'machine_line',
      machine_line: 'subprocess',
      subprocess: 'operation',
      operation: 'elemental_task',
    }
    const sel = selectedComponent
    let query = ''
    if (sel) {
      const childType = CHILD_OF[sel.type as string]
      if (childType) {
        query = `?parent=${encodeURIComponent(sel.id)}&type=${encodeURIComponent(childType)}`
      } else if (sel.parentId) {
        // Leaf selected → suggest a sibling under the same parent.
        query = `?parent=${encodeURIComponent(sel.parentId)}&type=${encodeURIComponent(sel.type as string)}`
      }
    }
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
      toast.success(
        mode === 'scale-inputs'
          ? `Scaled ${j.flows_scaled ?? 0} inputs/outputs and every per-unit cost ×${Number((to / from).toPrecision(3))} to ${to} units`
          : `Kept the inputs as entered; they now count as ${to} units`,
      )
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
    if (!fd.processType) {
      toast.error('Please select a process type')
      return
    }
    if (!fd.processName || !fd.processName.trim()) {
      toast.error('Component name is required')
      return
    }
    if (fd.processType !== COMPONENT_TYPES.PRODUCT && !fd.parentId) {
      toast.error('Every step needs a parent. Pick one under Placement (only the product has none).')
      return
    }
    if (
      (fd.allocationMethod === 'physical' || fd.allocationMethod === 'economic') &&
      !(Number(fd.allocationFactor) > 0 && Number(fd.allocationFactor) <= 1)
    ) {
      toast.error('Enter the share (0.1 to 100%) that belongs to this product, or set allocation to None')
      return
    }

    // Changing the product's quantity rescales the case: ask first.
    const current = components.find((c) => c.id === selectedNode)
    if (isEditing && current?.type === COMPONENT_TYPES.PRODUCT && !skipScaleCheck.current) {
      const from = Number(current.mass ?? 1) || 1
      const to = Number(fd.mass ?? from)
      if (to > 0 && to !== from) {
        setPendingScale({ from, to, fd })
        return
      }
    }
    skipScaleCheck.current = false

    try {
      if (isEditing && selectedNode) {
        const updatePayload = {
          component_name: fd.processName.trim(),
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
          labor_hours: fd.laborHours ?? null,
          labor_occupation: fd.laborOccupation || null,
          energy_cost: costOrNull(fd.energyCost),
          transportation_cost: costOrNull(fd.transportationCost),
          material_cost: costOrNull(fd.materialCost),
          equipment_cost: costOrNull(fd.equipmentCost),
          overhead_cost: costOrNull(fd.overheadCost),
          currency: fd.currency || 'USD',
          cost_allocation_type: fd.costAllocationType || 'manual',
          allocation_method: fd.allocationMethod ?? null,
          allocation_factor:
            fd.allocationMethod === 'none' ? 1 : fd.allocationFactor ?? null,
          allocation_note: fd.allocationNote ?? null,
        }

        const response = await apiRequest(`/api/components/${selectedNode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Failed to update component')

        const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
        const componentsData = await componentsResponse.json()
        if (componentsData.success && componentsData.components) {
          const transformed = componentsData.components.map(transformComponentFromDB)
          setComponents(transformed)
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

  // ---------- Delete (preserved, simplified for inspector button) ----------
  const handleDeleteSelected = () => {
    if (!selectedNode) return
    const comp = components.find((c) => c.id === selectedNode)
    if (!comp) return
    if (!confirm(`Delete "${comp.name}"? This action cannot be undone.`)) return

    const children = components.filter((c) => c.parentId === comp.id)
    if (children.length > 0) {
      const cascade = confirm(
        `"${comp.name}" has ${children.length} child component(s). OK = cascade delete all, Cancel = convert children to floating components.`,
      )
      if (cascade) {
        const deleteRecursively = (nodeId: string) => {
          components
            .filter((c) => c.parentId === nodeId)
            .forEach((ch) => deleteRecursively(ch.id))
          deleteComponentNode(nodeId)
        }
        deleteRecursively(comp.id)
        toast.success(`Deleted with ${children.length} child(ren)`)
      } else {
        children.forEach((ch) => updateComponentNode(ch.id, { parentId: null }))
        deleteComponentNode(comp.id)
        toast.success(`Deleted. ${children.length} child(ren) now floating`)
      }
    } else {
      deleteComponentNode(comp.id)
      toast.success('Component deleted')
    }

    setSelectedNode(null)
    setIsEditing(false)
    setEditFormData({})
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
          title={
            fuMissing
              ? 'Set the functional unit (Goal & scope) before running'
              : !canRun
                ? 'Add at least one input or emission before running'
                : undefined
          }
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
          const phases = journeyPhases({
            fuSet: goalScope ? !fuMissing : null,
            present: completeness.present,
            hasAssessment,
          })
          const partialRun = phases.find((p) => p.label === 'Impact')?.state === 'partial'
          const addedLabels = completeness.present.map(
            (l) => LAYER_LABEL[l as CaseLayer] ?? l,
          )
          const firstMissing = completeness.missing[0]
          const status: 'blocked' | 'ready' | 'assessed' = !canRun
            ? 'blocked'
            : !hasAssessment
              ? 'ready'
              : 'assessed'
          const accent =
            status === 'blocked'
              ? '#c0392b'
              : status === 'assessed'
                ? 'var(--accent, #4f8a6a)'
                : 'var(--signal-info, #2563eb)'
          const primary =
            status === 'blocked' && fuMissing
              ? {
                  label: 'Set functional unit',
                  run: false,
                  onClick: () => setGoalOpenSignal((s) => s + 1),
                }
              : status === 'blocked'
              ? {
                  label: 'Add material inputs',
                  run: false,
                  onClick: () => router.push(`/project/${projectId}/import`),
                }
              : status === 'ready'
                ? { label: 'Run assessment', run: true, onClick: handleRunAssessment }
                : {
                    label: 'View results',
                    run: false,
                    onClick: () =>
                      router.push(`/project/${projectId}/case/${caseId}/results`),
                  }
          const missingPhrase = firstMissing
            ? `${firstMissing.label}${
                firstMissing.suggestedDocs[0]
                  ? ` (from a ${firstMissing.suggestedDocs[0]})`
                  : ' (enter it by hand on the step that uses it)'
              }`
            : null
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
        onCancel={() => setDupOpen(false)}
        onSubmit={async (name) => {
          setDupBusy(true)
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
              toast.error(j?.error || 'Could not duplicate case')
            }
          } catch {
            toast.error('Could not duplicate case')
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
      />

      {/* 3-pane */}
      <div
        className="case-panes"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '220px minmax(400px, 1fr) 340px',
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
              onChange={(patch) => setEditFormData({ ...editFormData, ...patch })}
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
              editFormData={selectedComponent ? editFormData : undefined}
              onChange={
                selectedComponent
                  ? (patch) => setEditFormData({ ...editFormData, ...patch })
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
                      setEditFormData({ ...editFormData, ...patch })
                      // Save with the patch merged directly (avoids stale state).
                      handleSaveComponent(patch as any)
                    }
                  : undefined
              }
            />
          )}
        </aside>
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
