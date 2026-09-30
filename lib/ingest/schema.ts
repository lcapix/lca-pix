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
  node: string;           // name of the process step this flow belongs to
  substance_text: string; // substance as the document states it (unmapped)
  direction: Direction;
  quantity: number;
  unit: string;           // unit as the document states it (unnormalized)
  provenance?: Provenance;
  confidence?: number;    // of the extraction itself
  /** The line as the document names it (a BOM part), for placement. */
  label?: string;
  /** A step the document names for this line (a BOM operation column). */
  op_hint?: string;
  /** Append mode: the existing step this line is placed on (chosen at review). */
  attach_component_id?: number | null;
}

export interface IngestCost {
  node: string;
  category: CostCategory;
  amount: number;
  currency?: string;
  basis?: string; // "annual, from utility totals", "per batch", ...
  provenance?: Provenance;
  label?: string;
  op_hint?: string;
  attach_component_id?: number | null;
  /** Labor: hours per unit and the occupation (BLS SOC) whose wage priced them. */
  hours?: number;
  rate_label?: string;
  occupation?: string;
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

/**
 * Coarse-to-fine rank of each tier. Tiers are LABELS of how coarse a step is,
 * not a fixed ladder: patent US 6,490,569 claim 4 allows "more or fewer"
 * levels, and ISO 14044 unit processes come at whatever granularity the data
 * has. A tree is as deep as its document says — an operation may sit directly
 * under the product.
 */
export const TIER_RANK: Record<Tier, number> = {
  product: 1,
  machine_line: 2,
  subprocess: 3,
  operation: 4,
  elemental_task: 5,
};

/**
 * Structural checks before anything touches LCAPIX. The only rules: one
 * product root, known parents, every child strictly finer than its parent
 * (levels may be skipped), and every flow/cost pointing at a node that exists.
 */
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
    // Own keys only: `in` would accept inherited names such as 'toString'.
    if (!Object.hasOwn(TIER_RANK, n.tier)) {
      errors.push(`node '${n.name}' has unknown tier '${n.tier}'`);
      continue;
    }
    if (n.parent !== null) {
      const p = byName.get(n.parent);
      if (!p) errors.push(`node '${n.name}' has unknown parent '${n.parent}'`);
      else if (TIER_RANK[n.tier] <= TIER_RANK[p.tier]) {
        errors.push(`'${n.name}' (${n.tier}) must be finer than its parent '${p.name}' (${p.tier})`);
      }
    }
  }
  for (const f of pm.flows) {
    if (!byName.has(f.node)) errors.push(`flow '${f.substance_text}' targets unknown node '${f.node}'`);
  }
  for (const c of pm.costs) {
    if (!byName.has(c.node)) errors.push(`${c.category} cost targets unknown node '${c.node}'`);
  }
  return errors;
}

/**
 * Advisory issues that do not block apply. A node with steps below it is the
 * sum of those steps (terminating-node rule), so a flow or cost placed on it
 * is easy to double-count with the same item modeled below.
 */
export function processModelWarnings(pm: ProcessModel): string[] {
  const hasChildren = new Set(pm.nodes.map((n) => n.parent).filter(Boolean) as string[]);
  const warnings: string[] = [];
  for (const f of pm.flows) {
    if (hasChildren.has(f.node)) {
      warnings.push(
        `flow '${f.substance_text}' sits on '${f.node}', which has steps below it — move it to the step that uses it`,
      );
    }
  }
  for (const c of pm.costs) {
    if (hasChildren.has(c.node)) {
      warnings.push(
        `${c.category} cost sits on '${c.node}', which has steps below it — move it to the step that incurs it`,
      );
    }
  }
  return warnings;
}

/** Depth of each node from the product root (root = 1), for hierarchy_level. */
export function nodeDepths(nodes: IngestNode[]): Map<string, number> {
  const parentOf = new Map(nodes.map((n) => [n.name, n.parent]));
  const depths = new Map<string, number>();
  for (const n of nodes) {
    let depth = 1;
    let cur = n.parent;
    // Bounded walk: a corrupt parent cycle must not hang an import.
    while (cur !== null && cur !== undefined && depth < 64) {
      depth++;
      cur = parentOf.get(cur) ?? null;
    }
    depths.set(n.name, depth);
  }
  return depths;
}
