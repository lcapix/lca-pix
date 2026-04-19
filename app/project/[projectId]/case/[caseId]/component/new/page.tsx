"use client";

/**
 * "New component" page — Veridian Flow redesign (Phase 7).
 *
 * This page is now a thin wrapper around the shared <ComponentForm>, which
 * also powers the edit page. The previous implementation lived entirely in
 * this file; its state, validation, and store contract were preserved
 * verbatim inside `components/component-form/component-form.tsx`.
 *
 * Legacy search-params (suggestedParent / type / edit / name / etc.) are
 * still honoured so existing inbound links keep working.
 */

import { useParams, useSearchParams } from "next/navigation";
import { ComponentForm, type ComponentFormInitialValues } from "@/components/component-form/component-form";

export default function NewComponentPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params.projectId as string;
  const caseId = params.caseId as string;

  const suggestedParentId = searchParams.get("parent");
  const suggestedType = searchParams.get("type");
  const editingId = searchParams.get("edit");

  // Legacy edit-via-querystring flow: if "?edit=..." is supplied we pre-fill.
  const initial: ComponentFormInitialValues | undefined = editingId
    ? {
        id: editingId,
        name: searchParams.get("name") || undefined,
        description: searchParams.get("description") || undefined,
        driverCategory: searchParams.get("driverCategory") || undefined,
        drivers: (() => {
          const raw = searchParams.get("drivers");
          if (!raw) return undefined;
          try {
            return JSON.parse(raw) as string[];
          } catch {
            return undefined;
          }
        })(),
        operationalCostUSD: searchParams.get("operationalCostUSD")
          ? parseFloat(searchParams.get("operationalCostUSD")!)
          : undefined,
        capitalCostUSD: searchParams.get("capitalCostUSD")
          ? parseFloat(searchParams.get("capitalCostUSD")!)
          : undefined,
      }
    : undefined;

  return (
    <ComponentForm
      projectId={projectId}
      caseId={caseId}
      mode={editingId ? "edit" : "create"}
      initial={initial}
      suggestedParentId={suggestedParentId}
      suggestedType={suggestedType}
    />
  );
}
