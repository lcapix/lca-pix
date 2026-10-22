/**
 * What a list of cases shows about each one (E07 Cases, E12 Home): its latest
 * run's headline number. Pure; the routes read the rows.
 */

export interface Headline {
  category: string
  /** Per functional unit: the run's total x its per_fu_scale. */
  value: number
  unit: string
}

const HEADLINE = /global warming|climate/i

/**
 * The headline of a run from its frozen totals (`$.totals` of the snapshot)
 * and its per-FU scale (`$.goal_scope.per_fu_scale`): global warming, else the
 * first category. Null for a run that froze no totals.
 */
export function headlineOf(totalsRaw: unknown, perFuScaleRaw: unknown): Headline | null {
  let totals: unknown = totalsRaw
  if (typeof totals === 'string') {
    try {
      totals = JSON.parse(totals)
    } catch {
      return null
    }
  }
  if (!Array.isArray(totals) || totals.length === 0) return null
  const pick = totals.find((t: any) => HEADLINE.test(String(t?.category_name ?? ''))) ?? totals[0]
  const value = Number((pick as any)?.value)
  if (!Number.isFinite(value)) return null
  const scale = Number(perFuScaleRaw)
  return {
    category: String((pick as any).category_name ?? ''),
    value: value * (Number.isFinite(scale) && scale > 0 ? scale : 1),
    unit: String((pick as any).unit ?? ''),
  }
}
