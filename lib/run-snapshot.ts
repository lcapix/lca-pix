/**
 * Run snapshots: freeze what a run actually computed.
 *
 * The engine's per-flow contributions (entered amount, the unit conversion it
 * applied, the factor VALUE and SCOPE it selected, and the resulting impact)
 * plus its warnings are serialized onto the run row at execution time.
 * Results pages then read the snapshot instead of recomputing from live
 * flows/factors — so a historical run keeps telling the truth after the model
 * or the factor table changes. That is the "same model, same numbers,
 * forever" guarantee an auditor expects.
 *
 * Pure module: build + parse only, no DB.
 */
import type { DataQualitySummary, LCAResult } from './lca-engine';

/**
 * ISO 14044 goal & scope the run was computed under (4.2). Frozen with the run
 * so a historical result always states what it was FOR (functional unit) and
 * what it COVERS (system boundary), even after the study is edited. Goal,
 * functional unit and boundary are study-level (project); the reference flow
 * and data basis belong to the case (one alternative).
 */
export interface GoalScope {
  goal_statement: string | null;
  functional_unit: string | null;
  system_boundary: string;
  boundary_notes: string | null;
  /** Amount of the case's product needed to fulfil one functional unit. */
  reference_flow: number;
  reference_flow_unit: string | null;
  /** Amount of that product the case's entered data produce (the data basis). */
  modeled_output: number;
  /** reference_flow / modeled_output: case total × this = result per functional unit. */
  per_fu_scale: number;
}

const positiveOr1 = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/** Result per functional unit = case total × this. Blank or non-positive inputs count as 1. */
export function perFunctionalUnitScale(referenceFlow: unknown, modeledOutput: unknown): number {
  return positiveOr1(referenceFlow) / positiveOr1(modeledOutput);
}

/** Assemble the frozen goal & scope from a project row and a case row (SELECT *). */
export function buildGoalScope(project: any, caseRow: any): GoalScope {
  const reference_flow = positiveOr1(caseRow?.reference_flow);
  const modeled_output = positiveOr1(caseRow?.modeled_output);
  return {
    goal_statement: project?.goal_statement ?? null,
    functional_unit: project?.functional_unit ?? null,
    system_boundary: project?.system_boundary ?? 'cradle-to-gate',
    boundary_notes: project?.boundary_notes ?? null,
    reference_flow,
    reference_flow_unit: caseRow?.reference_flow_unit ?? null,
    modeled_output,
    per_fu_scale: reference_flow / modeled_output,
  };
}

// v2 (2026-09-15): adds goal_scope (ISO 14044 4.2) and data_quality (4.2.3.6)
// to the frozen run, plus per-row source tier and allocation. v1 snapshots
// still parse: every v2 field is optional.
export const SNAPSHOT_VERSION = 2;

export interface SnapshotFlowRow {
  flow_id: number;
  component: string;
  substance: string;
  category_name: string;
  dir: 'IN' | 'OUT';
  amount: number;          // as entered
  unit: string;            // as entered
  factor: number;
  scope: string;           // geographic_scope the engine selected
  conversion: string | null; // e.g. "1 g = 0.001 kg" when applied
  impact: number;          // converted amount × factor (what was stored)
  /** Provenance tier of the factor used (v2). */
  source_tier?: string;
  /** The factor's cited source (driver_impact_factors.source_reference) (v2). */
  source?: string;
  /** Allocation factor applied to this row, when < 1 (v2). */
  allocation?: number;
}

export interface RunSnapshot {
  version: number;
  method: string;
  region: string;
  captured_at: string;
  warnings: string[];
  flow_detail: SnapshotFlowRow[];
  /** Goal & scope the run was computed under (v2). */
  goal_scope?: GoalScope | null;
  /** Data-quality statement for the run (v2). */
  data_quality?: DataQualitySummary | null;
}

export function buildRunSnapshot(
  result: LCAResult,
  method: string,
  region: string,
  goalScope: GoalScope | null = null,
): RunSnapshot {
  const flow_detail: SnapshotFlowRow[] = [];
  for (const comp of result.component_results) {
    for (const f of comp.flow_contributions) {
      flow_detail.push({
        flow_id: f.flow_id,
        component: comp.component_name,
        substance: f.substance_name,
        category_name: f.category_name,
        dir: f.flow_type === 'input' ? 'IN' : 'OUT',
        amount: f.quantity,
        unit: f.unit,
        factor: f.characterization_factor,
        scope: f.geographic_scope ?? 'Global',
        conversion: f.unit_conversion ?? null,
        impact: f.impact_contribution,
        ...(f.source_tier ? { source_tier: f.source_tier } : {}),
        ...(f.factor_source ? { source: f.factor_source } : {}),
        ...(f.allocation_factor != null && f.allocation_factor < 1
          ? { allocation: f.allocation_factor }
          : {}),
      });
    }
  }
  return {
    version: SNAPSHOT_VERSION,
    method,
    region,
    captured_at: new Date().toISOString(),
    warnings: result.warnings,
    flow_detail,
    goal_scope: goalScope,
    data_quality: result.data_quality ?? null,
  };
}

/** Tolerant parse: MySQL JSON columns may come back as objects or strings. */
export function parseRunSnapshot(raw: unknown): RunSnapshot | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object' || !Array.isArray((obj as any).flow_detail)) return null;
    return obj as RunSnapshot;
  } catch {
    return null;
  }
}
