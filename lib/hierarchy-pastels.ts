import type { HierarchyNodeType } from '@/lib/lcapix-demo'

export interface PastelTone {
  bg: string
  border: string
  text: string
  label: string
}

// One distinct hue per tier so the hierarchy reads at a glance.
// Product = warm coral (the apex) → Machine/Line = brick rust → Subprocess
// = amber → Operation = sky → Task = lavender. Borders + text tones are
// hand-picked for AA contrast on the pastel fills.
//
// Borders are deliberately a full step darker/more saturated than the fill so
// each box reads as a crisp outlined card even at low zoom ("view full
// hierarchy" was hard to read until zoomed in — the thin, light outlines were
// the cause).
export const HIERARCHY_PASTELS: Record<HierarchyNodeType, PastelTone> = {
  // Neutral grey container — the synthetic multi-root wrapper. Deliberately
  // colourless so it never reads as a Product tier.
  Root:       { bg: '#e7ebe9', border: '#8c9a92', text: '#2e3832', label: 'CASE' },
  Product:    { bg: '#a7d3b8', border: '#3d7256', text: '#16331f', label: 'PRODUCT' },
  Machine:    { bg: '#f0a68a', border: '#a8472b', text: '#3a1a0f', label: 'MACHINE/LINE' },
  Subprocess: { bg: '#f5c971', border: '#b5852b', text: '#3a2a0a', label: 'SUBPROCESS' },
  Operation:  { bg: '#7bb5e8', border: '#356da0', text: '#0f2238', label: 'OPERATION' },
  Task:       { bg: '#c8b5e8', border: '#7c61b5', text: '#1f1438', label: 'ELEMENTAL TASK' },
}

export function pastelFor(type: HierarchyNodeType): PastelTone {
  return HIERARCHY_PASTELS[type] ?? HIERARCHY_PASTELS.Product
}
