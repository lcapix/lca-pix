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

import { useProjectStore, type ComponentNode } from '@/lib/store';
import type { ProcessNode } from '@/types/component';
import type { NodeType } from '@/lib/hierarchy';
import {
  getTypeLabel,
  getRequiredParentType,
  validateParentChild,
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
/* Main form                                                           */
/* ------------------------------------------------------------------ */

export function ComponentForm({
  projectId, caseId, initial, mode, suggestedParentId, suggestedType,
}: ComponentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { projects, addComponentNode, updateComponentNode } = useProjectStore();

  const isEditMode = mode === 'edit';

  const [formData, setFormData] = React.useState({
    processType:        (initial?.type ?? suggestedType ?? '') as string,
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

  const processNodes: ProcessNode[] = React.useMemo(() => {
    const list = currentCase?.components || [];
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description,
      parentId: c.parentId || undefined,
    }));
  }, [currentCase?.components]);

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

  /* ------- eligible parent list ------- */
  const eligibleParents = React.useMemo(() => {
    if (!formData.processType) return [];
    const required = getRequiredParentType(formData.processType as unknown as NodeType);
    if (!required) return [];
    return processNodes.filter((n) => (n.type as unknown as string) === (required as unknown as string));
  }, [formData.processType, processNodes]);

  /* ------- validation ------- */
  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!formData.processType)        next.processType = 'Select a process type';
    if (!formData.processName.trim()) next.processName = 'Enter a process name';

    const processType = formData.processType as string;
    if (processType !== 'product' && formData.processType) {
      if (formData.parentId) {
        const parent = processNodes.find((n) => n.id === formData.parentId);
        if (parent && !validateParentChild(parent.type as unknown as NodeType, processType as unknown as NodeType)) {
          const required = getRequiredParentType(processType as unknown as NodeType);
          next.parentId = `Select a ${getTypeLabel(required!)} as the parent.`;
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
        type: formData.processType as unknown as ComponentNode['type'],
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

      if (isEditMode && editingId) {
        updateComponentNode(editingId, payload);
        toast({
          title: 'Component Updated',
          description: `${formData.processName} has been updated successfully`,
        });
      } else {
        addComponentNode(caseId, payload);
        toast({
          title: 'Component Created',
          description: `${formData.processName} has been added to your case`,
        });
      }
      router.push(`/project/${projectId}/case/${caseId}`);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: `Failed to ${isEditMode ? 'update' : 'create'} component. Please try again.`,
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
    setFormData((prev) => ({ ...prev, processType: v, parentId: '' }));
    if (errors.processType) setErrors((prev) => ({ ...prev, processType: '' }));
  };

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
      <Breadcrumb items={breadcrumbItems} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 120px' }}>
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
              Type &amp; Placement
            </div>
            <div className="body-sm" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Where does this component fit in the process tree?
            </div>

            <div style={{ marginBottom: 16 }}>
              <TypeSegmentedControl
                value={formData.processType as ComponentTypeValue | ''}
                onChange={handleTypeChange}
                disabled={isProcessTypeLocked}
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
                <div style={{ position: 'relative' }}>
                  <select
                    className="input"
                    style={{ appearance: 'none', paddingRight: 32 }}
                    value={formData.parentId || 'none'}
                    disabled={isAddChildMode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((p) => ({ ...p, parentId: value === 'none' ? '' : value }));
                      if (errors.parentId) setErrors((p) => ({ ...p, parentId: '' }));
                    }}
                  >
                    <option value="none">No parent (floating component)</option>
                    {eligibleParents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} ({getTypeLabel(parent.type as unknown as NodeType)})
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
          padding: '0 32px',
          zIndex: 40,
          borderRadius: 0,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            maxWidth: 720,
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
            onClick={() => router.back()}
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
