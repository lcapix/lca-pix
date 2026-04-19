"use client";

/**
 * Edit-component page (Phase 7, Task 7.3).
 *
 * Shares the same <ComponentForm> implementation as the "new" page. On mount
 * we hydrate initial values from the local Zustand store when available, and
 * we ALSO fetch the canonical record from `/api/components/:id` so server-
 * authoritative fields (mass, detailed ABC costs, currency) override stale
 * local state without touching the API contract.
 */

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ComponentForm,
  type ComponentFormInitialValues,
} from "@/components/component-form/component-form";
import { useProjectStore } from "@/lib/store";

type ApiComponent = {
  component_id?: number | string;
  component_name?: string;
  component_type?: string;
  description?: string;
  parent_component_id?: number | string | null;
  driver_category?: string;
  drivers?: string[] | string;
  mass?: number;
  mass_unit?: string;
  operational_cost_usd?: number;
  capital_cost_usd?: number;
  labor_cost?: number;
  energy_cost?: number;
  transportation_cost?: number;
  material_cost?: number;
  equipment_cost?: number;
  overhead_cost?: number;
  currency?: string;
};

export default function EditComponentPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const caseId = params.caseId as string;
  const componentId = params.componentId as string;

  const { projects } = useProjectStore();

  // Seed from local store when possible so the form renders immediately.
  const localSeed = useMemo<ComponentFormInitialValues | undefined>(() => {
    const proj = projects.find((p) => p.id === projectId);
    const kase = proj?.cases.find((c) => c.id === caseId);
    const comp = kase?.components.find((c) => c.id === componentId);
    if (!comp) return undefined;
    return {
      id: comp.id,
      type: comp.type as string,
      name: comp.name,
      description: comp.description,
      parentId: comp.parentId ?? null,
      driverCategory: comp.driverCategory,
      drivers: comp.drivers,
      mass: comp.mass,
      massUnit: comp.massUnit,
      operationalCostUSD: comp.operationalCostUSD,
      capitalCostUSD: comp.capitalCostUSD,
      laborCost: comp.laborCost,
      energyCost: comp.energyCost,
      transportationCost: comp.transportationCost,
      materialCost: comp.materialCost,
      equipmentCost: comp.equipmentCost,
      overheadCost: comp.overheadCost,
      currency: comp.currency,
    };
  }, [projects, projectId, caseId, componentId]);

  const [initial, setInitial] = useState<ComponentFormInitialValues | undefined>(
    localSeed,
  );

  // Fetch canonical record from /api/components/:id on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/components/${componentId}`);
        if (!res.ok) return;
        const json = await res.json();
        const c = (json?.component ?? json) as ApiComponent;
        if (!c || cancelled) return;
        const parsedDrivers: string[] | undefined = Array.isArray(c.drivers)
          ? c.drivers
          : typeof c.drivers === "string"
          ? (() => {
              try { return JSON.parse(c.drivers) as string[]; } catch { return undefined; }
            })()
          : undefined;
        setInitial((prev) => ({
          ...(prev ?? {}),
          id: String(componentId),
          name: c.component_name ?? prev?.name,
          type: c.component_type ?? prev?.type,
          description: c.description ?? prev?.description,
          parentId: c.parent_component_id != null
            ? String(c.parent_component_id)
            : prev?.parentId ?? null,
          driverCategory: c.driver_category ?? prev?.driverCategory,
          drivers: parsedDrivers ?? prev?.drivers,
          mass: c.mass ?? prev?.mass,
          massUnit: c.mass_unit ?? prev?.massUnit,
          operationalCostUSD: c.operational_cost_usd ?? prev?.operationalCostUSD,
          capitalCostUSD: c.capital_cost_usd ?? prev?.capitalCostUSD,
          laborCost: c.labor_cost ?? prev?.laborCost,
          energyCost: c.energy_cost ?? prev?.energyCost,
          transportationCost: c.transportation_cost ?? prev?.transportationCost,
          materialCost: c.material_cost ?? prev?.materialCost,
          equipmentCost: c.equipment_cost ?? prev?.equipmentCost,
          overheadCost: c.overhead_cost ?? prev?.overheadCost,
          currency: c.currency ?? prev?.currency,
        }));
      } catch {
        /* non-fatal — fall back to local store seed */
      }
    }
    load();
    return () => { cancelled = true; };
  }, [componentId]);

  return (
    <ComponentForm
      projectId={projectId}
      caseId={caseId}
      mode="edit"
      initial={initial ?? { id: componentId }}
    />
  );
}
