/**
 * Matching a document's steps against the steps a case already has.
 *
 * Appending a BOM or an equipment list is easy: those are lines that belong on
 * steps that already exist. Appending a ROUTING is not, because a routing's
 * payload IS the steps. Until now append mode ignored the hierarchy entirely
 * (the review screen said "context — not created"), so re-importing a routing
 * onto a live case added nothing.
 *
 * Creating them blindly is worse: a second routing would give a case two
 * "70. Final assembly" steps and double its hours. So each step is matched, the
 * reviewer sees the match and its reason, and nothing is created without a
 * decision.
 *
 * Pure module: no database, fully unit-testable.
 */

export type ExistingStep = {
  component_id: number;
  component_name: string;
  /** Null for the case's own product root. */
  parent_component_id?: number | null;
};

export type StepMatch = {
  /** The step as the document names it. */
  node: string;
  /** The existing step it most likely is, if any. */
  component_id: number | null;
  component_name: string | null;
  /** Why we think so — shown to the reviewer, never hidden. */
  reason: 'exact name' | 'same step number' | 'same name, different step number' | 'no match';
  /** What happens unless the reviewer changes it. */
  suggested: 'attach' | 'create';
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** "70. Final assembly" → "70"; "Op 70 — assembly" → "70"; "Welding" → null. */
export function stepNumber(name: string): string | null {
  const m = name.trim().match(/^(?:op(?:eration)?\s*)?(\d{1,4})\b/i);
  return m ? String(Number(m[1])) : null;
}

/** The name with any leading step number removed. */
export function stepTitle(name: string): string {
  return norm(name.replace(/^(?:op(?:eration)?\s*)?\d{1,4}\s*[.):\-–—]?\s*/i, ''));
}

export function matchSteps(
  nodes: Array<{ name: string; parent?: string | null }>,
  existing: ExistingStep[],
): StepMatch[] {
  const taken = new Set<number>();

  const findBy = (pred: (e: ExistingStep) => boolean): ExistingStep | undefined =>
    existing.find((e) => !taken.has(e.component_id) && pred(e));

  // The case already has a product. A second document's root is the same
  // product under another name (usually the file's), so it attaches to the
  // existing root rather than creating a second product inside one case.
  const existingRoot = existing.find((e) => e.parent_component_id == null);

  return nodes.map((n) => {
    if (n.parent === null && existingRoot && !taken.has(existingRoot.component_id)) {
      taken.add(existingRoot.component_id);
      return {
        node: n.name,
        component_id: existingRoot.component_id,
        component_name: existingRoot.component_name,
        reason: 'exact name',
        suggested: 'attach',
      };
    }
    const num = stepNumber(n.name);
    const title = stepTitle(n.name);

    // 1. The same name, exactly. The common case when a routing is re-imported.
    let hit = findBy((e) => norm(e.component_name) === norm(n.name));
    let reason: StepMatch['reason'] = 'exact name';

    // 2. The same step number. Routings keep op sequence even when the wording
    //    drifts ("70. Final assembly" vs "70 Final assy").
    if (!hit && num) {
      hit = findBy((e) => stepNumber(e.component_name) === num);
      reason = 'same step number';
    }

    // 3. The same words, a different number. Worth proposing, and worth saying
    //    out loud, because renumbering is how two routings disagree.
    if (!hit && title) {
      hit = findBy((e) => stepTitle(e.component_name) === title);
      reason = 'same name, different step number';
    }

    if (hit) {
      taken.add(hit.component_id);
      return {
        node: n.name,
        component_id: hit.component_id,
        component_name: hit.component_name,
        reason,
        suggested: 'attach',
      };
    }

    return {
      node: n.name,
      component_id: null,
      component_name: null,
      reason: 'no match',
      suggested: 'create',
    };
  });
}
