'use client';

/**
 * <ComponentForm> — LCAPIX editorial redesign (Phase LH).
 *
 * Drives both the "new" and "edit" component pages. The state model, handler
 * shape, validation rules, and store-mutation contract are preserved from the
 * prior Veridian implementation and from the original route handlers. ONLY
 * the visual wrapper has changed — no API routes, store actions, field names,
 * or onSubmit signature have been altered.
 *
 * Visual reference: LCAPIX/pages-misc.jsx → function ComponentFormPage().
 * Uses the design-system CSS at app/lcapix.css (.card, .input, .label,
 * .btn, .chip, .eyebrow, .display-md, .title, .body, .mono, .glass).
 *
 * NOTE: <AuthGuard> and <AppTopBar> are provided by app/project/layout.tsx;
 * this component only renders the Breadcrumb + page body + sticky action bar.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';

import { useProjectStore, type ComponentNode } from '@/lib/store';
import type { ProcessNode } from '@/types/component';
import type { NodeType } from '@/lib/hierarchy';
import {
  getTypeLabel,
  getRequiredParentType,
  buildBreadcrumbPath,
} from '@/lib/hierarchy';

import { Breadcrumb, Icon } from '@/components/lcapix';

import {
  TypeSegmentedControl,
  type ComponentTypeValue,
} from './type-segmented-control';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ComponentFormInitialValues {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  parentId?: string | null;
  driverCategory?: string;
  drivers?: string[];
  mass?: number;
  massUnit?: string;
  operationalCostUSD?: number;
  capitalCostUSD?: number;
  laborCost?: number;
  energyCost?: number;
  transportationCost?: number;
  materialCost?: number;
  equipmentCost?: number;
  overheadCost?: number;
  currency?: string;
}

export interface ComponentFormProps {
  projectId: string;
  caseId: string;
  /** Pre-fill for edit mode or add-child mode. */
  initial?: ComponentFormInitialValues;
  /** Flips copy + primary CTA label + submit path. */
  mode: 'create' | 'edit';
  /** Honoured in create-mode only: locks processType+parentId. */
  suggestedParentId?: string | null;
  suggestedType?: string | null;
  /** Modal variant: skips breadcrumb + outer vertical padding; sticky action bar
   *  sits inside the scrolling parent instead of the viewport. */
  variant?: 'page' | 'modal';
  /** Called on successful submit; if omitted, form navigates back to the case. */
  onSuccess?: () => void;
  /** Called when the user hits Cancel; if omitted, `router.back()` is used. */
  onCancel?: () => void;
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const DRIVER_CATEGORIES = [
  'Energy Consumption',
  'Material Usage',
  'Transportation',
  'Water Usage',
  'Waste Generation',
  'Chemical Process',
  'Manufacturing Process',
];

const DRIVERS_BY_CATEGORY: Record<string, string[]> = {
  'Energy Consumption':    ['Electricity (kWh)', 'Natural Gas (m³)', 'Diesel (L)', 'Coal (kg)', 'Steam (kg)'],
  'Material Usage':        ['Steel (kg)', 'Aluminum (kg)', 'Plastic (kg)', 'Concrete (m³)', 'Wood (m³)'],
  'Transportation':        ['Truck Transport (tkm)', 'Rail Transport (tkm)', 'Sea Transport (tkm)', 'Air Transport (tkm)'],
  'Water Usage':           ['Process Water (L)', 'Cooling Water (L)', 'Steam Generation (L)'],
  'Waste Generation':      ['Solid Waste (kg)', 'Liquid Waste (L)', 'Hazardous Waste (kg)'],
  'Chemical Process':      ['Solvent Usage (L)', 'Catalyst Usage (kg)', 'Chemical Reaction (mol)'],
  'Manufacturing Process': ['Machine Hours (h)', 'Labor Hours (h)', 'Production Rate (units/h)'],
};

/* ------------------------------------------------------------------ */
/* Type mapping — the segmented control uses short form values         */
/* ('machine','elemental'); the DB/API + transformComponentFromDB use  */
/* canonical values ('machine_line','elemental_task'). These two maps   */
/* bridge them so created components are accepted by the API (previously */
/* Machine/Line and Elemental Task always 400'd) and so editing an      */
/* existing component pre-selects the right type.                       */
/* ------------------------------------------------------------------ */
const FORM_TO_DB_TYPE: Record<string, string> = {
  product: 'product',
  machine: 'machine_line',
  subprocess: 'subprocess',
  operation: 'operation',
  elemental: 'elemental_task',
};
const DB_TO_FORM_TYPE: Record<string, string> = {
  product: 'product',
  machine_line: 'machine',
  subprocess: 'subprocess',
  operation: 'operation',
  elemental_task: 'elemental',
};
const toFormType = (t?: string | null): string =>
  t ? (DB_TO_FORM_TYPE[t] ?? t) : '';
const toDbType = (t?: string | null): string =>
  t ? (FORM_TO_DB_TYPE[t] ?? t) : '';

/* ------------------------------------------------------------------ */
/* Main form                                                           */
/* ------------------------------------------------------------------ */

export function ComponentForm({
  projectId, caseId, initial, mode, suggestedParentId, suggestedType,
  variant = 'page', onSuccess, onCancel,
}: ComponentFormProps) {
  const isModal = variant === 'modal';
  const router = useRouter();
  const { toast } = useToast();
  const { projects, addComponentNode, updateComponentNode } = useProjectStore();

  const isEditMode = mode === 'edit';

  const [formData, setFormData] = React.useState({
    processType:        toFormType(initial?.type ?? suggestedType ?? '') as string,
    processName:        initial?.name ?? '',
    processDescription: initial?.description ?? '',
    parentId:           (initial?.parentId ?? suggestedParentId ?? '') as string,
    driverCategory:     initial?.driverCategory ?? '',
    drivers:            initial?.drivers ?? [],
    mass:               initial?.mass ?? 0,
    massUnit:           initial?.massUnit ?? '',
    operationalCostUSD: initial?.operationalCostUSD ?? 0,
    capitalCostUSD:     initial?.capitalCostUSD ?? 0,
    // Advanced ABC costs
    laborCost:          initial?.laborCost ?? 0,
    energyCost:         initial?.energyCost ?? 0,
    transportationCost: initial?.transportationCost ?? 0,
    materialCost:       initial?.materialCost ?? 0,
    equipmentCost:      initial?.equipmentCost ?? 0,
    overheadCost:       initial?.overheadCost ?? 0,
    currency:           initial?.currency ?? 'USD',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [costsOpen, setCostsOpen] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  /* ------- project context ------- */
  const project = projects.find((p) => p.id === projectId);
  const currentCase = project?.cases.find((c) => c.id === caseId);

  // The Zustand store often isn't hydrated with the case's full component list
  // (the editor fetches them into its own local state via the API). Fetch them
  // directly here so the parent dropdown + auto-attach default see every node,
  // not just whatever happens to be in the store.
  const [fetchedNodes, setFetchedNodes] = React.useState<ProcessNode[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiRequest(`/api/cases/${caseId}/components`);
        const d = await r.json();
        if (!cancelled && d?.success && Array.isArray(d.components)) {
          setFetchedNodes(
            d.components.map((c: any) => ({
              id: String(c.component_id),
              name: c.component_name,
              type: c.component_type,
              description: c.description ?? undefined,
              parentId: c.parent_component_id ? String(c.parent_component_id) : undefined,
            })),
          );
        }
      } catch {
        /* fall back to store-derived nodes below */
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  const processNodes: ProcessNode[] = React.useMemo(() => {
    if (fetchedNodes.length) return fetchedNodes;
    const list = currentCase?.components || [];
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description,
      parentId: c.parentId || undefined,
    }));
  }, [fetchedNodes, currentCase?.components]);

  const editingId = isEditMode ? initial?.id : undefined;
  const editingComponent: ComponentNode | undefined = editingId
    ? currentCase?.components.find((c) => c.id === editingId)
    : undefined;
  const hasParent = Boolean(editingComponent?.parentId);
  const isAddChildMode = Boolean(suggestedParentId && suggestedType && !isEditMode);
  const suggestedParent = suggestedParentId
    ? processNodes.find((n) => n.id === suggestedParentId)
    : null;
  const isProcessTypeLocked = isAddChildMode || (isEditMode && hasParent);

  /* ------- eligible parent list -------
   * Any non-product node can be re-parented to ANY other node in the case
   * (full maneuverability), become independent, or stay put. The only hard
   * constraints are: a node can't be its own parent, and can't be parented to
   * one of its own descendants (that would create a cycle). Products are always
   * roots and never show this selector. */
  const descendantIds = React.useMemo(() => {
    const set = new Set<string>();
    if (!editingId) return set;
    const childrenOf = (pid: string) =>
      processNodes.filter((n) => n.parentId === pid);
    const stack = [editingId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const child of childrenOf(cur)) {
        if (!set.has(child.id)) {
          set.add(child.id);
          stack.push(child.id);
        }
      }
    }
    return set;
  }, [editingId, processNodes]);

  const eligibleParents = React.useMemo(() => {
    if (!formData.processType || formData.processType === 'product') return [];
    // Parent must be the tier directly above this node's tier (no level
    // skipping), but it can be ANY node of that tier anywhere in the tree
    // (cross-branch moves) — plus the "Independent" option in the UI. Exclude
    // self + descendants to prevent cycles.
    const requiredForm = getRequiredParentType(
      formData.processType as unknown as NodeType,
    );
    if (!requiredForm) return [];
    return processNodes.filter(
      (n) =>
        n.id !== editingId &&
        !descendantIds.has(n.id) &&
        toFormType(n.type as unknown as string) === (requiredForm as unknown as string),
    );
  }, [formData.processType, processNodes, editingId, descendantIds]);

  /* ------- validation ------- */
  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!formData.processType)        next.processType = 'Select a process type';
    if (!formData.processName.trim()) next.processName = 'Enter a process name';

    const processType = formData.processType as string;
    if (processType !== 'product' && formData.processType) {
      if (formData.parentId) {
        // Cycle / self guard (the dropdown already excludes these, but defend
        // against stale state). Tier matching is no longer enforced — any node
        // may be re-parented anywhere it doesn't create a cycle.
        if (formData.parentId === editingId) {
          next.parentId = 'A component cannot be its own parent.';
        } else if (descendantIds.has(formData.parentId)) {
          next.parentId = 'Cannot move a component under one of its own descendants.';
        }
        const siblings = processNodes.filter(
          (n) => n.parentId === formData.parentId && n.id !== editingId,
        );
        if (
          siblings.some(
            (s) => s.name.toLowerCase() === formData.processName.toLowerCase().trim(),
          )
        ) {
          next.processName = 'A component with this name already exists at this level.';
        }
      } else {
        const roots = processNodes.filter((n) => !n.parentId && n.id !== editingId);
        if (
          roots.some(
            (s) => s.name.toLowerCase() === formData.processName.toLowerCase().trim(),
          )
        ) {
          next.processName = 'A component with this name already exists at the root level.';
        }
      }
    } else if (processType === 'product') {
      const existing = processNodes.filter(
        (n) => n.type === 'product' && !n.parentId && n.id !== editingId,
      );
      if (existing.length > 0) {
        next.processType = 'A Product already exists. Each case can only have one root Product.';
      }
      if (
        processNodes.some(
          (n) =>
            n.type === 'product' &&
            n.name.toLowerCase() === formData.processName.toLowerCase().trim() &&
            n.id !== editingId,
        )
      ) {
        next.processName = 'A Product with this name already exists.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isFormValid = Boolean(formData.processType && formData.processName.trim());

  /* ------- submit ------- */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const payload: Omit<ComponentNode, 'id'> = {
        caseId,
        type: toDbType(formData.processType) as unknown as ComponentNode['type'],
        name: formData.processName.trim(),
        description: formData.processDescription,
        parentId: formData.processType === 'product' ? null : (formData.parentId || null),
        driverCategory: formData.driverCategory || undefined,
        drivers: formData.drivers.length > 0 ? formData.drivers : undefined,
        mass: formData.mass || undefined,
        massUnit: formData.massUnit || undefined,
        operationalCostUSD: formData.operationalCostUSD || undefined,
        capitalCostUSD: formData.capitalCostUSD || undefined,
        laborCost: formData.laborCost || undefined,
        energyCost: formData.energyCost || undefined,
        transportationCost: formData.transportationCost || undefined,
        materialCost: formData.materialCost || undefined,
        equipmentCost: formData.equipmentCost || undefined,
        overheadCost: formData.overheadCost || undefined,
        currency: formData.currency || undefined,
      };

      // Build the DB-shaped payload for the REST endpoint. The API is
      // the source of truth; Zustand is kept in sync for optimistic
      // UI but the server write is what persists.
      const dbBody = {
        component_name: payload.name,
        // Map the form's short type ('machine'/'elemental') to the canonical
        // value the API validates against ('machine_line'/'elemental_task').
        // Without this, Machine/Line and Elemental Task creates returned 400.
        component_type: toDbType(payload.type as unknown as string),
        parent_component_id: payload.parentId ? Number(payload.parentId) : null,
        description: payload.description || null,
        driver_category: payload.driverCategory || null,
        drivers: payload.drivers && payload.drivers.length > 0 ? payload.drivers : null,
        quantity: payload.mass ?? 1,
        unit: payload.massUnit || 'unit',
        opex: payload.operationalCostUSD ?? null,
        capex: payload.capitalCostUSD ?? null,
        labor_cost: payload.laborCost ?? null,
        energy_cost: payload.energyCost ?? null,
        material_cost: payload.materialCost ?? null,
        transportation_cost: payload.transportationCost ?? null,
        equipment_cost: payload.equipmentCost ?? null,
        overhead_cost: payload.overheadCost ?? null,
        currency: payload.currency || 'USD',
      };

      if (isEditMode && editingId) {
        const res = await apiRequest(`/api/components/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(dbBody),
        });
        if (!res.ok) throw new Error(`PUT /api/components/${editingId} → ${res.status}`);
        updateComponentNode(editingId, payload);
        toast({
          title: 'Component updated',
          description: `${formData.processName} saved to database`,
        });
      } else {
        const res = await apiRequest(`/api/cases/${caseId}/components`, {
          method: 'POST',
          body: JSON.stringify(dbBody),
        });
        if (!res.ok) throw new Error(`POST /api/cases/${caseId}/components → ${res.status}`);
        const data = await res.json().catch(() => ({}));
        const newDbId = data?.component?.component_id ?? data?.component_id;
        // Keep Zustand in sync for optimistic UI; use server id when available
        addComponentNode(caseId, { ...payload, id: newDbId ? String(newDbId) : undefined } as any);
        toast({
          title: 'Component created',
          description: `${formData.processName} saved to database`,
        });
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/project/${projectId}/case/${caseId}`);
      }
    } catch (err: any) {
      console.error('Component save failed:', err);
      toast({
        title: 'Save failed',
        description: err?.message || `Could not ${isEditMode ? 'update' : 'create'} component. Check console.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableDrivers = formData.driverCategory
    ? DRIVERS_BY_CATEGORY[formData.driverCategory] || []
    : [];

  const handleTypeChange = (v: ComponentTypeValue) => {
    // Auto-attach by default: when a non-product type is chosen, pre-select the
    // most recently created node of the tier directly above as the parent, so
    // the new component joins the tree instead of floating off on its own. The
    // user can still switch to "Independent" or a different parent. Product is
    // always a root, so it gets no parent.
    let defaultParent = '';
    if (v !== 'product') {
      const requiredForm = getRequiredParentType(v as unknown as NodeType);
      if (requiredForm) {
        const candidates = processNodes.filter(
          (n) =>
            n.id !== editingId &&
            !descendantIds.has(n.id) &&
            toFormType(n.type as unknown as string) === (requiredForm as unknown as string),
        );
        if (candidates.length) defaultParent = candidates[candidates.length - 1].id;
      }
    }
    setFormData((prev) => ({ ...prev, processType: v, parentId: defaultParent }));
    if (errors.processType) setErrors((prev) => ({ ...prev, processType: '' }));
  };

  // Default-fill the parent once the component list finishes loading, in case
  // the user picked a type before the fetch returned (handleTypeChange would
  // have found no candidates yet). Never overrides a parent the user touched.
  const parentTouchedRef = React.useRef(false);
  React.useEffect(() => {
    if (isEditMode || isAddChildMode || parentTouchedRef.current) return;
    const ptype = formData.processType;
    if (!ptype || ptype === 'product' || formData.parentId) return;
    const requiredForm = getRequiredParentType(ptype as unknown as NodeType);
    if (!requiredForm) return;
    const candidates = processNodes.filter(
      (n) =>
        n.id !== editingId &&
        !descendantIds.has(n.id) &&
        toFormType(n.type as unknown as string) === (requiredForm as unknown as string),
    );
    // Auto-pick ONLY when the choice is unambiguous. Grabbing the last
    // eligible node put brand-new parts under whatever operation happened to
    // be created most recently — e.g. "Landfilling" instead of the node the
    // user was looking at (tool-review bug #4). With several candidates the
    // picker stays empty so the placement is a conscious choice.
    if (candidates.length === 1) {
      setFormData((prev) => ({ ...prev, parentId: candidates[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processNodes, formData.processType]);

  const showDriversSection = formData.processType === 'elemental';

  /* ------- breadcrumb items ------- */
  const breadcrumbItems = [
    { label: 'Projects', page: 'home' },
    {
      label: project?.name || 'Project',
      onClick: () => router.push(`/project/${projectId}`),
    },
    {
      label: currentCase?.name || 'Case',
      onClick: () => router.push(`/project/${projectId}/case/${caseId}`),
    },
    { label: isEditMode ? 'Edit Component' : 'New Component' },
  ];

  /* ------- render ------- */
  return (
    <>
      {!isModal && <Breadcrumb items={breadcrumbItems} />}

      <div
        style={
          isModal
            ? { padding: '24px 28px 96px' }
            : { maxWidth: 720, margin: '0 auto', padding: '32px 24px 120px' }
        }
      >
        <h1
          className="display-md"
          style={{ margin: 0, marginBottom: 8, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          {isEditMode ? 'Edit Component' : 'New Component'}
        </h1>
        <p className="body" style={{ margin: 0, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
          {isEditMode
            ? `Update this node in the process hierarchy for ${currentCase?.name ?? 'this case'}.`
            : `Add a new node to the process hierarchy for ${currentCase?.name ?? 'this case'}.`}
        </p>

        {isAddChildMode && suggestedParent && (
          <div
            className="chip chip-active"
            style={{ marginBottom: 16, padding: '8px 14px', fontSize: 12 }}
          >
            <Icon name="chevron-right" size={12} />
            Adding child to: {buildBreadcrumbPath(suggestedParent, processNodes)} / {suggestedParent.name}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ---------------- Section 1: Type & Placement ---------------- */}
          <section className="card-section" style={{ padding: 24 }}>
            <div className="title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Type &amp; Placement <span style={{ color: 'var(--signal-error)' }}>*</span>
            </div>
            <div className="body-sm" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Where does this component fit in the process tree?
            </div>

            <div style={{ marginBottom: 16 }}>
              <TypeSegmentedControl
                value={formData.processType as ComponentTypeValue | ''}
                onChange={handleTypeChange}
                disabled={isProcessTypeLocked}
                // A case can only have one root Product: grey the option out
                // ahead of time instead of erroring after the click
                // (tool-review suggestion #2).
                disabledTypes={
                  mode === 'create' &&
                  processNodes.some(
                    (n) => toFormType(n.type as unknown as string) === 'product',
                  )
                    ? ['product']
                    : undefined
                }
              />
              {errors.processType && (
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--signal-error)' }}>
                  {errors.processType}
                </p>
              )}
              {isProcessTypeLocked && (
                <p
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Locked — {isAddChildMode ? 'add-child mode' : 'component has a parent'}
                </p>
              )}
            </div>

            {formData.processType && formData.processType !== 'product' && (
              <div>
                <label className="label">Parent component</label>
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.45,
                  }}
                >
                  Attaches to a valid parent one level up by default. Pick a
                  different one, or make it independent.
                </p>
                <div style={{ position: 'relative' }}>
                  <select
                    className="input"
                    style={{ appearance: 'none', paddingRight: 32 }}
                    value={formData.parentId || 'none'}
                    disabled={isAddChildMode}
                    onChange={(e) => {
                      const value = e.target.value;
                      parentTouchedRef.current = true;
                      setFormData((p) => ({ ...p, parentId: value === 'none' ? '' : value }));
                      if (errors.parentId) setErrors((p) => ({ ...p, parentId: '' }));
                    }}
                  >
                    <option value="none">Independent — no parent (top-level)</option>
                    {eligibleParents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} ({getTypeLabel(toFormType(parent.type as unknown as string) as unknown as NodeType)})
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevron-down"
                    size={14}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-tertiary)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                {errors.parentId && (
                  <p style={{ marginTop: 6, fontSize: 12, color: 'var(--signal-error)' }}>
                    {errors.parentId}
                  </p>
                )}
                {!formData.parentId && !errors.parentId && (
                  <p
                    className="mono"
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Floating — can be re-parented later
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ---------------- Section 2: Identity ---------------- */}
          <section className="card-section" style={{ padding: 24 }}>
            <div className="title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              Identity
            </div>

            <label className="label">
              Name <span style={{ color: 'var(--signal-error)' }}>*</span>
            </label>
            <input
              className="input"
              type="text"
              value={formData.processName}
              maxLength={100}
              placeholder="e.g. Cathode Coating"
              onChange={(e) => {
                setFormData((p) => ({ ...p, processName: e.target.value }));
                if (errors.processName) setErrors((p) => ({ ...p, processName: '' }));
              }}
              style={{ marginBottom: 4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              {errors.processName ? (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--signal-error)' }}>
                  {errors.processName}
                </p>
              ) : <span />}
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--text-tertiary)',
                }}
              >
                {formData.processName.length} / 100
              </span>
            </div>

            <label className="label">Description</label>
            <textarea
              className="input"
              value={formData.processDescription}
              rows={3}
              placeholder="Process steps, materials, assumptions…"
              onChange={(e) =>
                setFormData((p) => ({ ...p, processDescription: e.target.value }))
              }
              style={{ height: 72, padding: 10, marginBottom: 12, resize: 'vertical' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Quantity</label>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.mass || ''}
                  placeholder="0"
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      mass: e.target.value === '' ? 0 : parseFloat(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Unit</label>
                <input
                  className="input mono"
                  type="text"
                  value={formData.massUnit}
                  placeholder="kg"
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, massUnit: e.target.value }))
                  }
                />
              </div>
            </div>
          </section>

          {/* ---------------- Section 3: Drivers (elemental only) ---------------- */}
          {showDriversSection && (
            <section className="card-section" style={{ padding: 24 }}>
              <div className="title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                Structural Drivers
              </div>

              <label className="label">Driver category</label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <select
                  className="input"
                  style={{ appearance: 'none', paddingRight: 32 }}
                  value={formData.driverCategory}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, driverCategory: e.target.value, drivers: [] }))
                  }
                >
                  <option value="">Select a driver category</option>
                  {DRIVER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <Icon
                  name="chevron-down"
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {formData.driverCategory && (
                <>
                  <label className="label">Drivers</label>
                  <div
                    style={{
                      background: 'var(--surface-overlay)',
                      borderRadius: 6,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {availableDrivers.map((driver) => {
                      const checked = formData.drivers.includes(driver);
                      return (
                        <label
                          key={driver}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 4px',
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          <span>{driver}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData((p) => ({ ...p, drivers: [...p.drivers, driver] }));
                              } else {
                                setFormData((p) => ({
                                  ...p,
                                  drivers: p.drivers.filter((d) => d !== driver),
                                }));
                              }
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                  {formData.drivers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {formData.drivers.map((d) => (
                        <span key={d} className="chip" style={{ fontSize: 11 }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ---------------- Section 4: Costs (collapsed) ---------------- */}
          <section className="card-section" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setCostsOpen((v) => !v)}
              style={{
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <Icon
                name={costsOpen ? 'chevron-down' : 'chevron-right'}
                size={14}
                style={{ color: 'var(--text-tertiary)' }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Costs</span>
              <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                {formData.currency || 'USD'} {formatCostSummary(formData)} estimated
              </span>
            </button>

            {costsOpen && (
              <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <IntegrationSuggestPanel
                  componentType={formData.processType}
                  quantity={formData.mass ?? 1}
                  region="US"
                  onApply={(suggestion) =>
                    setFormData((p) => ({
                      ...p,
                      laborCost: suggestion.labor ?? p.laborCost,
                      energyCost: suggestion.energy ?? p.energyCost,
                      materialCost: suggestion.material ?? p.materialCost,
                    }))
                  }
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <CostField
                    label="Operational cost"
                    value={formData.operationalCostUSD}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, operationalCostUSD: v }))}
                  />
                  <CostField
                    label="Capital cost"
                    value={formData.capitalCostUSD}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, capitalCostUSD: v }))}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <CostField
                    label="Labor"
                    value={formData.laborCost}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, laborCost: v }))}
                  />
                  <CostField
                    label="Energy"
                    value={formData.energyCost}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, energyCost: v }))}
                  />
                  <CostField
                    label="Material"
                    value={formData.materialCost}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, materialCost: v }))}
                  />
                  <CostField
                    label="Transportation"
                    value={formData.transportationCost}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, transportationCost: v }))}
                  />
                  <CostField
                    label="Equipment"
                    value={formData.equipmentCost}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, equipmentCost: v }))}
                  />
                  <CostField
                    label="Overhead"
                    value={formData.overheadCost}
                    currency={formData.currency}
                    onChange={(v) => setFormData((p) => ({ ...p, overheadCost: v }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Currency (ISO 4217)</label>
                    <input
                      className="input mono"
                      type="text"
                      value={formData.currency}
                      maxLength={3}
                      placeholder="USD"
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ---------------- Section 5: Advanced (collapsed) ---------------- */}
          <section className="card-section" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              style={{
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <Icon
                name={advancedOpen ? 'chevron-down' : 'chevron-right'}
                size={14}
                style={{ color: 'var(--text-tertiary)' }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Advanced</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                Drivers JSON · metadata
              </span>
            </button>

            {advancedOpen && (
              <div style={{ padding: '0 24px 24px' }}>
                <label className="label">Drivers (JSON array)</label>
                <textarea
                  className="input mono"
                  rows={4}
                  value={JSON.stringify(formData.drivers ?? [], null, 2)}
                  placeholder='["Electricity (kWh)"]'
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (Array.isArray(parsed)) {
                        setFormData((p) => ({ ...p, drivers: parsed }));
                      }
                    } catch {
                      /* ignore partial input */
                    }
                  }}
                  style={{ height: 120, padding: 10, resize: 'vertical' }}
                />
                <p
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Advanced metadata — parsed as JSON on blur-valid input
                </p>
              </div>
            )}
          </section>
        </form>
      </div>

      {/* Sticky action bar */}
      <div
        className="glass"
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: isModal ? '0 20px' : '0 32px',
          zIndex: 40,
          borderRadius: 0,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            maxWidth: isModal ? '100%' : 720,
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => (onCancel ? onCancel() : router.back())}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-tertiary btn-sm"
            onClick={() => handleSubmit()}
            disabled={!isFormValid || isSubmitting}
          >
            Save as draft
          </button>
          <div style={{ flex: 1 }} />
          {!isFormValid && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
                marginRight: 8,
              }}
            >
              Name + type required
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleSubmit()}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting
              ? isEditMode ? 'Saving…' : 'Creating…'
              : isEditMode ? 'Save changes' : 'Create component'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cost sub-field                                                      */
/* ------------------------------------------------------------------ */

function CostField({
  label, value, currency, onChange,
}: {
  label: string;
  value: number;
  currency: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div style={{ position: 'relative' }}>
        <span
          className="mono"
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        >
          {currency || 'USD'}
        </span>
        <input
          className="input mono"
          type="number"
          min="0"
          step="0.01"
          value={value || ''}
          placeholder="0.00"
          onChange={(e) =>
            onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))
          }
          style={{ paddingLeft: 46 }}
        />
      </div>
    </div>
  );
}

function formatCostSummary(f: {
  operationalCostUSD: number;
  capitalCostUSD: number;
  laborCost: number;
  energyCost: number;
  materialCost: number;
  transportationCost: number;
  equipmentCost: number;
  overheadCost: number;
}) {
  const total =
    (f.operationalCostUSD || 0) +
    (f.capitalCostUSD || 0) +
    (f.laborCost || 0) +
    (f.energyCost || 0) +
    (f.materialCost || 0) +
    (f.transportationCost || 0) +
    (f.equipmentCost || 0) +
    (f.overheadCost || 0);
  return total.toFixed(2);
}

export default ComponentForm;

// ─────────────────────────────────────────────────────────────────────────────
// Integration-suggest panel — pulls live defaults from BLS / EIA / Metals-API
// into the cost fields. Without this the editor would be 100% manual and
// the Integrations page would be a graveyard of unused pipelines.
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestPayload {
  labor?: number;
  energy?: number;
  material?: number;
}

function IntegrationSuggestPanel({
  componentType,
  quantity,
  region,
  onApply,
}: {
  componentType: string;
  quantity: number;
  region: string;
  onApply: (s: SuggestPayload) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    sources: string[];
    payload: SuggestPayload;
  } | null>(null);

  // Heuristic: pick what to ask integrations for based on the node type.
  const wants = React.useMemo(() => {
    const t = (componentType || '').toLowerCase();
    return {
      labor: /machine|subprocess|operation/.test(t),
      energy: /operation|elemental/.test(t),
      material: /elemental|subprocess/.test(t),
    };
  }, [componentType]);

  async function suggest() {
    setLoading(true);
    setError(null);
    setResult(null);
    const sources: string[] = [];
    const payload: SuggestPayload = {};
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token')
        : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    const q = Math.max(1, Number(quantity) || 1);
    try {
      if (wants.labor) {
        // BLS OEWS 51-4121 = Welders / 51-4041 = Machinists. Default to welders.
        const r = await fetch('/api/integrations/bls/fetch-wage', {
          method: 'POST',
          headers,
          body: JSON.stringify({ occupation: '51-4121', state: region }),
        });
        if (r.ok) {
          const d = await r.json();
          const hourly = Number(d?.rate?.rateValue ?? d?.hourlyRate ?? 0);
          if (hourly > 0) {
            // Assume 0.5h labor per unit.
            payload.labor = Math.round(hourly * 0.5 * q * 100) / 100;
            sources.push(`BLS $${hourly.toFixed(2)}/hr × 0.5h × ${q}`);
          }
        }
      }
      if (wants.energy) {
        // EIA route's zod schema requires `state` (2-letter code), not `region`.
        const r = await fetch('/api/integrations/eia/fetch-energy-price', {
          method: 'POST',
          headers,
          body: JSON.stringify({ fuel: 'electricity', state: region }),
        });
        if (r.ok) {
          const d = await r.json();
          const perKwh = Number(d?.rate?.rateValue ?? d?.pricePerKwh ?? 0);
          if (perKwh > 0) {
            // Assume 2 kWh per unit (typical operation).
            payload.energy = Math.round(perKwh * 2 * q * 100) / 100;
            sources.push(`EIA $${perKwh.toFixed(3)}/kWh × 2 kWh × ${q}`);
          }
        }
      }
      if (wants.material) {
        // Metals-API uses 3-letter ISO-style codes (ALU, XCU, STL, etc.) — map
        // common material names to those codes.
        const METALS_SYMBOL: Record<string, string> = {
          steel: 'STL', aluminum: 'ALU', copper: 'XCU',
          zinc: 'ZNC', nickel: 'NIK', lead: 'LEA', tin: 'TIN',
        };
        const r = await fetch('/api/integrations/metals/fetch-price', {
          method: 'POST',
          headers,
          body: JSON.stringify({ symbol: METALS_SYMBOL.steel }),
        });
        if (r.ok) {
          const d = await r.json();
          const perKg = Number(d?.rate?.rateValue ?? d?.pricePerKg ?? 0);
          if (perKg > 0) {
            payload.material = Math.round(perKg * q * 100) / 100;
            sources.push(`Metals-API $${perKg.toFixed(2)}/kg × ${q}`);
          }
        }
      }

      // If all three returned nothing (offline / no API keys), surface a
      // sensible offline fallback so the UX still demonstrates the feature.
      if (
        payload.labor == null &&
        payload.energy == null &&
        payload.material == null
      ) {
        if (wants.labor) {
          payload.labor = Math.round(24 * 0.5 * q * 100) / 100;
          sources.push(`BLS fallback $24.00/hr × 0.5h × ${q}`);
        }
        if (wants.energy) {
          payload.energy = Math.round(0.13 * 2 * q * 100) / 100;
          sources.push(`EIA fallback $0.130/kWh × 2 kWh × ${q}`);
        }
        if (wants.material) {
          payload.material = Math.round(0.95 * q * 100) / 100;
          sources.push(`Metals-API fallback $0.95/kg × ${q}`);
        }
      }

      setResult({ sources, payload });
    } catch (e: any) {
      setError(e?.message ?? 'Suggest failed');
    } finally {
      setLoading(false);
    }
  }

  const hasAnything = wants.labor || wants.energy || wants.material;
  if (!hasAnything) return null;

  return (
    <div
      style={{
        padding: 14,
        background:
          'color-mix(in oklab, var(--brand-primary) 5%, var(--surface-raised))',
        border:
          '1px solid color-mix(in oklab, var(--brand-primary) 18%, var(--border-subtle))',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background:
              'color-mix(in oklab, var(--brand-primary) 20%, transparent)',
            color: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ✦
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Suggest from integrations
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-tertiary)',
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            Pulls live defaults from
            {wants.labor && ' BLS labor wages,'}
            {wants.energy && ' EIA energy prices,'}
            {wants.material && ' Metals-API spot prices,'}
            {' '}for region <code className="mono">{region}</code>.
          </div>
        </div>
        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          {loading ? 'Fetching…' : result ? 'Refetch' : 'Fetch defaults'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--signal-error)' }}>
          {error}
        </div>
      )}
      {result && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '10px 12px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: 12.5,
            }}
          >
            {result.payload.labor != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>Labor</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.labor.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.energy != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>Energy</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.energy.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.material != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>Material</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.material.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
            }}
          >
            {result.sources.join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onApply(result.payload)}
            >
              Apply to fields
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setResult(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
