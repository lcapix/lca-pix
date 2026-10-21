/**
 * What one answer is per, everywhere a case's result is read (Results, Cost,
 * Write-up, phone): the case's own reference unit ("bracket"); else the
 * project's functional unit without its leading 1 ("enclosure" from
 * "1 enclosure"); else "unit". The case header already reads the same way.
 */
export function perUnit(
  kase: { reference_flow_unit: string | null; project_functional_unit?: string | null },
  functionalUnit?: string | null,
): string {
  const own = (kase.reference_flow_unit ?? '').trim()
  if (own) return own
  const fu = (functionalUnit ?? kase.project_functional_unit ?? '').trim()
  if (!fu) return 'unit'
  const m = /^1\s+(.+)$/.exec(fu)
  return m ? m[1] : fu
}
