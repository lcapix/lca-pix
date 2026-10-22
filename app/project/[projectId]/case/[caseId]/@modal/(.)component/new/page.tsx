"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ComponentFormModal } from "@/components/component-form/component-form-modal";
import { componentFormFromQuery } from "@/lib/case-editor/component-form-query";

export default function NewComponentInterceptedModal() {
  const params = useParams();
  const searchParams = useSearchParams();

  const projectId = params.projectId as string;
  const caseId = params.caseId as string;

  const { mode, initial, suggestedParentId, suggestedType } = componentFormFromQuery(searchParams);

  return (
    <ComponentFormModal
      projectId={projectId}
      caseId={caseId}
      mode={mode}
      initial={initial}
      suggestedParentId={suggestedParentId}
      suggestedType={suggestedType}
    />
  );
}
