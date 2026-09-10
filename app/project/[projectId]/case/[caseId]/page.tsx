'use client'

// Case Editor — LCAPIX 3-pane IDE layout.
// Phase LF.3: UI layer ported from LCAPIX/pages-app.jsx (CaseEditorPage).
// Business logic (fetch / save / delete / create / run-assessment) is
// preserved from the prior implementation.

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  const projectId = params.projectId as string
  const caseId = params.caseId as string

  const { updateComponentNode, deleteComponentNode } = useProjectStore()

  // ---------- Fetch state (preserved) ----------
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [components, setComponents] = useState<ComponentNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Bumped when the component-create/edit modal reports a change, forcing the
  // fetch effect below to re-run so new nodes appear without a full reload.
  const [refreshKey, setRefreshKey] = useState(0)
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

  // ---------- UI state ----------
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [canvasView, setCanvasView] = useState<CanvasView>('Tree')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarQuery, setSidebarQuery] = useState('')

  // ---------- Edit / create state (preserved) ----------
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editFormData, setEditFormData] = useState<EditFormData>({})

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

  // ---------- Auto-select first root (preserved) ----------
  useEffect(() => {
    if (components.length > 0 && !selectedNode) {
      const firstRoot = components.find((c) => !c.parentId) ?? components[0]
      if (firstRoot) {
        setSelectedNode(firstRoot.id)
        loadFormFor(firstRoot)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.length])

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

  // Candidate re-parent targets for the inspector. A node may be moved under
  // any node of the tier DIRECTLY ABOVE its own (no level skipping — e.g. an
  // Operation can only sit under a Subprocess, never directly under a Product),
  // across any branch of the tree, or made independent. Self + descendants are
  // excluded to prevent cycles.
  const parentOptions = useMemo(() => {
    if (!selectedComponent) return []
    // DB type -> required parent DB type (one tier up).
    const REQUIRED_PARENT_DB: Record<string, string | null> = {
      product: null,
      machine_line: 'product',
      subprocess: 'machine_line',
      operation: 'subprocess',
      elemental_task: 'operation',
    }
    const requiredParentDb = REQUIRED_PARENT_DB[selectedComponent.type as string]
    if (!requiredParentDb) return []

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
          (c.type as string) === requiredParentDb,
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
      energyCost: (c as any).energyCost ?? undefined,
      transportationCost: (c as any).transportationCost ?? undefined,
      materialCost: (c as any).materialCost ?? undefined,
      equipmentCost: (c as any).equipmentCost ?? undefined,
      overheadCost: (c as any).overheadCost ?? undefined,
      currency: (c as any).currency || 'USD',
      costAllocationType: (c as any).costAllocationType ?? undefined,
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
    setIsRunning(true)
    try {
      // Honor the same per-case method/region memory the run modal writes —
      // a quick-run that silently switched a US case back to Global made the
      // latest run non-comparable with its own history (live-caught: run 119).
      let remembered: { method?: string; region?: string } = {}
      try {
        remembered = JSON.parse(localStorage.getItem(`lcapix-run-prefs:${caseId}`) || '{}')
      } catch { /* corrupt prefs are ignorable */ }
      const calcMethod = remembered.method || 'CML 2001'
      const regionCode = remembered.region || 'Global'
      const res = await apiRequest(`/api/cases/${caseId}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          run_name: 'Assessment',
          calculation_method: calcMethod,
          region_code: regionCode,
        }),
      })
      try {
        localStorage.setItem(
          `lcapix-run-prefs:${caseId}`,
          JSON.stringify({ method: calcMethod, region: regionCode }),
        )
      } catch { /* storage may be unavailable; prefs are a convenience */ }
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
          opex: fd.operationalCostUSD || null,
          capex: fd.capitalCostUSD || null,
          labor_cost: fd.laborCost || null,
          energy_cost: fd.energyCost || null,
          transportation_cost: fd.transportationCost || null,
          material_cost: fd.materialCost || null,
          equipment_cost: fd.equipmentCost || null,
          overhead_cost: fd.overheadCost || null,
          currency: fd.currency || 'USD',
          cost_allocation_type: fd.costAllocationType || 'manual',
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
          setComponents(componentsData.components.map(transformComponentFromDB))
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
          opex: fd.operationalCostUSD || null,
          capex: fd.capitalCostUSD || null,
          labor_cost: fd.laborCost || null,
          energy_cost: fd.energyCost || null,
          transportation_cost: fd.transportationCost || null,
          material_cost: fd.materialCost || null,
          equipment_cost: fd.equipmentCost || null,
          overhead_cost: fd.overheadCost || null,
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
            setSelectedNode(String(result.component.component_id))
          }
        }
        toast.success('Component created successfully')
      }

      setIsEditing(false)
      setIsCreating(false)
      setEditFormData({})
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
          title="Deep-copy this case (tree, flows, costs) as a comparative what-if"
          onClick={async () => {
            try {
              const r = await fetch(`/api/cases/${caseId}/duplicate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(localStorage.getItem('auth_token')
                    ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                    : {}),
                },
                body: JSON.stringify({}),
              })
              const j = await r.json().catch(() => null)
              if (r.ok && j?.case_id) {
                toast.success(
                  `Duplicated as "${j.case_name}" — ${j.components_copied} components, ${j.flows_copied} flows`,
                )
                router.push(`/project/${projectId}/case/${j.case_id}`)
              } else {
                toast.error(j?.error || 'Could not duplicate case')
              }
            } catch {
              toast.error('Could not duplicate case')
            }
          }}
        >
          <Icon name="layers" size={14} /> Duplicate
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleRunAssessment}
          disabled={isRunning}
        >
          <Icon name="run" size={14} /> {isRunning ? 'Running…' : 'Run Assessment'}
        </button>
      </div>

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
