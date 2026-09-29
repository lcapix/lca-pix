/**
 * Life-cycle stages.
 *
 * Until now every case was manufacturing only, so the first question a design
 * course asks — "what about the use phase?" — had no answer in the model. A
 * stage is a label on a process step, not a second tree: the engine groups
 * results by it, the report prints the split, and the boundary declared in
 * goal & scope says which stages a reader should expect to see.
 *
 * Pure module: no database, fully unit-testable.
 */

export type StageId = 'materials' | 'production' | 'distribution' | 'use' | 'end_of_life';

export type Stage = {
  id: StageId;
  label: string;
  /** What belongs here, said the way a student would check it. */
  hint: string;
};

/** Cradle to grave, in order. Reports and charts follow this order. */
export const STAGES: Stage[] = [
  {
    id: 'materials',
    label: 'Materials',
    hint: 'Producing the materials you buy in, before they reach your gate.',
  },
  {
    id: 'production',
    label: 'Production',
    hint: 'Making the product: the process steps in your own plant.',
  },
  {
    id: 'distribution',
    label: 'Distribution',
    hint: 'Moving the product to whoever uses it, and its packaging.',
  },
  {
    id: 'use',
    label: 'Use',
    hint: 'What the product consumes while it does its job: power, water, consumables, servicing.',
  },
  {
    id: 'end_of_life',
    label: 'End of life',
    hint: 'What happens to it afterwards: landfill, incineration, recycling, reuse.',
  },
];

export const STAGE_IDS = STAGES.map((s) => s.id);

/**
 * A step with no stage is read as production. Every case built before stages
 * existed is a plant model, so that is the honest default, not a guess.
 */
export function stageOf(value?: string | null): StageId {
  const v = String(value ?? '').trim().toLowerCase();
  return (STAGE_IDS as string[]).includes(v) ? (v as StageId) : 'production';
}

export function stageLabel(id?: string | null): string {
  const s = stageOf(id);
  return STAGES.find((x) => x.id === s)?.label ?? 'Production';
}

/** The stages a declared boundary covers. */
export function stagesInBoundary(boundary?: string | null): StageId[] {
  const b = String(boundary ?? '').trim().toLowerCase();
  if (b.includes('grave') || b.includes('cradle-to-grave')) return [...STAGE_IDS];
  if (b.includes('gate-to-gate')) return ['production'];
  if (b.includes('cradle-to-gate') || b === '') return ['materials', 'production'];
  // Anything else stated in words: assume the two stages a gate study always has.
  return ['materials', 'production'];
}

export type StagePresence = { stage: StageId; steps: number; flows: number };

/**
 * What the model claims versus what it contains. A study that says
 * cradle-to-grave and has nothing in Use or End of life is not cradle-to-grave,
 * and saying so is the whole point of declaring a boundary.
 */
export function boundaryGaps(
  boundary: string | null | undefined,
  present: StagePresence[],
): { missing: StageId[]; outside: StageId[] } {
  const expected = stagesInBoundary(boundary);
  const withFlows = new Set(present.filter((p) => p.flows > 0).map((p) => p.stage));

  return {
    // Declared but empty: the reader would expect numbers here and find none.
    missing: expected.filter((s) => !withFlows.has(s)),
    // Modelled but outside the declared boundary: the boundary is wrong, or the
    // step is. Either way the report should not quietly include it.
    outside: [...withFlows].filter((s) => !expected.includes(s)),
  };
}

/** Group any per-step numbers into stage totals, in life-cycle order. */
export function groupByStage<T extends { stage?: string | null; value: number }>(
  rows: T[],
): Array<{ stage: StageId; label: string; value: number; share: number }> {
  const totals = new Map<StageId, number>();
  for (const r of rows) {
    const s = stageOf(r.stage);
    totals.set(s, (totals.get(s) ?? 0) + (Number(r.value) || 0));
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return STAGE_IDS.filter((s) => totals.has(s)).map((s) => ({
    stage: s,
    label: stageLabel(s),
    value: totals.get(s) ?? 0,
    share: sum > 0 ? (totals.get(s) ?? 0) / sum : 0,
  }));
}
