// Pure: safe in the browser (lib/runs/method-categories.ts reads the database).

/** The method's categories the run has no value for, in the method's order. */
export function notCounted(methodCats: string[] | undefined, impacts: Record<string, unknown>): string[] {
  const have = new Set(Object.keys(impacts).map((k) => k.toLowerCase()))
  return (methodCats ?? []).filter((c) => !have.has(c.toLowerCase()))
}
