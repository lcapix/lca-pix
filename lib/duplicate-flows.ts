/**
 * Double-count detection.
 *
 * The tier names (product, machine line, subprocess, operation, task) are
 * nomenclature, not rules: the v1 manual calls them "for identification
 * purposes only" and puts the hierarchy "completely under the control of the
 * user". So a flow may sit on any node, and the engine counts it wherever it
 * sits.
 *
 * What is worth warning about is not a parent carrying flows — it is the SAME
 * substance counted twice on one path through the tree: once on a step and
 * again on a step above or below it. That is a real error with a real number
 * attached; the previous blanket warning fired on every parent and therefore
 * taught people to ignore it.
 *
 * Known limit, stated rather than hidden: this finds the same substance on one
 * path. It cannot find "steel on the line, and a sub-assembly below that
 * already includes that steel", because nothing in the data says the
 * sub-assembly contains steel.
 *
 * Pure module: no database, fully unit-testable.
 */

export type FlowOnNode = {
  component_id: number;
  component_name: string;
  parent_component_id: number | null;
  substance_id: number;
  substance_name: string;
};

export type DuplicateFinding = {
  substance_name: string;
  /** The node nearer the root. */
  ancestor: string;
  /** The node below it carrying the same substance. */
  descendant: string;
};

/**
 * Every (substance, ancestor, descendant) pair where one node carries a
 * substance that also appears somewhere beneath it.
 */
export function findDuplicateFlows(rows: FlowOnNode[]): DuplicateFinding[] {
  const parentOf = new Map<number, number | null>();
  for (const r of rows) parentOf.set(r.component_id, r.parent_component_id);

  // Nodes carrying each substance.
  const bySubstance = new Map<number, { name: string; nodes: Map<number, string> }>();
  for (const r of rows) {
    if (!bySubstance.has(r.substance_id)) {
      bySubstance.set(r.substance_id, { name: r.substance_name, nodes: new Map() });
    }
    bySubstance.get(r.substance_id)!.nodes.set(r.component_id, r.component_name);
  }

  const isAncestorOf = (maybeAncestor: number, node: number): boolean => {
    let cur = parentOf.get(node) ?? null;
    const seen = new Set<number>(); // a malformed tree must not hang the run
    while (cur != null && !seen.has(cur)) {
      if (cur === maybeAncestor) return true;
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return false;
  };

  const out: DuplicateFinding[] = [];
  for (const { name, nodes } of bySubstance.values()) {
    const ids = [...nodes.keys()];
    if (ids.length < 2) continue;
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        if (isAncestorOf(a, b)) {
          out.push({
            substance_name: name,
            ancestor: nodes.get(a)!,
            descendant: nodes.get(b)!,
          });
        }
      }
    }
  }
  return out;
}

/** The warning text for a run, one line per finding. */
export function duplicateWarnings(rows: FlowOnNode[]): string[] {
  return findDuplicateFlows(rows).map(
    (d) =>
      `Possible double count: "${d.substance_name}" is on "${d.ancestor}" and again on ` +
      `"${d.descendant}" below it. Both are counted. Keep it on the step that consumes it, ` +
      `or confirm they are genuinely different amounts.`,
  );
}
