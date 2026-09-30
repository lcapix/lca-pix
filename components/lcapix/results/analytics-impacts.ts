// Run results as the analytics page plots them (audit ANA-1). Impacts keep
// their sign: a net credit (recycling, avoided burden) is part of the result
// and must not be drawn as a burden.

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

/** Category totals and per-component impacts from GET /api/assessments/:runId. */
export function analyticsImpacts(detail: {
  total_impacts?: Array<{ category_name: string; impact_value: unknown; unit: string }>
  component_breakdown?: Array<{
    component_name: string
    component_type: string
    impacts?: Array<{ category_name: string; impact_value: unknown }>
  }>
}) {
  const categories = (detail.total_impacts ?? []).map((cat) => ({
    category_name: cat.category_name,
    impact_value: num(cat.impact_value),
    unit: cat.unit,
  }))
  const components = (detail.component_breakdown ?? []).map((comp) => ({
    component_name: comp.component_name,
    component_type: comp.component_type,
    impacts: (comp.impacts ?? []).map((imp) => ({
      category_name: imp.category_name,
      impact_value: num(imp.impact_value),
    })),
  }))
  return { categories, components }
}

/** Each value as a percent of the largest magnitude; a credit stays negative. */
export function normalizeByMaxAbs(values: number[]): number[] {
  const max = Math.max(...values.map((v) => Math.abs(v)), 0)
  return values.map((v) => (max > 0 ? (v / max) * 100 : 0))
}

/** log10(|v| + 1) with v's sign, so a credit is not flattened to 0 on a log view. */
export function signedLog10(v: number): number {
  if (!Number.isFinite(v) || v === 0) return 0
  return Math.sign(v) * Math.log10(Math.abs(v) + 1)
}
