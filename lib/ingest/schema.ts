// Canonical intermediate representation for document ingestion — the TS port
// of lcapix-ingest/ingest/schema.py (proven on DOE ITAC WV0661 → case 158).
//
// Every extracted fact carries provenance (which document, where in it, the
// literal snippet) and downstream consumers must surface it: nothing enters
// LCAPIX without a traceable source, and nothing uncertain enters silently.

export type Tier = 'product' | 'machine_line' | 'subprocess' | 'operation' | 'elemental_task';
export type Direction = 'input' | 'output';
export type CostCategory = 'labor' | 'energy' | 'material' | 'transportation' | 'opex' | 'capex';

export interface Provenance {
  doc: string;      // file name
  locator: string;  // "sheet ASSESS, row ID=WV0661", "page 3 table 1", ...
  snippet?: string; // the literal source text/value
}

export interface IngestNode {
  name: string;
  tier: Tier;
  parent: string | null; // name of parent node; null only for the product root
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  provenance?: Provenance;
}

export interface IngestFlow {
  node: string;           // leaf node name this flow belongs to
  substance_text: string; // substance as the document states it (unmapped)
  direction: Direction;
  quantity: number;
  unit: string;           // unit as the document states it (unnormalized)
  provenance?: Provenance;
  confidence?: number;    // of the extraction itself
}

export interface IngestCost {
  node: string;
  category: CostCategory;
  amount: number;
  currency?: string;
  basis?: string; // "annual, from utility totals", "per batch", ...
  provenance?: Provenance;
}

export interface ProcessModel {
  product_name: string;
  case_name: string;
  nodes: IngestNode[];
  flows: IngestFlow[];
  costs: IngestCost[];
  source_docs: string[];
  notes: string[]; // anything the extractor could NOT map
}

const ALLOWED_CHILD: Record<Tier, Tier | undefined> = {
  product: 'machine_line',
  machine_line: 'subprocess',
  subprocess: 'operation',
  operation: 'elemental_task',
  elemental_task: undefined,
};

/** Structural checks before anything touches LCAPIX. */
export function validateProcessModel(pm: ProcessModel): string[] {
  const errors: string[] = [];
  const names = pm.nodes.map((n) => n.name);
  if (new Set(names).size !== names.length) errors.push('duplicate node names');
  const roots = pm.nodes.filter((n) => n.parent === null);
  if (roots.length !== 1 || roots[0].tier !== 'product') {
    errors.push('exactly one product root required');
  }
  const byName = new Map(pm.nodes.map((n) => [n.name, n]));
  for (const n of pm.nodes) {
    if (n.parent !== null) {
      const p = byName.get(n.parent);
      if (!p) errors.push(`node '${n.name}' has unknown parent '${n.parent}'`);
      else if (ALLOWED_CHILD[p.tier] !== n.tier) {
        errors.push(`'${n.name}' (${n.tier}) cannot attach under '${p.name}' (${p.tier})`);
      }
    }
  }
  const leafNames = new Set(pm.nodes.filter((n) => n.tier === 'elemental_task').map((n) => n.name));
  for (const f of pm.flows) {
    if (!leafNames.has(f.node)) {
      errors.push(`flow '${f.substance_text}' targets non-leaf '${f.node}'`);
    }
  }
  return errors;
}
