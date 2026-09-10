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
import type { LCAResult } from './lca-engine';

export const SNAPSHOT_VERSION = 1;

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
}

export interface RunSnapshot {
  version: number;
  method: string;
  region: string;
  captured_at: string;
  warnings: string[];
  flow_detail: SnapshotFlowRow[];
}

export function buildRunSnapshot(
  result: LCAResult,
  method: string,
  region: string,
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
