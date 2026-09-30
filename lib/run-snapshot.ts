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
// v3 (2026-09-29, audit RUN-1 / STAGE-2 / EXP-1): the run's results are frozen
// too, not only its flow detail: per-category totals, one row per step (id,
// name, parent, stage, per-category values, the costs in force) and the
// inventory as entered. Results, stages and exports read these instead of
// joining the live component table, so deleting or renaming a step no longer
// rewrites history. Flow-detail rows carry component_id, so two steps with the
// same name never collide. v1/v2 snapshots still parse; readers fall back to
// the stored assessment_results rows for them (labelled as recomputed).
export const SNAPSHOT_VERSION = 3;

/** Label for results a legacy run (no v3 snapshot) rebuilds from live tables. */
export const LEGACY_RESULTS_SOURCE = 'recomputed from current data';

/** Shown (and frozen with the run) when no step carries any flow. */
export const ZERO_INVENTORY_WARNING =
  'No process step in this case has any input or output flows yet. The assessment ran, but every impact is 0. Add at least one flow on an operation and re-run.';

/**
 * Impact-assessment methods a run may use: the method_name values that carry
 * characterization factors in driver_impact_factors. Anything else produced
 * an all-zero "completed" run (RUN-6).
 */
export const SUPPORTED_METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'] as const;
export type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

/** Canonical method name, or null when the input is not a supported method. */
export function canonicalMethod(input: unknown): SupportedMethod | null {
  if (typeof input !== 'string') return null;
  const key = input.trim().toLowerCase();
  return SUPPORTED_METHODS.find((m) => m.toLowerCase() === key) ?? null;
}

export interface SnapshotFlowRow {
  flow_id: number;
  /** The step this row belongs to (v3). Older snapshots key by name only. */
  component_id?: number;
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

/** Case total for one impact category (v3). */
export interface SnapshotTotal {
  category_id: number;
  category_name: string;
  value: number;
  unit: string;
  flow_count: number;
}

/** A step's own result in one category (v3). */
export interface SnapshotStepImpact {
  category_id: number;
  category_name: string;
  value: number;
  unit: string;
}

/** The cost columns of a step when the run was made (v3). Null = not entered. */
export interface SnapshotStepCosts {
  labor: number | null;
  energy: number | null;
  material: number | null;
  transportation: number | null;
  equipment: number | null;
  overhead: number | null;
  opex: number | null;
  capex: number | null;
  currency: string | null;
}

/** One process step as it stood when the run was made (v3). */
export interface SnapshotStep {
  component_id: number;
  name: string;
  parent_id: number | null;
  /** component_type: product, machine_line, subprocess, operation, elemental_task. */
  type: string;
  /** Descriptive process type shown in the UI. */
  process_type: string | null;
  hierarchy_level: number;
  /** Life-cycle stage (migrate-022); null reads as production. */
  stage: string | null;
  quantity: number | null;
  unit: string | null;
  /** Distinct flows of this step that a factor characterized in the run. */
  flows_processed: number;
  impacts: SnapshotStepImpact[];
  costs: SnapshotStepCosts;
}

/** One flow of the inventory as entered, characterized or not (v3). */
export interface SnapshotInventoryRow {
  flow_id: number;
  component_id: number;
  component: string;
  substance: string;
  direction: 'input' | 'output';
  amount: number;
  unit: string;
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
  /** Per-category case totals (v3). */
  totals?: SnapshotTotal[];
  /** Every step of the case at run time, with its results and costs (v3). */
  steps?: SnapshotStep[];
  /** Every flow of the case at run time, as entered (v3). */
  inventory?: SnapshotInventoryRow[];
}

/** Rows read inside the run's transaction, frozen alongside the engine result. */
export interface FrozenInputs {
  /** `SELECT * FROM component WHERE case_id = ?` */
  components?: any[];
  /** Flows of the case with the substance name: flow_id, component_id,
   *  component_name, substance_name, flow_type, quantity, unit. */
  flows?: any[];
}

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const numOr0 = (v: unknown): number => numOrNull(v) ?? 0;

export function buildRunSnapshot(
  result: LCAResult,
  method: string,
  region: string,
  goalScope: GoalScope | null = null,
  frozen: FrozenInputs = {},
): RunSnapshot {
  const flow_detail: SnapshotFlowRow[] = [];
  for (const comp of result.component_results) {
    for (const f of comp.flow_contributions) {
      flow_detail.push({
        flow_id: f.flow_id,
        component_id: comp.component_id,
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

  const totals: SnapshotTotal[] = result.total_impacts.map((t) => ({
    category_id: t.category_id,
    category_name: t.category_name,
    value: t.impact_value,
    unit: t.unit,
    flow_count: t.flow_count,
  }));

  // Steps: every component of the case (the tree the report prints), with the
  // engine's per-category values on the ones that carried flows. Without the
  // component rows (older callers), the steps the engine computed are enough.
  const resultById = new Map(result.component_results.map((r) => [r.component_id, r]));
  const rows: any[] = frozen.components?.length
    ? [...frozen.components]
    : result.component_results.map((r) => ({
        component_id: r.component_id,
        component_name: r.component_name,
        component_type: r.component_type,
        hierarchy_level: r.hierarchy_level,
        life_cycle_stage: r.life_cycle_stage ?? null,
      }));
  rows.sort(
    (a, b) =>
      numOr0(a.hierarchy_level) - numOr0(b.hierarchy_level) ||
      numOr0(a.component_id) - numOr0(b.component_id),
  );
  const steps: SnapshotStep[] = rows.map((c) => {
    const id = Number(c.component_id);
    const r = resultById.get(id);
    return {
      component_id: id,
      name: String(c.component_name ?? r?.component_name ?? ''),
      parent_id: numOrNull(c.parent_component_id),
      type: String(c.component_type ?? r?.component_type ?? ''),
      process_type: c.process_type ?? null,
      hierarchy_level: numOr0(c.hierarchy_level ?? r?.hierarchy_level),
      stage: c.life_cycle_stage ?? r?.life_cycle_stage ?? null,
      quantity: numOrNull(c.quantity),
      unit: c.unit ?? null,
      flows_processed: new Set((r?.flow_contributions ?? []).map((f) => f.flow_id)).size,
      impacts: (r?.impacts ?? []).map((i) => ({
        category_id: i.category_id,
        category_name: i.category_name,
        value: i.impact_value,
        unit: i.unit,
      })),
      costs: {
        labor: numOrNull(c.labor_cost),
        energy: numOrNull(c.energy_cost),
        material: numOrNull(c.material_cost),
        transportation: numOrNull(c.transportation_cost),
        equipment: numOrNull(c.equipment_cost),
        overhead: numOrNull(c.overhead_cost),
        opex: numOrNull(c.opex),
        capex: numOrNull(c.capex),
        currency: c.currency ?? null,
      },
    };
  });

  const inventory: SnapshotInventoryRow[] = (frozen.flows ?? []).map((f) => ({
    flow_id: Number(f.flow_id),
    component_id: Number(f.component_id),
    component: String(f.component_name ?? ''),
    substance: String(f.substance_name ?? `Substance #${f.substance_id ?? '?'}`),
    direction: f.flow_type === 'output' ? 'output' : 'input',
    amount: numOr0(f.quantity),
    unit: String(f.unit ?? ''),
  }));

  // RUN-6: the "nothing to compute" warning belongs to the run, so it is still
  // there when the results page refetches the run.
  const warnings = [
    ...(result.summary.components_with_flows === 0 ? [ZERO_INVENTORY_WARNING] : []),
    ...result.warnings,
  ];

  return {
    version: SNAPSHOT_VERSION,
    method,
    region,
    captured_at: new Date().toISOString(),
    warnings,
    flow_detail,
    goal_scope: goalScope,
    data_quality: result.data_quality ?? null,
    totals,
    steps,
    inventory,
  };
}

// ---------------------------------------------------------------------------
// Readers: what the results screen, the run API and the exports show for a
// frozen (v3) run. Every one of them reads the snapshot only.
// ---------------------------------------------------------------------------

/** True when the run froze its totals and steps (v3 and later). */
export function hasFrozenResults(
  snap: RunSnapshot | null | undefined,
): snap is RunSnapshot & { totals: SnapshotTotal[]; steps: SnapshotStep[] } {
  return !!snap && Array.isArray(snap.totals) && Array.isArray(snap.steps);
}

/** Case totals keyed by category name. */
export function snapshotImpacts(snap: RunSnapshot): Record<string, { value: number; unit: string }> {
  const out: Record<string, { value: number; unit: string }> = {};
  for (const t of snap.totals ?? []) out[t.category_name] = { value: t.value, unit: t.unit };
  return out;
}

/** The steps that produced a result, in the shape the results API returns. */
export function snapshotComponentBreakdown(snap: RunSnapshot) {
  return (snap.steps ?? [])
    .filter((s) => s.impacts.length > 0)
    .map((s) => ({
      component_id: s.component_id,
      component_name: s.name,
      component_type: s.type,
      process_type: s.process_type,
      parent_component_id: s.parent_id,
      life_cycle_stage: s.stage,
      flows_processed: s.flows_processed,
      impacts: s.impacts.map((i) => ({
        category_id: i.category_id,
        category_name: i.category_name,
        impact_value: i.value,
        unit: i.unit,
      })),
    }));
}

/** One row per (step, category), ordered by category then tree level. */
export function snapshotResultRows(snap: RunSnapshot) {
  const rows = (snap.steps ?? []).flatMap((s) =>
    s.impacts.map((i) => ({
      component_id: s.component_id,
      component_name: s.name,
      hierarchy_level: s.hierarchy_level,
      life_cycle_stage: s.stage,
      category_id: i.category_id,
      category_name: i.category_name,
      impact_value: i.value,
      unit: i.unit,
    })),
  );
  return rows.sort(
    (a, b) =>
      a.category_id - b.category_id ||
      a.hierarchy_level - b.hierarchy_level ||
      a.component_id - b.component_id,
  );
}

/**
 * The report's inventory and results (PDF / PPTX / CSV) from the snapshot, or
 * null for a run made before v3 (the export then reads live tables and says so).
 */
export function snapshotReportParts(snap: RunSnapshot | null | undefined) {
  if (!hasFrozenResults(snap)) return null;
  return {
    components: snap.steps.map((s) => ({
      component_id: s.component_id,
      component_name: s.name,
      component_type: s.type,
      hierarchy_level: s.hierarchy_level,
      quantity: s.quantity ?? '',
      unit: s.unit ?? '',
      opex: s.costs.opex,
      capex: s.costs.capex,
      life_cycle_stage: s.stage,
    })),
    results: snapshotResultRows(snap).map((r) => ({
      component_id: r.component_id,
      component_name: r.component_name,
      category_name: r.category_name,
      impact_value: r.impact_value,
      unit: r.unit,
    })),
    total_impacts: snap.totals.map((t) => ({
      category_name: t.category_name,
      total_value: t.value,
      unit: t.unit,
    })),
    flows: (snap.inventory ?? []).map((f) => ({
      component_id: f.component_id,
      component_name: f.component,
      substance_name: f.substance,
      direction: f.direction,
      amount: f.amount,
      unit: f.unit,
    })),
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

// ---------------------------------------------------------------------------
// Row-level CSV export of a run (the inventory as the engine computed it).
// ---------------------------------------------------------------------------

const NUMERIC_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * One CSV cell. Text a spreadsheet would run as a formula (a leading = + - @,
 * tab or carriage return; security audit L5) is prefixed with an apostrophe.
 * Real numbers, negative and scientific included, are left as numbers. Cells
 * holding a comma, quote, line feed or carriage return are quoted.
 */
export function csvCell(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v);
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(t) && !NUMERIC_TEXT.test(t)) t = `'${t}`;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** A "# ..." header line: one line (CR/LF folded to a space) and one cell. */
function csvHeaderLine(text: string): string {
  return csvCell(`# ${text}`.replace(/[\r\n]+/g, ' '));
}

export const INVENTORY_CSV_COLUMNS = [
  'step',
  'life_cycle_stage',
  'substance',
  'direction',
  'amount_entered',
  'unit_entered',
  'unit_conversion',
  'factor',
  'factor_scope',
  'factor_source',
  'source_tier',
  'allocation',
  'impact_category',
  'impact_value',
  'impact_unit',
] as const;

export function buildInventoryCsv(input: {
  runId: number;
  projectName: string;
  caseName: string;
  method: string;
  region: string;
  functionalUnit: string | null;
  exportedAt: string;
  rows: SnapshotFlowRow[];
  /** Life-cycle stage of the row's step (by component_id when the row has one). */
  stageFor: (row: SnapshotFlowRow) => string | null;
  /** Unit of an impact category's result. */
  unitFor: (category: string) => string | null;
  /** Extra header line, e.g. that stages were read from current data. */
  note?: string | null;
}): string {
  const header = [
    csvHeaderLine(`LCAPIX assessment run ${input.runId}`),
    csvHeaderLine(`Project: ${input.projectName}`),
    csvHeaderLine(`Case: ${input.caseName}`),
    csvHeaderLine(`Method: ${input.method}; Region: ${input.region}`),
    csvHeaderLine(`Functional unit: ${input.functionalUnit ?? 'not set'}`),
    csvHeaderLine(`Exported: ${input.exportedAt}`),
    ...(input.note ? [csvHeaderLine(input.note)] : []),
  ];

  const rows = input.rows.map((f) =>
    [
      f.component,
      input.stageFor(f) ?? '',
      f.substance,
      f.dir === 'IN' ? 'input' : 'output',
      f.amount,
      f.unit,
      f.conversion ?? '',
      f.factor,
      f.scope,
      f.source ?? '',
      f.source_tier ?? '',
      f.allocation ?? '',
      f.category_name,
      f.impact,
      input.unitFor(f.category_name) ?? '',
    ]
      .map(csvCell)
      .join(','),
  );

  // A run made before snapshots existed has no flow detail; say so in the file
  // rather than handing back an empty table.
  return rows.length
    ? [...header, INVENTORY_CSV_COLUMNS.join(','), ...rows].join('\n')
    : [
        ...header,
        csvHeaderLine(
          'This run was made before flow-level detail was recorded. Re-run the assessment to export its rows.',
        ),
        INVENTORY_CSV_COLUMNS.join(','),
      ].join('\n');
}
