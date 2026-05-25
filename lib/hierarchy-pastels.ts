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
export const HIERARCHY_PASTELS: Record<HierarchyNodeType, PastelTone> = {
  Product:    { bg: '#a7d3b8', border: '#4f8a6a', text: '#16331f', label: 'PRODUCT' },
  Machine:    { bg: '#f0a68a', border: '#c45a3a', text: '#3a1a0f', label: 'MACHINE/LINE' },
  Subprocess: { bg: '#f5c971', border: '#d9a84a', text: '#3a2a0a', label: 'SUBPROCESS' },
  Operation:  { bg: '#7bb5e8', border: '#4f90c9', text: '#0f2238', label: 'OPERATION' },
  Task:       { bg: '#c8b5e8', border: '#9f88cc', text: '#1f1438', label: 'ELEMENTAL TASK' },
}

export function pastelFor(type: HierarchyNodeType): PastelTone {
  return HIERARCHY_PASTELS[type] ?? HIERARCHY_PASTELS.Product
}
