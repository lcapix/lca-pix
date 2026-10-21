/**
 * Where an ingested cost line is stored on its step: the category → column
 * map shared by the apply route (which writes it) and the import review
 * (which shows what a step already carries in that column). Pure.
 */

export const COST_COLUMN: Record<string, string> = {
  labor: 'labor_cost',
  energy: 'energy_cost',
  material: 'material_cost',
  transportation: 'transportation_cost',
  opex: 'opex',
  capex: 'capex',
};

/** The cost column for a category, own keys only ("constructor" is not a column). */
export const costColumn = (category: unknown): string | undefined =>
  typeof category === 'string' && Object.hasOwn(COST_COLUMN, category) ? COST_COLUMN[category] : undefined;

/** What the reviewer decided for a step that already has a cost in a column the document writes. */
export type CostMode = 'keep' | 'replace' | 'add';
