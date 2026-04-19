'use client';

/**
 * <ComponentForm> — Veridian Flow redesign of the component-creation form.
 *
 * Drives both the "new" page and the "edit" page. The state model, handler
 * shape, validation rules, and store-mutation contract are preserved from the
 * original `app/project/[projectId]/case/[caseId]/component/new/page.tsx`
 * implementation. ONLY the visual layer (tokens, typography, layout) is new.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, AlertCircle, CheckCircle2, Layers, Fingerprint, Coins, Settings2, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function SectionCard({
  step, title, icon, tone = 'lowest', children,
}: {
  step: string;
  title: string;
  icon: React.ReactNode;
  tone?: 'lowest' | 'low';
  children: React.ReactNode;
}) {
  const bg = tone === 'lowest' ? 'bg-surface-container-lowest' : 'bg-surface-container-low';
  return (
    <section className={`${bg} p-8 md:p-10 rounded-xl shadow-botanical`}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-1">{step}</h2>
          <h3 className="text-2xl font-bold tracking-tight text-on-surface">{title}</h3>
        </div>
        <span className="text-primary/70 bg-primary-fixed/20 p-3 rounded-lg">{icon}</span>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-outline block">
      {children}
      {required && <span className="text-error ml-1">*</span>}
    </label>
  );
}

function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary bg-primary-fixed/30 px-2 py-1 rounded-sm">
      {children}
    </span>
  );
}

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      // Cast through unknown to accommodate the store's slightly narrower NodeType.
      // Runtime string values are whatever the form collected — preserving the
      // pre-existing behavior of the legacy implementation.
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

  /* ------- render ------- */
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 md:px-8 pt-10 pb-40">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
          <Link href="/home" className="hover:text-on-surface">Home</Link>
          <span className="opacity-40">/</span>
          <Link href={`/project/${projectId}`} className="hover:text-on-surface">
            {project?.name || 'Project'}
          </Link>
          <span className="opacity-40">/</span>
          <Link href={`/project/${projectId}/case/${caseId}`} className="hover:text-on-surface">
            {currentCase?.name || 'Case'}
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-on-surface font-medium">
            {isEditMode ? 'Edit Component' : 'New Component'}
          </span>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-3">
            <SectionPill>
              {isEditMode ? 'Module Config · Edit' : 'Module Config · Create'}
            </SectionPill>
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-on-surface leading-tight">
            {isEditMode ? 'Edit Component' : 'Define Component'}
          </h1>
          <p className="text-on-surface-variant max-w-xl mt-4 leading-relaxed">
            Configure a process, material, or activity in the LCA model. Fields map directly
            to the characterization pipeline — precision matters downstream.
          </p>
          {isAddChildMode && suggestedParent && (
            <div className="mt-6 veridian-gradient-soft rounded-lg px-4 py-3 text-sm text-primary-container">
              <strong>Adding child to:</strong>{' '}
              {buildBreadcrumbPath(suggestedParent, processNodes)} / {suggestedParent.name}
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ---------------- Section 1: Type & Placement ---------------- */}
          <SectionCard
            step="Step 01"
            title="Type & Placement"
            icon={<Layers className="h-5 w-5" />}
            tone="lowest"
          >
            <div className="space-y-2">
              <FieldLabel required>Process Type</FieldLabel>
              <TypeSegmentedControl
                value={formData.processType as ComponentTypeValue | ''}
                onChange={handleTypeChange}
                disabled={isProcessTypeLocked}
              />
              {errors.processType && (
                <p className="text-sm text-error">{errors.processType}</p>
              )}
              {isProcessTypeLocked && (
                <p className="font-mono text-[10px] uppercase tracking-widest text-outline">
                  Locked — {isAddChildMode ? 'add-child mode' : 'component has a parent'}
                </p>
              )}
            </div>

            {formData.processType && formData.processType !== 'product' && (
              <div className="mt-8 space-y-2">
                <FieldLabel>Parent Component</FieldLabel>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(value) => {
                    setFormData((p) => ({ ...p, parentId: value === 'none' ? '' : value }));
                    if (errors.parentId) setErrors((p) => ({ ...p, parentId: '' }));
                  }}
                  disabled={isAddChildMode}
                >
                  <SelectTrigger
                    className={`bg-surface-container-low ${errors.parentId ? 'ring-2 ring-error' : ''}`}
                  >
                    <SelectValue placeholder="No parent (floating component)">
                      {formData.parentId
                        ? eligibleParents.find((p) => p.id === formData.parentId)?.name ||
                          'Unknown Parent'
                        : 'No Parent (Floating Component)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent (Floating Component)</SelectItem>
                    {eligibleParents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{parent.name}</span>
                          <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">
                            {getTypeLabel(parent.type as unknown as NodeType)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.parentId && <p className="text-sm text-error">{errors.parentId}</p>}
                {!formData.parentId && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-outline">
                    Floating — can be re-parented later
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          {/* ---------------- Section 2: Identity ---------------- */}
          <SectionCard
            step="Step 02"
            title="Identity & Metrics"
            icon={<Fingerprint className="h-5 w-5" />}
            tone="low"
          >
            <div className="space-y-8">
              <div className="space-y-2">
                <FieldLabel required>Component Full Name</FieldLabel>
                <Input
                  type="text"
                  value={formData.processName}
                  maxLength={100}
                  placeholder="e.g. Battery Cell Assembly"
                  onChange={(e) => {
                    setFormData((p) => ({ ...p, processName: e.target.value }));
                    if (errors.processName) setErrors((p) => ({ ...p, processName: '' }));
                  }}
                  className={`h-12 text-xl font-medium bg-transparent border-0 border-b border-outline-variant/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary ${errors.processName ? 'border-error' : ''}`}
                />
                <div className="flex justify-between">
                  {errors.processName && <p className="text-sm text-error">{errors.processName}</p>}
                  <p className="font-mono text-[10px] uppercase tracking-widest text-outline ml-auto">
                    {formData.processName.length} / 100
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-2">
                  <FieldLabel>Technical Description</FieldLabel>
                  <Textarea
                    value={formData.processDescription}
                    rows={3}
                    placeholder="Process steps, materials, assumptions…"
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, processDescription: e.target.value }))
                    }
                    className="bg-transparent border-0 border-b border-outline-variant/40 rounded-none px-0 resize-none text-sm leading-relaxed focus-visible:ring-0 focus-visible:border-primary"
                  />
                </div>
                <div className="space-y-8">
                  <div className="space-y-2">
                    <FieldLabel>Quantity</FieldLabel>
                    <Input
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
                      className="bg-transparent border-0 border-b border-outline-variant/40 rounded-none px-0 font-mono text-lg focus-visible:ring-0 focus-visible:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Reference Unit</FieldLabel>
                    <Input
                      type="text"
                      value={formData.massUnit}
                      placeholder="kg"
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, massUnit: e.target.value }))
                      }
                      className="bg-transparent border-0 border-b border-outline-variant/40 rounded-none px-0 font-mono text-lg uppercase focus-visible:ring-0 focus-visible:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ---------------- Section 3: Drivers (elemental only) ---------------- */}
          {showDriversSection && (
            <SectionCard
              step="Step 03"
              title="Structural Drivers"
              icon={<Layers className="h-5 w-5" />}
              tone="lowest"
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <FieldLabel>Driver Category</FieldLabel>
                  <Select
                    value={formData.driverCategory}
                    onValueChange={(value) =>
                      setFormData((p) => ({ ...p, driverCategory: value, drivers: [] }))
                    }
                  >
                    <SelectTrigger className="bg-surface-container-low">
                      <SelectValue placeholder="Select a driver category" />
                    </SelectTrigger>
                    <SelectContent>
                      {DRIVER_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.driverCategory && (
                  <div className="space-y-3">
                    <FieldLabel>Drivers</FieldLabel>
                    <div className="rounded-lg bg-surface-container-low p-4 divide-y divide-outline-variant/20">
                      {availableDrivers.map((driver) => {
                        const checked = formData.drivers.includes(driver);
                        return (
                          <label
                            key={driver}
                            className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer group"
                          >
                            <span className="text-sm font-medium">{driver}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData((p) => ({
                                    ...p, drivers: [...p.drivers, driver],
                                  }));
                                } else {
                                  setFormData((p) => ({
                                    ...p,
                                    drivers: p.drivers.filter((d) => d !== driver),
                                  }));
                                }
                              }}
                              className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                            />
                          </label>
                        );
                      })}
                    </div>
                    {formData.drivers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.drivers.map((d) => (
                          <Badge key={d} variant="secondary" className="text-xs">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ---------------- Section 4: Costs (collapsible) ---------------- */}
          <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
            <section className="bg-surface-container-lowest rounded-xl shadow-botanical overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full p-8 md:p-10 text-left"
                >
                  <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-1">
                      Step {showDriversSection ? '04' : '03'}
                    </h2>
                    <h3 className="text-2xl font-bold tracking-tight text-on-surface">
                      Economic Profile
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Coins className="h-5 w-5 text-primary/70" />
                    <ChevronDown
                      className={`h-5 w-5 text-on-surface-variant transition-transform ${costsOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-8 md:px-10 pb-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CostField
                      label="Operational Cost"
                      value={formData.operationalCostUSD}
                      currency={formData.currency}
                      onChange={(v) =>
                        setFormData((p) => ({ ...p, operationalCostUSD: v }))
                      }
                    />
                    <CostField
                      label="Capital Cost"
                      value={formData.capitalCostUSD}
                      currency={formData.currency}
                      onChange={(v) =>
                        setFormData((p) => ({ ...p, capitalCostUSD: v }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-outline-variant/20">
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
                      label="Transportation"
                      value={formData.transportationCost}
                      currency={formData.currency}
                      onChange={(v) =>
                        setFormData((p) => ({ ...p, transportationCost: v }))
                      }
                    />
                    <CostField
                      label="Material"
                      value={formData.materialCost}
                      currency={formData.currency}
                      onChange={(v) => setFormData((p) => ({ ...p, materialCost: v }))}
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
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* ---------------- Section 5: Advanced (collapsible) ---------------- */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <section className="bg-surface-container-low rounded-xl overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-between w-full p-8 md:p-10 text-left"
                >
                  <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-1">
                      Advanced
                    </h2>
                    <h3 className="text-2xl font-bold tracking-tight text-on-surface">
                      Currency & Metadata
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Settings2 className="h-5 w-5 text-primary/70" />
                    <ChevronDown
                      className={`h-5 w-5 text-on-surface-variant transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-8 md:px-10 pb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <FieldLabel>Currency (ISO 4217)</FieldLabel>
                    <Input
                      type="text"
                      value={formData.currency}
                      maxLength={3}
                      placeholder="USD"
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          currency: e.target.value.toUpperCase(),
                        }))
                      }
                      className="bg-transparent border-0 border-b border-outline-variant/40 rounded-none px-0 font-mono text-lg uppercase focus-visible:ring-0 focus-visible:border-primary"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        </form>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 glass-panel border-t border-outline-variant/15">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/project/${projectId}/case/${caseId}`)}
            className="font-mono text-xs uppercase tracking-widest"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-4">
            {!isFormValid && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-outline hidden md:inline">
                Name + type required
              </span>
            )}
            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              onClick={handleSubmit}
              className="veridian-gradient text-white px-8 py-3 h-auto rounded-lg font-bold tracking-tight shadow-botanical hover:opacity-95"
            >
              {isSubmitting
                ? (isEditMode ? 'Updating…' : 'Creating…')
                : (isEditMode ? 'Save Changes' : 'Create Component')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-baseline gap-2 border-b border-outline-variant/40 focus-within:border-primary transition-colors">
        <span className="font-mono text-xs text-outline">{currency || 'USD'}</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value || ''}
          placeholder="0.00"
          onChange={(e) =>
            onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))
          }
          className="flex-1 bg-transparent border-0 px-0 py-3 font-mono text-lg focus:outline-none"
        />
      </div>
    </div>
  );
}

export default ComponentForm;
