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

import { unitFamily } from '@/lib/units';

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

/**
 * The stage a flow's burden belongs to (ISO 14040/14044): a person's own
 * setting wins; else a material going in (measured by mass, count or area, and
 * not an emission) is Materials, because its burden is the extraction and
 * making of the material; energy, volumes (gas, water), transport and every
 * output follow the step's own stage.
 */
export function flowStage(f: {
  explicit?: string | null;
  stepStage?: string | null;
  direction: string;
  substanceUnit?: string | null;
  unit?: string | null;
  substanceCategory?: string | null;
}): StageId {
  const own = String(f.explicit ?? '').trim().toLowerCase();
  if ((STAGE_IDS as string[]).includes(own)) return own as StageId;
  const fam = unitFamily(f.substanceUnit) ?? unitFamily(f.unit);
  const category = String(f.substanceCategory ?? '').toLowerCase();
  const isInput = String(f.direction).toLowerCase().startsWith('in');
  if (isInput && !category.startsWith('emission') && (fam === 'mass' || fam === 'count' || fam === 'area')) return 'materials';
  return stageOf(f.stepStage);
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

/**
 * One category by stage, from a run's frozen flows: each flow counts in its
 * own stage (materials going in under Materials, the step's energy under the
 * step's stage). Null when no flow carries a stage (a run made before flows
 * had stages): the caller then splits by step, as that run always did.
 */
export function stageRowsFromFlows(
  flows: Array<{ stage?: string | null; category_name: string; impact: number }>,
  category: string,
): Array<{ stage: StageId; value: number; flows: number }> | null {
  if (!flows.some((f) => f.stage)) return null;
  const out = new Map<StageId, { stage: StageId; value: number; flows: number }>();
  for (const f of flows) {
    if (f.category_name !== category) continue;
    const st = stageOf(f.stage);
    const row = out.get(st) ?? { stage: st, value: 0, flows: 0 };
    row.value += Number(f.impact) || 0;
    row.flows += 1;
    out.set(st, row);
  }
  return [...out.values()];
}
