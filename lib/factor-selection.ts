/**
 * Factor selection: region canonicalization and best-scope dedup.
 *
 * The factor table stores one row per substance × category × method ×
 * geographic_scope. A calculation must use exactly ONE factor per
 * flow × category: the requested region's row when it exists, otherwise the
 * Global row. Summing both (the old `IN (region, 'Global')` join with no
 * dedup) double-counts the moment regional rows appear.
 *
 * Pure functions so the selection policy is unit-testable without a database.
 */

/** UI region labels → canonical geographic_scope codes stored on factor rows.
 * Electricity Maps sync writes zone codes ('US', 'DE', …); bundled packs write
 * 'Global'. The UI keeps its human labels; everything past the API boundary
 * speaks canonical codes. */
const REGION_ALIASES: Record<string, string> = {
  'us grid': 'US',
  'us': 'US',
  'united states': 'US',
  'eu average': 'EU',
  'eu': 'EU',
  'europe': 'EU',
  'global': 'Global',
  'global average': 'Global',
};

export function canonicalizeRegion(input: string | null | undefined): string {
  if (!input) return 'Global';
  const key = input.trim().toLowerCase();
  if (REGION_ALIASES[key]) return REGION_ALIASES[key];
  // Already a zone code (e.g. 'DE', 'US-CAL') — pass through unchanged.
  return input.trim();
}

export interface ScopedFactorRow {
  flow_id: number;
  category_id: number;
  geographic_scope: string;
  [key: string]: unknown;
}

/**
 * Keep exactly one factor row per (flow_id, category_id): an exact-region row
 * beats the Global fallback; among equals the first row wins (stable).
 * Returns the surviving rows plus which scope each selection used, so runs can
 * record whether a number came from a regional factor or the fallback.
 */
export function selectBestScopeRows<T extends ScopedFactorRow>(
  rows: T[],
  region: string,
): { selected: T[]; scopeUsed: Map<string, string> } {
  const byKey = new Map<string, T>();
  const regionLc = region.toLowerCase();
  for (const row of rows) {
    const key = `${row.flow_id}:${row.category_id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const rowExact = String(row.geographic_scope).toLowerCase() === regionLc;
    const existingExact =
      String(existing.geographic_scope).toLowerCase() === regionLc;
    if (rowExact && !existingExact) byKey.set(key, row);
  }
  const selected = Array.from(byKey.values());
  const scopeUsed = new Map<string, string>();
  for (const [key, row] of byKey.entries()) {
    scopeUsed.set(key, String(row.geographic_scope));
  }
  return { selected, scopeUsed };
}
