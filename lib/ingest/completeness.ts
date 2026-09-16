// Case completeness checker — which LAYERS of a comprehensive product case are
// present, and which document would fill each gap. This is the "you have
// materials but no process energy — add a utility bill" intelligence, and the
// backward-facing twin of the case-assembly checklist. Reads the doc-type
// registry so the suggested documents stay in one place.

import {
  EXPECTED_LAYERS,
  LAYER_LABEL,
  docsForLayer,
  type CaseLayer,
} from './doc-types';
import { classifyEnergyCarrier } from '@/lib/integrations/reference-rates';

export interface CompletenessComponent {
  tier?: string | null;
  labor_cost?: number | string | null;
  energy_cost?: number | string | null;
  material_cost?: number | string | null;
  transportation_cost?: number | string | null;
  overhead_cost?: number | string | null;
  equipment_cost?: number | string | null;
  opex?: number | string | null;
  capex?: number | string | null;
}

export interface CompletenessFlow {
  substance_name?: string | null;
  direction?: string | null; // 'input' | 'output'
  unit?: string | null;
}

const nz = (v: unknown): boolean => (Number(v ?? 0) || 0) !== 0;

function isTransportFlow(f: CompletenessFlow): boolean {
  // Freight is quantified in tonne-km; key on the unit so a material named
  // "shipping crate" is not bucketed into the transport layer.
  return (f.unit || '').toLowerCase().replace(/\s/g, '') === 'tkm';
}

/** Which layers a case actually contains, from its components and flows. */
export function analyzeCaseLayers(
  components: CompletenessComponent[],
  flows: CompletenessFlow[],
): Set<CaseLayer> {
  const present = new Set<CaseLayer>();

  // Skeleton: real process depth (an operation tier, or several tiers).
  const tiers = new Set(components.map((c) => (c.tier || '').toLowerCase()));
  if (tiers.has('operation') || tiers.has('subprocess') || tiers.size >= 3) {
    present.add('skeleton');
  }

  for (const f of flows) {
    const dir = (f.direction || '').toLowerCase();
    if (dir === 'output') {
      present.add('emissions');
      continue;
    }
    // Inputs: transport, energy, or material.
    if (isTransportFlow(f)) {
      present.add('transport');
    } else if (classifyEnergyCarrier(f.substance_name)) {
      present.add('energy');
    } else {
      present.add('materials');
    }
  }

  // Costs: any non-zero cost column anywhere.
  const hasCost = components.some(
    (c) =>
      nz(c.labor_cost) ||
      nz(c.energy_cost) ||
      nz(c.material_cost) ||
      nz(c.transportation_cost) ||
      nz(c.overhead_cost) ||
      nz(c.equipment_cost) ||
      nz(c.opex) ||
      nz(c.capex),
  );
  if (hasCost) present.add('costs');

  return present;
}

export interface CompletenessReport {
  present: CaseLayer[];
  missing: Array<{ layer: CaseLayer; label: string; suggestedDocs: string[] }>;
  /** 0..1 share of expected layers present. */
  score: number;
}

/** Compare a case's layers against the expected set for a full product case. */
export function completenessReport(present: Set<CaseLayer>): CompletenessReport {
  const missing = EXPECTED_LAYERS.filter((l) => !present.has(l)).map((layer) => ({
    layer,
    label: LAYER_LABEL[layer],
    // Only documents we can import today; a layer with none is entered by hand.
    suggestedDocs: docsForLayer(layer)
      .filter((d) => d.status === 'live')
      .map((d) => d.label),
  }));
  return {
    present: EXPECTED_LAYERS.filter((l) => present.has(l)),
    missing,
    score: (EXPECTED_LAYERS.length - missing.length) / EXPECTED_LAYERS.length,
  };
}

/** Convenience: analyze + report in one call. */
export function assessCompleteness(
  components: CompletenessComponent[],
  flows: CompletenessFlow[],
): CompletenessReport {
  return completenessReport(analyzeCaseLayers(components, flows));
}
