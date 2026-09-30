// Mapping stage: ProcessModel -> LCAPIX plan. TS port of
// lcapix-ingest/ingest/maplca.py.
//
// Everything uncertain is surfaced: substance matches carry a similarity
// score, unit conversions name their factor, and anything unmapped lands in
// the review list instead of being silently dropped (the tool-review lesson:
// a flow that quietly contributes zero is the worst failure mode this
// product has).

import type { IngestCost, IngestNode, ProcessModel } from './schema';
import { processModelWarnings, validateProcessModel } from './schema';
import { convertQuantity, normalizeUnit, unitFamily, unitProblem } from '@/lib/units';

// Unit handling at mapping time reads every spelling through lib/units, the
// same reader the engine uses, so 'Mg' is never taken for 'mg' and 'm³' is m3.
// Masses go to kg and volumes to m3 (the bases most factors are stated per);
// other known units keep their canonical name, and the engine converts them
// to the factor's unit later. The one substance-specific rule is the heat
// content of natural gas: its factor is per m3, the documents say MMBtu.
// Other fuels (coal, LPG, fuel oil, wood) stay in MMBtu: their substances carry
// per-MMBtu factors (migrate-011).
const NATURAL_GAS_M3_PER_MMBTU = 28.263;
const FAMILY_TARGET: Partial<Record<string, string>> = { mass: 'kg', volume: 'm3' };

export interface CatalogSubstance {
  substance_id: number;
  substance_name: string;
  unit?: string | null;
  /** 'resource', 'emission_air', 'emission_water', 'waste', or blank. */
  category?: string | null;
  factor_count?: number;
}

/**
 * An input (a material, energy or service the step consumes) is never an
 * emission, so emission and waste substances are not candidates for it: a
 * name that merely looks alike ("Argon" ~ "Acrolein") must not turn a gas
 * input into a toxic air emission. Outputs may be either.
 */
function candidatesFor(direction: string, substances: CatalogSubstance[]): CatalogSubstance[] {
  if (direction !== 'input') return substances;
  return substances.filter((s) => !/^(emission|waste)/i.test(s.category ?? ''));
}

export interface SubstanceCandidate {
  substance_id: number;
  substance_name: string;
  score: number;
  factor_count?: number;
}

export interface MappedFlow {
  node: string;
  substance_text: string;
  substance_id: number | null;
  substance_name: string | null;
  match_score: number;
  candidates: SubstanceCandidate[]; // top alternatives for the review screen
  direction: string;
  quantity: number;
  unit: string;
  conversion_note: string;
  provenance: string;
  /** false when the flow's unit can't convert to the matched substance's factor
   *  unit — the flow would be HELD at apply. Surfaced in the review screen. */
  unit_compatible: boolean;
  /** The line as the document names it (a BOM part) and any step it names. */
  label?: string;
  op_hint?: string;
  /** Append mode: the existing step chosen for this line at review. */
  attach_component_id?: number | null;
}

export interface IngestPlan {
  case_name: string;
  nodes: IngestNode[];
  flows: MappedFlow[];
  costs: IngestCost[];
  review: string[]; // human-attention items
  notes: string[];
}

// difflib.SequenceMatcher.ratio() — Ratcliff-Obershelp: 2*M/T where M is the
// total length of matched blocks found by recursively taking the longest
// common substring. Ported so match scores stay identical to the proven CLI.
export function sequenceRatio(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const matches = matchedLength(a, 0, a.length, b, 0, b.length);
  return (2 * matches) / (a.length + b.length);
}

function matchedLength(
  a: string, aLo: number, aHi: number,
  b: string, bLo: number, bHi: number
): number {
  // Longest common substring within the windows.
  let bestI = aLo, bestJ = bLo, bestSize = 0;
  // j2len[j] = length of longest suffix of a[..i] and b[..j]
  let j2len = new Map<number, number>();
  for (let i = aLo; i < aHi; i++) {
    const newJ2len = new Map<number, number>();
    for (let j = bLo; j < bHi; j++) {
      if (a[i] === b[j]) {
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newJ2len.set(j, k);
        if (k > bestSize) {
          bestSize = k;
          bestI = i - k + 1;
          bestJ = j - k + 1;
        }
      }
    }
    j2len = newJ2len;
  }
  if (bestSize === 0) return 0;
  return (
    bestSize +
    matchedLength(a, aLo, bestI, b, bLo, bestJ) +
    matchedLength(a, bestI + bestSize, aHi, b, bestJ + bestSize, bHi)
  );
}

export function convertIngestUnit(
  qty: number,
  unit: string,
  substanceText: string
): { quantity: number; unit: string; note: string } {
  const canonical = normalizeUnit(unit);
  if (!canonical) {
    // Unknown or ambiguous: never guessed, flagged for review.
    return {
      quantity: qty,
      unit,
      note: `NO CONVERSION RULE for '${unit}' (${unitProblem(unit)}) — passed through`,
    };
  }
  if (canonical === 'MMBtu' && substanceText.trim().toLowerCase().includes('natural gas')) {
    return {
      quantity: qty * NATURAL_GAS_M3_PER_MMBTU,
      unit: 'm3',
      note: `1 MMBtu = ${NATURAL_GAS_M3_PER_MMBTU} m3 natural gas (EIA heat content)`,
    };
  }
  const target = FAMILY_TARGET[unitFamily(unit) ?? ''] ?? canonical;
  const conv = convertQuantity(qty, unit, target);
  if (!conv) return { quantity: qty, unit, note: `NO CONVERSION RULE for '${unit}' — passed through` };
  return { quantity: conv.quantity, unit: conv.toUnit, note: conv.factor === 1 ? '' : conv.note };
}

/** Lowest similarity accepted as a (low-confidence) match. */
export const MATCH_ACCEPT = 0.7;

/**
 * Best catalog matches by name similarity. Same scoring as the CLI, with a
 * stricter accept threshold (MATCH_ACCEPT); additionally returns the top
 * alternatives so the review screen can offer an override instead of a blind
 * yes/no.
 */
export function matchSubstance(
  text: string,
  substances: CatalogSubstance[],
  topN = 3
): { best: CatalogSubstance | null; score: number; candidates: SubstanceCandidate[] } {
  const t = text.toLowerCase();
  const scored: Array<{ score: number; s: CatalogSubstance }> = substances.map((s) => {
    const name = s.substance_name.toLowerCase();
    let score = sequenceRatio(t, name);
    if (name.startsWith(t) || name.includes(t)) score = Math.max(score, 0.85);
    return { score, s };
  });
  scored.sort((x, y) => y.score - x.score || x.s.substance_id - y.s.substance_id);
  const candidates = scored.slice(0, topN).map(({ score, s }) => ({
    substance_id: s.substance_id,
    substance_name: s.substance_name,
    score: Math.round(score * 1000) / 1000,
    factor_count: s.factor_count,
  }));
  // 0.70, not the CLI's 0.55: at 0.55 a short name matched whatever shared
  // three letters ("Argon" → "Cast iron", "Electric motor" → "Electricity").
  // Below it the line is shown unmatched, with the alternatives to pick from.
  if (!scored.length || scored[0].score < MATCH_ACCEPT) {
    return { best: null, score: scored.length ? scored[0].score : 0, candidates };
  }
  return { best: scored[0].s, score: scored[0].score, candidates };
}

export function mapModel(pm: ProcessModel, substances: CatalogSubstance[]): IngestPlan {
  const errors = validateProcessModel(pm);
  const plan: IngestPlan = {
    case_name: pm.case_name,
    nodes: [],
    flows: [],
    costs: [],
    review: [],
    notes: [...pm.notes],
  };
  if (errors.length) {
    plan.review.push(...errors.map((e) => `STRUCTURE: ${e}`));
    return plan;
  }
  plan.nodes = [...pm.nodes];
  plan.costs = [...pm.costs];
  plan.review.push(...processModelWarnings(pm).map((w) => `STRUCTURE WARNING: ${w}`));
  for (const f of pm.flows) {
    const conv = convertIngestUnit(f.quantity, f.unit, f.substance_text);
    const { best, score, candidates } = matchSubstance(
      f.substance_text,
      candidatesFor(f.direction, substances)
    );
    if (best === null) {
      plan.review.push(
        // The document's own line name: in append mode f.node is only the
        // connector's placeholder step, not where the line will go.
        `UNMATCHED SUBSTANCE: '${f.substance_text}' (${f.label || f.node}) — best score ${score.toFixed(2)}; ` +
          'flow held back, NOT silently dropped'
      );
    }
    if (conv.note.includes('NO CONVERSION RULE')) {
      plan.review.push(`UNIT: ${conv.note} (${f.substance_text} on ${f.node})`);
    }
    if (best !== null && score < 0.9) {
      plan.review.push(
        `LOW-CONFIDENCE MATCH (${score.toFixed(2)}): '${f.substance_text}' -> ` +
          `'${best.substance_name}' (id ${best.substance_id}) — confirm`
      );
    }
    if (best !== null && (best.factor_count ?? 1) === 0) {
      plan.review.push(
        `NO IMPACT DATA: matched '${best.substance_name}' has zero characterization factors — ` +
          `this flow would contribute 0 to every category`
      );
    }
    // Unit-compatibility guard (finding 1b): if the matched substance's factor
    // unit can't be reached from the flow's unit, the flow will be HELD at apply.
    // Surface it here so the user sees it BEFORE applying, not as a silent drop.
    let unitCompatible = true;
    if (best) {
      const factorUnit = best.unit ?? null;
      if (factorUnit && !convertQuantity(1, conv.unit, factorUnit)) {
        unitCompatible = false;
        plan.review.push(
          `UNIT MISMATCH: '${f.substance_text}' (${f.label || f.node}) is in '${conv.unit}' but ` +
            `'${best.substance_name}' factors are in '${factorUnit}' — WILL BE HELD unless you ` +
            `pick a substance whose unit is compatible`
        );
      }
    }
    plan.flows.push({
      node: f.node,
      substance_text: f.substance_text,
      substance_id: best ? best.substance_id : null,
      substance_name: best ? best.substance_name : null,
      match_score: Math.round(score * 1000) / 1000,
      candidates,
      direction: f.direction,
      // Full precision (ING-1): rounding to 3 decimals turned anything below
      // 0.0005 into a stored zero flow. Display rounding belongs to the UI.
      quantity: conv.quantity,
      unit: conv.unit,
      conversion_note: conv.note,
      provenance: f.provenance ? `${f.provenance.doc} · ${f.provenance.locator}` : '',
      unit_compatible: unitCompatible,
      label: f.label,
      op_hint: f.op_hint,
      // A connector that already knows the step (equipment → its work center).
      attach_component_id: f.attach_component_id ?? undefined,
    });
  }
  return plan;
}
