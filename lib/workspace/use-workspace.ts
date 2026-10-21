'use client'

/**
 * The case workspace's data, shared by its four tabs (plan §3: one layout,
 * four tabs, one data cache): the case, its steps, the live inventory (every
 * flow's status and climate arithmetic, from GET /api/cases/[id]/inventory),
 * and the project's cases for the Case switcher. Any edit announces
 * lcapix:components-changed and the steps and inventory reload.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { isProjectRole, projectCapabilities, type ProjectRole } from '@/lib/project-role'
import type { InventoryRow } from './inventory'
import { splitSource } from './step-text'
import { layoutOnLanes, tierOf, type TierLayout } from './tier-layout'

export interface WorkspaceCase {
  case_id: number
  project_id: number
  case_name: string
  case_type: 'base' | 'comparative'
  description: string | null
  read_only: boolean
  my_role: ProjectRole | null
  /** The caller's role in the project (my_role is the role on this case: "Can read" on a read-only case). */
  project_role: ProjectRole | null
  copied_from: { case_id: number; case_name: string } | null
  region_code: string | null
  project_lcia_method: string | null
  reference_flow: number | null
  reference_flow_unit: string | null
  interpretation: string | null
  assumptions: string | null
  is_final: boolean
  finalized_at: string | null
  project_functional_unit: string | null
  /** The exercises' answers and the prediction (case_table.learning_state). */
  learning_state: unknown
  updated_at: string | null
}

export interface WorkspaceStep {
  id: number
  parentId: number | null
  name: string
  type: string
  tier: ReturnType<typeof tierOf>
  level: number
  quantity: number | null
  unit: string | null
  description: string | null
  /** Where an imported step came from ("routing.csv · row 4"); null for a step made by hand. */
  source: string | null
  costs: Record<'labor' | 'energy' | 'material' | 'transportation' | 'equipment' | 'overhead', number | null>
  /** Labour hours per unit on the step (from a routing, or a rate used before). */
  laborHours: number | null
  updated_at: string | null
}

export interface WorkspaceInventory {
  method: string
  region: string
  rows: InventoryRow[]
  counts: { all: number; counted: number; no_factor: number; needs_amount: number; left_out: number }
  climate: { value: number; unit: string } | null
  steps: Array<{ component_id: number; climate: number }>
  latest_run: { run_id: number; method: string; region: string; run_date: string; changed_flows: number | null } | null
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

export function toStep(c: any): WorkspaceStep {
  return {
    id: Number(c.component_id),
    parentId: c.parent_component_id == null ? null : Number(c.parent_component_id),
    name: String(c.component_name ?? ''),
    type: String(c.component_type ?? ''),
    tier: tierOf({ type: c.component_type, level: c.hierarchy_level }),
    level: Number(c.hierarchy_level ?? 1),
    quantity: num(c.quantity),
    unit: c.unit ?? null,
    description: splitSource(c.description).text,
    source: splitSource(c.description).source,
    costs: {
      labor: num(c.labor_cost),
      energy: num(c.energy_cost),
      material: num(c.material_cost),
      transportation: num(c.transportation_cost),
      equipment: num(c.equipment_cost),
      overhead: num(c.overhead_cost),
    },
    laborHours: num(c.labor_hours),
    updated_at: c.updated_at ?? null,
  }
}

/** Steps in sibling order: by id, which is creation order (the order the tree was built). */
export function orderSteps(steps: WorkspaceStep[]): WorkspaceStep[] {
  return [...steps].sort((a, b) => a.id - b.id)
}

export function useCaseWorkspace(caseId: number) {
  const [kase, setKase] = useState<WorkspaceCase | null>(null)
  const [steps, setSteps] = useState<WorkspaceStep[]>([])
  const [inventory, setInventory] = useState<WorkspaceInventory | null>(null)
  const [siblings, setSiblings] = useState<Array<{ case_id: number; case_name: string; case_type: string; created_by: number | null; run_count: number }>>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    const mine = ++seq.current
    try {
      const [c, comps, inv] = await Promise.all([
        apiRequest(`/api/cases/${caseId}`),
        apiRequest(`/api/cases/${caseId}/components`),
        apiRequest(`/api/cases/${caseId}/inventory`),
      ])
      if (mine !== seq.current) return
      if (c.status === 404) {
        setStatus('notfound')
        return
      }
      if (!c.ok || !comps.ok || !inv.ok) throw new Error(`case ${c.status}, steps ${comps.status}, inventory ${inv.status}`)
      const cj = (await c.json()).case
      const list = ((await comps.json()).components ?? []).map(toStep)
      const ij = await inv.json()
      if (mine !== seq.current) return
      setKase({
        case_id: Number(cj.case_id),
        project_id: Number(cj.project_id),
        case_name: cj.case_name,
        case_type: cj.case_type === 'comparative' ? 'comparative' : 'base',
        description: cj.description ?? null,
        read_only: !!cj.read_only,
        my_role: isProjectRole(cj.my_role) ? cj.my_role : null,
        project_role: isProjectRole(cj.project_role) ? cj.project_role : null,
        copied_from: cj.copied_from ?? null,
        region_code: cj.region_code ?? null,
        project_lcia_method: cj.project_lcia_method ?? null,
        reference_flow: num(cj.reference_flow),
        reference_flow_unit: cj.reference_flow_unit ?? null,
        interpretation: cj.interpretation ?? null,
        assumptions: cj.assumptions ?? null,
        is_final: !!cj.is_final,
        finalized_at: cj.finalized_at ?? null,
        project_functional_unit: cj.project_functional_unit ?? null,
        learning_state: cj.learning_state ?? null,
        updated_at: cj.updated_at ?? null,
      })
      setSteps(orderSteps(list))
      setInventory(ij as WorkspaceInventory)
      setStatus('ready')
      setError(null)
      // The Case switcher's list (the project's cases the caller reaches).
      apiRequest(`/api/projects/${cj.project_id}/cases`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (mine === seq.current && d?.cases) {
            setSiblings(
              d.cases.map((x: any) => ({
                case_id: Number(x.case_id),
                case_name: x.case_name,
                case_type: x.case_type,
                created_by: x.created_by == null ? null : Number(x.created_by),
                run_count: Number(x.run_count ?? 0),
              })),
            )
          }
        })
        .catch(() => {})
    } catch (e: any) {
      if (mine !== seq.current) return
      setError(e?.message ?? 'the request failed')
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'))
    }
  }, [caseId])

  useEffect(() => {
    load()
    const onChange = () => load()
    window.addEventListener('lcapix:components-changed', onChange)
    window.addEventListener('lcapix:flows-changed', onChange)
    return () => {
      window.removeEventListener('lcapix:components-changed', onChange)
      window.removeEventListener('lcapix:flows-changed', onChange)
    }
  }, [load])

  const layout: TierLayout = useMemo(
    () => layoutOnLanes(steps.map((s) => ({ id: s.id, parentId: s.parentId, type: s.type, level: s.level }))),
    [steps],
  )
  const caps = projectCapabilities(kase?.my_role ?? null)
  const readOnly = !!kase && (kase.read_only || caps.readOnly)

  return { kase, steps, inventory, siblings, layout, status, error, reload: load, readOnly, caps }
}
