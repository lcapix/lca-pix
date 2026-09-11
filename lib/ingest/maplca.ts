// Mapping stage: ProcessModel -> LCAPIX plan. TS port of
// lcapix-ingest/ingest/maplca.py.
//
// Everything uncertain is surfaced: substance matches carry a similarity
// score, unit conversions name their factor, and anything unmapped lands in
// the review list instead of being silently dropped (the tool-review lesson:
// a flow that quietly contributes zero is the worst failure mode this
// product has).

import type { IngestCost, IngestNode, ProcessModel } from './schema';
import { validateProcessModel } from './schema';

// Unit conversions to the units LCAPIX factors actually use.
// [from_unit, substance_hint, to_unit, factor, note] — hint rules first.
const UNIT_CONVERSIONS: Array<[string, string | null, string, number, string]> = [
  ['mmbtu', 'natural gas', 'm3', 28.263, '1 MMBtu = 28.263 m3 natural gas (EIA heat content)'],
  ['mmbtu', null, 'kWh', 293.071, '1 MMBtu = 293.071 kWh'],
  ['lbs', null, 'kg', 0.45359237, '1 lb = 0.45359 kg'],
  ['lb', null, 'kg', 0.45359237, '1 lb = 0.45359 kg'],
  ['tgal', null, 'm3', 3.785411784, '1 thousand US gal = 3.7854 m3'],
  ['gal', null, 'm3', 0.003785411784, '1 US gal = 0.0037854 m3'],
  ['kwh', null, 'kWh', 1.0, ''],
  ['kg', null, 'kg', 1.0, ''],
  ['m3', null, 'm3', 1.0, ''],
];

export interface CatalogSubstance {
  substance_id: number;
  substance_name: string;
  unit?: string | null;
  factor_count?: number;
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
  const key = unit.trim().toLowerCase();
  const hint = substanceText.trim().toLowerCase();
  for (const [u, h, toU, f, note] of UNIT_CONVERSIONS) {
    if (u === key && h !== null && hint.includes(h)) {
      return { quantity: qty * f, unit: toU, note };
    }
  }
  for (const [u, h, toU, f, note] of UNIT_CONVERSIONS) {
    if (u === key && h === null) {
      return { quantity: qty * f, unit: toU, note };
    }
  }
  return { quantity: qty, unit, note: `NO CONVERSION RULE for '${unit}' — passed through` };
}

/**
 * Best catalog matches by name similarity. Same scoring and 0.55 accept
 * threshold as the CLI; additionally returns the top alternatives so the
 * review screen can offer an override instead of a blind yes/no.
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
  if (!scored.length || scored[0].score < 0.55) {
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
  for (const f of pm.flows) {
    const conv = convertIngestUnit(f.quantity, f.unit, f.substance_text);
    const { best, score, candidates } = matchSubstance(f.substance_text, substances);
    if (best === null) {
      plan.review.push(
        `UNMATCHED SUBSTANCE: '${f.substance_text}' (${f.node}) — best score ${score.toFixed(2)}; ` +
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
    plan.flows.push({
      node: f.node,
      substance_text: f.substance_text,
      substance_id: best ? best.substance_id : null,
      substance_name: best ? best.substance_name : null,
      match_score: Math.round(score * 1000) / 1000,
      candidates,
      direction: f.direction,
      quantity: Math.round(conv.quantity * 1000) / 1000,
      unit: conv.unit,
      conversion_note: conv.note,
      provenance: f.provenance ? `${f.provenance.doc} · ${f.provenance.locator}` : '',
    });
  }
  return plan;
}
