"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ComponentFormModal } from "@/components/component-form/component-form-modal";
import type { ComponentFormInitialValues } from "@/components/component-form/component-form";

export default function NewComponentInterceptedModal() {
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params.projectId as string;
  const caseId = params.caseId as string;

  const suggestedParentId = searchParams.get("parent");
  const suggestedType = searchParams.get("type");
  const editingId = searchParams.get("edit");

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
    <ComponentFormModal
      projectId={projectId}
      caseId={caseId}
      mode={editingId ? "edit" : "create"}
      initial={initial}
      suggestedParentId={suggestedParentId}
      suggestedType={suggestedType}
    />
  );
}
