/**
 * The categories a method has factors for, so a run can say which of them it
 * left out (1.8, 2.11): a category with no value is "not counted", not zero.
 * Quarantined factors are a different method name and never count.
 */

import { query } from '@/lib/db-helpers'
import { placeholders } from '@/lib/runs/newest-first'

export async function methodCategories(methods: string[]): Promise<Map<string, string[]>> {
  const names = [...new Set(methods.filter(Boolean))]
  const out = new Map<string, string[]>(names.map((m) => [m, []]))
  if (!names.length) return out
  const rows = await query<any>(
    `SELECT DISTINCT f.method_name, c.category_name
       FROM driver_impact_factors f
       JOIN impact_categories c ON c.category_id = f.category_id
      WHERE f.method_name IN (${placeholders(names.length)})
      ORDER BY c.category_name`,
    names,
  )
  for (const r of rows) {
    const key = names.find((m) => m.toLowerCase() === String(r.method_name).toLowerCase())
    if (key) out.get(key)!.push(String(r.category_name))
  }
  return out
}

export { notCounted } from './method-categories-view'
