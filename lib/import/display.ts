// Display helpers for the import page (/project/[projectId]/import): tier and
// layer labels, score colours, button copy and link targets. Pure: no React,
// no browser globals.

import { LAYER_LABEL } from '@/lib/ingest/doc-types'

/** Chip label for each hierarchy tier (hierarchy preview, DEFAULT STEP picker). */
export const TIER_LABEL: Record<string, string> = {
  product: 'PRODUCT',
  machine_line: 'MACHINE/LINE',
  subprocess: 'SUBPROCESS',
  operation: 'OPERATION',
  elemental_task: 'TASK',
}

/** Indent level of a node in the hierarchy preview: product 0 … operation 3; any other tier 4. */
export function tierDepth(tier: string): number {
  return tier === 'product' ? 0 : tier === 'machine_line' ? 1 : tier === 'subprocess' ? 2 : tier === 'operation' ? 3 : 4
}

/** Human label for a case layer id; an unknown layer shows as its own id. */
export function layerLabel(layer: string): string {
  return LAYER_LABEL[layer as keyof typeof LAYER_LABEL] ?? layer
}

/** Colour of a substance match score: ≥ 0.9 success, ≥ 0.55 warn, below that error. */
export const scoreColor = (s: number) =>
  s >= 0.9 ? 'var(--signal-success, #16a34a)' : s >= 0.55 ? 'var(--signal-warn, #d97706)' : 'var(--signal-error, #dc2626)'

/** Colour of a step-placement reason: ≥ 0.8 success, ≥ 0.5 warn, below that tertiary text. */
export function confidenceColor(confidence: number): string {
  return confidence >= 0.8
    ? 'var(--signal-success, #16a34a)'
    : confidence >= 0.5
      ? 'var(--signal-warn, #d97706)'
      : 'var(--text-tertiary)'
}

/** A 0..1 score as a whole percent, without the % sign ("0.954" → "95"). */
export function percent(score: number): string {
  return (score * 100).toFixed(0)
}

/** Label of the review's apply button, by phase and by create vs append. */
export function applyButtonLabel(applying: boolean, appending: boolean): string {
  return applying
    ? appending
      ? 'Adding…'
      : 'Creating case…'
    : appending
      ? 'Apply — add to case'
      : 'Apply — create this case'
}

/** Where the back link goes: the target case when one is chosen (truthy id), else the project. */
export function backHref(projectId: string, targetCaseId: number | null): string {
  return targetCaseId ? `/project/${projectId}/case/${targetCaseId}` : `/project/${projectId}`
}

/** Text of the back link, matching backHref. */
export function backLabel(targetCaseId: number | null): string {
  return targetCaseId ? 'Back to the case' : 'Back to the project'
}

/** Why the flows table is empty: a routing has no flows by design; other documents just had none. */
export function noFlowsMessage(connector: string): string {
  return connector === 'routing'
    ? 'A routing gives the steps and their hours, not materials or energy. Add the BOM for materials and the equipment list for machine energy next.'
    : 'This document has no material or energy lines to add.'
}
