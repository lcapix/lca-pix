/**
 * LCA CALCULATION ENGINE
 *
 * Impact_c = Σ over flows of quantity_in_factor_unit × CF(substance, c, method, region)
 *            × allocation share of the step
 *
 * Method-agnostic: the run's method (CML 2001 by default, TRACI 2.1, ReCiPe
 * Midpoint (H)) selects the factor rows; the characterization values are
 * whatever those rows hold. For each step (component):
 *   1. every flow on the step is joined to its factor rows for the method, for
 *      the requested region and Global;
 *   2. one row per flow × category is kept, the exact region beating Global
 *      (lib/factor-selection.ts);
 *   3. the direction rule applies: 'embodied' factors charge inputs only,
 *      'elementary' factors charge outputs only;
 *   4. the quantity is expressed in the unit the factor is stated per
 *      (lib/units.ts toFactorBasis); a non-numeric quantity is skipped and an
 *      unconvertible, unknown or ambiguous unit is EXCLUDED, both with a
 *      warning; nothing is ever multiplied raw;
 *   5. contributions are summed per category, labelled with the factor's
 *      reference unit (numerator).
 * The case total sums the steps after allocation (ISO 14044 4.3.4) and comes
 * with warnings and a data-quality statement (4.2.3.6).
 *
 * Example (CML 2001 rows, IPCC AR5 GWP100: CH4 28; TRACI 2.1's lciafmt row is
 * AR4, CH4 25 — see CALCULATIONS.md section 9):
 *   Global Warming = 125.25 kg CO2 × 1 + 2.5 kg CH4 × 28 = 195.25 kg CO2 eq
 *
 * CALCULATIONS.md is the full description; its worked example is pinned by
 * tests/lib/calculations-doc-example.test.ts.
 */

import type { Connection, RowDataPacket } from 'mysql2/promise';
import { canonicalizeRegion, selectBestScopeRows } from './factor-selection';
import { toFactorBasis } from './units';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FlowContribution {
  flow_id: number;
  substance_id: number;
  substance_name: string;
  cas_number: string | null;
  flow_type: 'input' | 'output';
  quantity: number;
  unit: string;
  characterization_factor: number;
  impact_contribution: number;
  category_id: number;
  category_name: string;
  /** Which factor scope produced this number ('US', 'Global', …). */
  geographic_scope?: string;
  /** Present when the flow quantity was converted into the factor's unit. */
  unit_conversion?: string;
  /** Where the factor came from (driver_impact_factors.source_reference). */
  factor_source?: string | null;
  /** Provenance tier of that source, for the ISO 14044 data-quality statement. */
  source_tier?: SourceTier;
  /** Share of this unit process's burden allocated to the product (ISO 14044 4.3.4). */
  allocation_factor?: number;
}

/**
 * Provenance tier of a characterization / embodied factor. All factors are
 * secondary data in ISO terms; this grades HOW trustworthy that secondary
 * source is, so a result can say how much of it rests on what.
 *   authoritative    — published method or official dataset (US EPA TRACI via
 *                      lciafmt, IPCC, eGRID, Ember, an EN 15804 / ISO 14025 EPD)
 *   industry_average — sector-association or representative average (worldsteel,
 *                      PlasticsEurope, International Aluminium Institute …)
 *   unverified       — legacy value never traced to a source
 *   unknown          — no source recorded
 */
export type SourceTier = 'authoritative' | 'industry_average' | 'unverified' | 'unknown';

export function classifyFactorSource(ref?: string | null): SourceTier {
  const s = (ref ?? '').toLowerCase();
  if (!s.trim()) return 'unknown';
  if (/legacy pack|not yet verified|zeroed|quarantin|no published source|not yet cited|user-entered/.test(s)) {
    return 'unverified';
  }
  // An industry-association average, or a declaration past its validity date,
  // is published but not an official method/dataset: grade it one step down.
  if (/industry.average|expired/.test(s)) return 'industry_average';
  if (/lciafmt|us epa|\bepa\b|ipcc|egrid|\bember\b|\bepd\b|environdec|iso 14025|en 15804|openlca/.test(s)) {
    return 'authoritative';
  }
  return 'industry_average';
}

/** Run-level data-quality summary (ISO 14044 4.2.3.6 data quality requirements). */
export interface DataQualitySummary {
  /** Flow × category contributions counted in the result. */
  contributions: number;
  /** How many contributions rest on each provenance tier. */
  by_tier: Record<SourceTier, number>;
  /** Share (0..1) of the Global Warming result carried by each tier. */
  gw_share_by_tier: Record<SourceTier, number>;
  /** Contributions that used a Global factor although a region was requested. */
  regional_fallbacks: number;
  /** Contributions whose quantity was unit-converted to the factor's unit. */
  unit_conversions: number;
  /** Flows left out of a category because their unit could not be converted. */
  excluded_flows: number;
  /** Flows skipped because their quantity is not a finite number. */
  invalid_quantity_flows?: number;
  /** Components whose burden was allocated (allocation_factor < 1). */
  allocated_components: number;
  /** Flows no factor in the method characterizes (they add nothing). */
  uncharacterized_flows: number;
  /**
   * Per impact category: how many of the characterized INPUT flows have a
   * factor in THAT category (outputs are not counted on either side). A category whose factors cover only some inputs still prints
   * a total, and without this it reads as if the whole product were counted.
   */
  category_coverage: Array<{
    category: string;
    covered: number;
    total: number;
    missing_examples: string[];
  }>;
  /** Up to 10 substance names of those flows, for the statement. */
  uncharacterized_examples: string[];
  /** Plain-language statement lines for the results page and report. */
  statement: string[];
}

export interface ComponentImpactResult {
  component_id: number;
  component_name: string;
  component_type: string;
  hierarchy_level: number;
  /** Life-cycle stage of this step (migrate-022). Null on older databases,
   *  which are read as production. */
  life_cycle_stage?: string | null;
  impacts: CategoryImpact[];
  flow_contributions: FlowContribution[];
  /** Distinct flows evaluated: flows with at least one factor row in the method. */
  total_flows_processed: number;
  /** Distinct flows that contributed to at least one category. */
  driver_flows_count: number;
  /** Data-quality problems that excluded or altered contributions (unit
   * mismatches, missing units). Never empty silently — surfaced to the run. */
  warnings: string[];
  /** Flow × category pairs left out because the flow's unit could not be converted. */
  excluded_flows?: number;
  /** Flows skipped because their quantity is not a finite number (NULL, '', 'abc'). */
  invalid_quantity_flows?: number;
  /** Flows with at least one applicable factor (after the direction rule). */
  characterized_flow_ids?: number[];
  /** Allocation share applied to this component (ISO 14044 4.3.4), when < 1. */
  allocation_factor?: number;
}

export interface CategoryImpact {
  category_id: number;
  category_name: string;
  impact_value: number;
  unit: string;
  flow_count: number;
}

export interface CalculationSummary {
  total_components: number;
  components_with_flows: number;
  total_flows_processed: number;
  total_driver_flows: number;
  impact_categories_calculated: number;
  calculation_method: string;
  calculation_timestamp: string;
}

export interface AlgorithmStep {
  step_number: number;
  step_description: string;
  details?: Record<string, any>;
}

export interface LCAResult {
  summary: CalculationSummary;
  component_results: ComponentImpactResult[];
  algorithm_steps: AlgorithmStep[];
  total_impacts: CategoryImpact[];
  /** Aggregated data-quality warnings from every component. */
  warnings: string[];
  /** Data-quality statement for the run (ISO 14044 4.2.3.6). */
  data_quality?: DataQualitySummary;
}

export interface CalcOptions {
  method?: string;       // default 'CML 2001'
  regionCode?: string;   // default 'Global'
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate environmental impacts for a single component
 *
 * This function:
 * 1. Fetches all driver flows for the component
 * 2. Joins with characterization factors from driver_impact_factors
 * 3. Calculates impact for each flow-category combination
 * 4. Returns detailed breakdown of contributions
 *
 * @param componentId - The component to calculate impacts for
 * @param connection - Database connection
 * @returns Detailed impact results for the component
 */
export async function calculateComponentImpacts(
  componentId: number,
  connection: Connection,
  options: CalcOptions = {}
): Promise<ComponentImpactResult> {
  const method = options.method ?? 'CML 2001';
  // UI labels ('US Grid') and stored scopes ('US') must agree before the query
  // runs, or the region filter silently matches nothing and every factor falls
  // back to Global.
  const region = canonicalizeRegion(options.regionCode);

  // Step 1: Get component details
  const [components] = await connection.query<RowDataPacket[]>(
    `SELECT component_id, component_name, component_type, hierarchy_level
     FROM component
     WHERE component_id = ?`,
    [componentId]
  );

  if (components.length === 0) {
    throw new Error(`Component ${componentId} not found`);
  }

  const component = components[0];

  // Step 2: Get all flows and match with characterization factors
  // The driver_impact_factors table joins to flows via substance_id.
  // Filter by method_name and geographic_scope, with a fallback to 'Global'
  // when the requested region has no factor. Region-specific rows are
  // preferred over the Global fallback via the ORDER BY below.
  const [flowsData] = await connection.query<RowDataPacket[]>(
    `SELECT
       f.flow_id,
       f.substance_id,
       s.substance_name,
       s.cas_number,
       s.unit as substance_default_unit,
       f.flow_type,
       f.quantity,
       f.unit as flow_unit,
       dif.category_id,
       dif.geographic_scope,
       dif.factor_basis,
       ic.category_name,
       ic.unit as category_unit,
       dif.unit as factor_unit,
       dif.source_reference as factor_source,
       dif.factor_value as characterization_factor
     FROM flows f
     INNER JOIN substances s ON f.substance_id = s.substance_id
     INNER JOIN driver_impact_factors dif
       ON f.substance_id = dif.substance_id
      AND dif.method_name = ?
      AND dif.geographic_scope IN (?, 'Global')
     INNER JOIN impact_categories ic ON dif.category_id = ic.category_id
     -- Bug #9: count every flow on the component, not just is_driver=TRUE.
     -- New flows default is_driver=1, but older rows may be 0; treating every
     -- attached flow as a driver keeps assessments from returning 0.
     WHERE f.component_id = ?
     ORDER BY dif.category_id,
              CASE WHEN dif.geographic_scope = ? THEN 0 ELSE 1 END,
              f.flow_id`,
    [method, region, componentId, region]
  );

  // Step 2b: keep exactly ONE factor row per flow × category. The IN-join
  // returns both the regional row and the Global fallback when both exist;
  // summing both double-counts. Exact-region rows win.
  const { selected: selectedRows } = selectBestScopeRows(
    flowsData as Array<RowDataPacket & { flow_id: number; category_id: number; geographic_scope: string }>,
    region,
  );

  // Step 3: Calculate impact contributions. A factor is stored per the
  // substance's default unit; the flow quantity must be expressed in that
  // unit before multiplying. Convertible units are converted (and recorded);
  // unconvertible ones are EXCLUDED and reported — never multiplied raw.
  const warnings: string[] = [];
  let untypedFactorSeen = false;
  const flowContributions: FlowContribution[] = [];
  // For the completeness check: which flows had an applicable factor, and how
  // many flow × category pairs a unit problem left out.
  const characterized = new Set<number>();
  let excluded = 0;
  const invalidQuantityFlows = new Set<number>();
  for (const row of selectedRows) {
    // Direction rule: 'embodied' factors describe PRODUCING a substance and
    // apply to input flows only (steel you buy, electricity you draw);
    // 'elementary' factors describe EMITTING or treating it and apply to
    // output flows only (CO2 you release, waste you send out). Charging both
    // directions double-counts. Untyped factors (pre-migration-009 databases)
    // keep the old both-directions behavior, loudly.
    if (row.factor_basis === 'embodied' && row.flow_type === 'output') continue;
    if (row.factor_basis === 'elementary' && row.flow_type === 'input') continue;
    if (!row.factor_basis) untypedFactorSeen = true;
    characterized.add(row.flow_id);

    // E9: a quantity that is not a finite number (NULL, '', 'abc', NaN) is
    // skipped and named. One NaN would otherwise turn the category total NaN.
    const rawQuantity = finiteNumber(row.quantity);
    if (rawQuantity === null) {
      if (!invalidQuantityFlows.has(row.flow_id)) {
        invalidQuantityFlows.add(row.flow_id);
        warnings.push(
          `Flow ${row.flow_id} (${row.substance_name}): quantity ${JSON.stringify(row.quantity ?? null)} is not a finite number — SKIPPED in every category.`,
        );
      }
      continue;
    }
    const factor = finiteNumber(row.characterization_factor);
    if (factor === null) {
      warnings.push(
        `Flow ${row.flow_id} (${row.substance_name}): the ${row.category_name} factor is not a finite number — SKIPPED from ${row.category_name}.`,
      );
      continue;
    }

    // E3 + E11: express the quantity in the unit the factor is stated per
    // (the factor label's denominator, else the substance unit). Identical
    // units pass as-is; convertible units are converted and recorded; every
    // other case is EXCLUDED and reported. There is no raw-multiply fallback.
    const basis = toFactorBasis(
      rawQuantity,
      row.flow_unit ?? null,
      row.substance_default_unit ?? null,
      row.factor_unit ?? null,
    );
    if (!basis.ok) {
      warnings.push(
        `Flow ${row.flow_id} (${row.substance_name}): ${basis.reason} — EXCLUDED from ${row.category_name}.`,
      );
      excluded++;
      continue;
    }
    const quantityInFactorUnit = basis.quantity;
    const conversionNote = basis.note;

    flowContributions.push({
      flow_id: row.flow_id,
      substance_id: row.substance_id,
      substance_name: row.substance_name,
      cas_number: row.cas_number,
      flow_type: row.flow_type,
      quantity: rawQuantity,
      unit: row.flow_unit,
      characterization_factor: factor,
      impact_contribution: quantityInFactorUnit * factor,
      category_id: row.category_id,
      category_name: row.category_name,
      geographic_scope: row.geographic_scope,
      unit_conversion: conversionNote,
      factor_source: row.factor_source ?? null,
      source_tier: classifyFactorSource(row.factor_source),
    });
  }

  if (untypedFactorSeen) {
    warnings.push(
      `Component ${component.component_name}: some factors have no direction typing (embodied/elementary) — run migration 009; until then those factors count on both inputs and outputs.`,
    );
  }

  // Fuel + combustion-gas co-presence check. Our fuel factors (Natural Gas,
  // Coal, Crude Oil) are combustion factors — the CO2 from burning them is
  // already inside the input factor. If the user ALSO models the combustion
  // gas as an output on the same component, the same emission is counted
  // twice. Both entries stay (the user may genuinely have process emissions),
  // but the run says so out loud.
  const FUEL_NAMES = ['natural gas', 'coal', 'crude oil', 'fuel oil', 'lpg'];
  const GAS_NAMES = ['carbon dioxide', 'methane', 'nitrous oxide'];
  const inputFuels = new Set<string>();
  const outputGases = new Set<string>();
  for (const row of flowsData) {
    const name = String(row.substance_name).toLowerCase();
    if (row.flow_type === 'input' && FUEL_NAMES.some((f) => name.includes(f))) {
      inputFuels.add(row.substance_name);
    }
    if (row.flow_type === 'output' && GAS_NAMES.some((g) => name.includes(g))) {
      outputGases.add(row.substance_name);
    }
  }
  if (inputFuels.size > 0 && outputGases.size > 0) {
    warnings.push(
      `Component ${component.component_name}: possible DOUBLE COUNT — fuel input(s) [${[...inputFuels].join(', ')}] already include combustion emissions in their factors, and combustion gas output(s) [${[...outputGases].join(', ')}] are modeled on the same component. Keep the gas output only if it is a separate process emission (not from burning the listed fuel).`,
    );
  }

  // Reference unit of a factor = its numerator: a factor stored as
  // "kg SO2 eq / kg" characterizes 1 kg of input, but the RESULT is kg SO2 eq.
  const refUnit = (u?: string | null): string => (u ?? '').split('/')[0].trim();
  const rowFor = (c: FlowContribution) =>
    selectedRows.find((row) => row.flow_id === c.flow_id && row.category_id === c.category_id);

  // Unit-consistency guard: within one method every factor in a category must
  // share one reference unit, or the sum is meaningless (kg N eq + kg PO4 eq).
  const unitsByCat = new Map<number, Set<string>>();
  for (const c of flowContributions) {
    const r = rowFor(c);
    const u = refUnit(r?.factor_unit || r?.category_unit);
    if (!u) continue;
    if (!unitsByCat.has(c.category_id)) unitsByCat.set(c.category_id, new Set());
    unitsByCat.get(c.category_id)!.add(u);
  }
  for (const [catId, units] of unitsByCat) {
    if (units.size > 1) {
      const name =
        flowContributions.find((c) => c.category_id === catId)?.category_name ?? `category ${catId}`;
      warnings.push(
        `Component ${component.component_name}: ${name} mixes reference units (${[...units].join(', ')}) under ${method} — the total is not comparable; the factor data needs fixing.`,
      );
    }
  }

  // Step 4: Aggregate impacts by category
  const impactsByCategory = new Map<number, CategoryImpact>();

  for (const contribution of flowContributions) {
    const existing = impactsByCategory.get(contribution.category_id);

    if (existing) {
      existing.impact_value += contribution.impact_contribution;
      existing.flow_count += 1;
    } else {
      // Report the FACTOR's reference unit, not the category default: units
      // are method-specific (TRACI eutrophication is kg N eq, CML is kg PO4
      // eq), so labelling a TRACI result with the CML unit would be wrong.
      const unitRow = rowFor(contribution);
      const categoryUnit =
        refUnit(unitRow?.factor_unit) ||
        refUnit(unitRow?.category_unit) ||
        refUnit(flowsData.find((row) => row.category_id === contribution.category_id)?.category_unit);

      impactsByCategory.set(contribution.category_id, {
        category_id: contribution.category_id,
        category_name: contribution.category_name,
        impact_value: contribution.impact_contribution,
        unit: categoryUnit,
        flow_count: 1,
      });
    }
  }

  const impacts = Array.from(impactsByCategory.values());

  return {
    component_id: component.component_id,
    component_name: component.component_name,
    component_type: component.component_type,
    hierarchy_level: component.hierarchy_level,
    impacts,
    flow_contributions: flowContributions,
    // Flows the engine evaluated (at least one factor row in this method),
    // counted once each however many categories they have factors in.
    total_flows_processed: new Set(flowsData.map((r) => r.flow_id)).size,
    driver_flows_count: new Set(flowContributions.map((f) => f.flow_id)).size,
    warnings,
    excluded_flows: excluded,
    invalid_quantity_flows: invalidQuantityFlows.size,
    characterized_flow_ids: [...characterized],
  };
}

/** A number, or null when the value is not a finite number ('' and null included). */
function finiteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Calculate LCA impacts for an entire case
 *
 * This is the main entry point for running an LCA assessment.
 * It orchestrates the calculation across all components and
 * provides detailed traceability of the algorithm execution.
 *
 * @param caseId - The case to run assessment for
 * @param connection - Database connection
 * @param calculationMethod - Assessment method (default: 'CML 2001')
 * @returns Complete LCA results with algorithm steps
 */
export async function calculateCaseImpacts(
  caseId: number,
  connection: Connection,
  optionsOrMethod: CalcOptions | string = {}
): Promise<LCAResult> {
  // Backward compat: accept a bare method string or a CalcOptions object.
  const options: CalcOptions =
    typeof optionsOrMethod === 'string'
      ? { method: optionsOrMethod }
      : { ...optionsOrMethod, regionCode: canonicalizeRegion(optionsOrMethod.regionCode) };
  const calculationMethod = options.method ?? 'CML 2001';

  const algorithmSteps: AlgorithmStep[] = [];
  const calculation_timestamp = new Date().toISOString();

  // STEP 1: Load all components in the case
  algorithmSteps.push({
    step_number: 1,
    step_description: 'Loading component hierarchy from database',
  });

  // Parent links + allocation shares come with the hierarchy. Databases
  // without migrate-014 have no allocation column; every component then
  // counts in full, which is the no-allocation default anyway.
  let components: RowDataPacket[] = [];
  try {
    [components] = await connection.query<RowDataPacket[]>(
      `SELECT component_id, component_name, component_type, hierarchy_level,
              parent_component_id, allocation_factor, life_cycle_stage
       FROM component
       WHERE case_id = ?
       ORDER BY hierarchy_level, component_id`,
      [caseId]
    );
  } catch (err: any) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    // Older database: try without the stage, then without allocation either.
    try {
      [components] = await connection.query<RowDataPacket[]>(
        `SELECT component_id, component_name, component_type, hierarchy_level,
                parent_component_id, allocation_factor
         FROM component
         WHERE case_id = ?
         ORDER BY hierarchy_level, component_id`,
        [caseId]
      );
    } catch (err2: any) {
      if (err2?.code !== 'ER_BAD_FIELD_ERROR') throw err2;
      [components] = await connection.query<RowDataPacket[]>(
        `SELECT component_id, component_name, component_type, hierarchy_level,
                parent_component_id
         FROM component
         WHERE case_id = ?
         ORDER BY hierarchy_level, component_id`,
        [caseId]
      );
    }
  }
  const allocation = effectiveAllocation(components as any[]);

  algorithmSteps.push({
    step_number: 2,
    step_description: `Loaded ${components.length} components from hierarchy`,
    details: {
      component_ids: components.map((c) => c.component_id),
      component_names: components.map((c) => c.component_name),
    },
  });

  // STEP 2: Identify components with driver flows
  algorithmSteps.push({
    step_number: 3,
    step_description: 'Identifying components with environmental driver flows',
  });

  const [flowCounts] = await connection.query<RowDataPacket[]>(
    `SELECT
       c.component_id,
       c.component_name,
       COUNT(f.flow_id) as flow_count
     FROM component c
     LEFT JOIN flows f ON c.component_id = f.component_id
     WHERE c.case_id = ?
     GROUP BY c.component_id, c.component_name
     HAVING flow_count > 0`,
    [caseId]
  );

  const componentsWithFlows = flowCounts.map((row) => ({
    component_id: row.component_id,
    component_name: row.component_name,
    flow_count: row.flow_count,
  }));

  // Terminating-node rule: a node with children is the sum of its children
  // (ISO 14044 unit processes; the patent's baseline process). Flows sitting
  // on such a node still count, but say so: the same flow modeled on a step
  // below would be counted twice.
  const nodesWithChildren = new Set(
    components.map((c) => c.parent_component_id).filter((id) => id != null),
  );
  const structureWarnings = componentsWithFlows
    .filter((c) => nodesWithChildren.has(c.component_id))
    .map(
      (c) =>
        `Component ${c.component_name} has steps below it and also ${c.flow_count} flow(s) of its own. A parent should be the sum of its steps: move these flows onto the step that uses them, or check they are not also modeled below (double count).`,
    );

  algorithmSteps.push({
    step_number: 4,
    step_description: `Found ${componentsWithFlows.length} component(s) with driver flows`,
    details: {
      components: componentsWithFlows,
    },
  });

  // STEP 3: Calculate impacts for each component
  const componentResults: ComponentImpactResult[] = [];
  let totalFlowsProcessed = 0;
  let totalDriverFlows = 0;

  for (const comp of componentsWithFlows) {
    algorithmSteps.push({
      step_number: 5 + componentResults.length,
      step_description: `Processing component: "${comp.component_name}" (ID: ${comp.component_id})`,
      details: {
        component_id: comp.component_id,
        expected_flows: comp.flow_count,
      },
    });

    const result = await calculateComponentImpacts(comp.component_id, connection, options);
    // Allocation (ISO 14044 4.3.4): a process that also makes other products
    // carries only its allocated share into this product's result.
    const share = allocation.get(comp.component_id) ?? 1;
    if (share < 1) applyAllocation(result, share);
    componentResults.push({ ...result, life_cycle_stage: (comp as any).life_cycle_stage ?? null });

    totalFlowsProcessed += result.total_flows_processed;
    totalDriverFlows += result.driver_flows_count;

    algorithmSteps.push({
      step_number: 5 + componentResults.length,
      step_description: `Calculated ${result.impacts.length} impact categories for "${comp.component_name}"`,
      details: {
        component_id: comp.component_id,
        flows_processed: result.total_flows_processed,
        ...(share < 1 ? { allocation_share: share } : {}),
        categories: result.impacts.map((imp) => ({
          category: imp.category_name,
          value: imp.impact_value,
          unit: imp.unit,
        })),
      },
    });
  }

  // STEP 4: Aggregate total impacts across all components
  algorithmSteps.push({
    step_number: 5 + componentResults.length + 1,
    step_description: 'Aggregating total impacts across all components',
  });

  const totalImpactsByCategory = new Map<number, CategoryImpact>();
  // Cross-component unit guard: two components reporting one category in
  // different reference units cannot be summed into a meaningful case total.
  const crossUnitWarnings = new Set<string>();

  for (const compResult of componentResults) {
    for (const impact of compResult.impacts) {
      const existing = totalImpactsByCategory.get(impact.category_id);

      if (existing) {
        if (existing.unit && impact.unit && existing.unit !== impact.unit) {
          crossUnitWarnings.add(
            `${impact.category_name}: components report different reference units (${existing.unit} vs ${impact.unit}) under ${calculationMethod} — the case total is not comparable; the factor data needs fixing.`,
          );
        }
        existing.impact_value += impact.impact_value;
        existing.flow_count += impact.flow_count;
      } else {
        totalImpactsByCategory.set(impact.category_id, { ...impact });
      }
    }
  }

  const totalImpacts = Array.from(totalImpactsByCategory.values());

  // Surface every component's data-quality warnings on the run itself.
  const allWarnings = [
    ...structureWarnings,
    ...componentResults.flatMap((r) => r.warnings),
    ...crossUnitWarnings,
  ];

  // Completeness check (ISO 14044 4.5.3.2): a flow that no factor in this
  // method characterizes adds nothing to the result. Name those flows instead
  // of letting them vanish, then grade the run (4.2.3.6).
  const characterizedIds = new Set(
    componentResults.flatMap((r) => r.characterized_flow_ids ?? []),
  );
  const [caseFlows] = await connection.query<RowDataPacket[]>(
    `SELECT f.flow_id, s.substance_name, c.component_name
     FROM flows f
     JOIN component c ON c.component_id = f.component_id
     JOIN substances s ON s.substance_id = f.substance_id
     WHERE c.case_id = ?`,
    [caseId]
  );
  const uncharacterized = (caseFlows ?? [])
    .filter((f) => !characterizedIds.has(f.flow_id))
    .map((f) => ({
      substance_name: String(f.substance_name),
      component_name: String(f.component_name),
    }));
  const dataQuality = summarizeDataQuality(componentResults, {
    region: options.regionCode ?? 'Global',
    uncharacterized,
  });
  if (allWarnings.length > 0) {
    algorithmSteps.push({
      step_number: 5 + componentResults.length + 1.5,
      step_description: `${allWarnings.length} data-quality warning(s) — see run warnings`,
      details: { warnings: allWarnings },
    });
  }

  algorithmSteps.push({
    step_number: 5 + componentResults.length + 1.75,
    step_description: 'Compiled the data-quality statement (ISO 14044 4.2.3.6)',
    details: { statement: dataQuality.statement },
  });

  algorithmSteps.push({
    step_number: 5 + componentResults.length + 2,
    step_description: 'Calculation completed successfully',
    details: {
      total_impact_categories: totalImpacts.length,
      total_components_processed: componentResults.length,
      total_flows_processed: totalFlowsProcessed,
      results_summary: totalImpacts.map((imp) => ({
        category: imp.category_name,
        total_impact: imp.impact_value,
        unit: imp.unit,
        contributing_flows: imp.flow_count,
      })),
    },
  });

  // Create summary
  const summary: CalculationSummary = {
    total_components: components.length,
    components_with_flows: componentsWithFlows.length,
    total_flows_processed: totalFlowsProcessed,
    total_driver_flows: totalDriverFlows,
    impact_categories_calculated: totalImpacts.length,
    calculation_method: calculationMethod,
    calculation_timestamp,
  };

  return {
    summary,
    component_results: componentResults,
    algorithm_steps: algorithmSteps,
    total_impacts: totalImpacts,
    warnings: allWarnings,
    data_quality: dataQuality,
  };
}

// ============================================================================
// ALLOCATION + DATA QUALITY (ISO 14044 4.3.4, 4.2.3.6)
// ============================================================================

/**
 * Effective allocation share per component: its own share times every
 * ancestor's, so a share set on a machine line applies to each process under
 * it. Missing or invalid shares count as 1 (no allocation).
 */
export function effectiveAllocation(
  rows: Array<{
    component_id: number;
    parent_component_id?: number | null;
    allocation_factor?: unknown;
  }>,
): Map<number, number> {
  const own = new Map<number, number>();
  const parent = new Map<number, number | null>();
  for (const r of rows) {
    const f = Number(r.allocation_factor);
    own.set(r.component_id, Number.isFinite(f) && f > 0 && f <= 1 ? f : 1);
    parent.set(r.component_id, r.parent_component_id ?? null);
  }
  const memo = new Map<number, number>();
  const resolve = (id: number, depth: number): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const p = parent.get(id);
    // Depth guard: a corrupt parent cycle must not hang a run.
    const up = p != null && own.has(p) && depth < 64 ? resolve(p, depth + 1) : 1;
    const eff = (own.get(id) ?? 1) * up;
    memo.set(id, eff);
    return eff;
  };
  for (const id of own.keys()) resolve(id, 0);
  return memo;
}

/** Scale a component's impacts and contributions to its allocated share. */
export function applyAllocation(result: ComponentImpactResult, share: number): void {
  for (const impact of result.impacts) impact.impact_value *= share;
  for (const c of result.flow_contributions) {
    c.impact_contribution *= share;
    c.allocation_factor = share;
  }
  result.allocation_factor = share;
}

const SOURCE_TIERS: SourceTier[] = ['authoritative', 'industry_average', 'unverified', 'unknown'];
const TIER_PHRASE: Record<SourceTier, string> = {
  authoritative: 'authoritative sources (published LCIA methods and official datasets such as TRACI, CML, IPCC, eGRID)',
  industry_average: 'industry-average factors',
  unverified: 'unverified legacy factors',
  unknown: 'factors with no recorded source',
};

/**
 * Data-quality statement for a run (ISO 14044 4.2.3.6): where the factors
 * come from, how geographically representative they are, and what was
 * converted, excluded, left uncharacterized or allocated. Pure: built from the
 * engine's own contributions, so every line traces to the flow table.
 */
export function summarizeDataQuality(
  componentResults: ComponentImpactResult[],
  opts: {
    region?: string;
    uncharacterized?: Array<{ substance_name: string; component_name?: string }>;
  } = {},
): DataQualitySummary {
  const zero = (): Record<SourceTier, number> => ({
    authoritative: 0,
    industry_average: 0,
    unverified: 0,
    unknown: 0,
  });
  const by_tier = zero();
  const gwMagnitude = zero();
  const region = opts.region && opts.region.trim() ? opts.region.trim() : 'Global';
  const regional = region.toLowerCase() !== 'global';
  let contributions = 0;
  let regional_fallbacks = 0;
  /** Substances that actually had a factor for the requested region. */
  const regionalSubstances = new Set<string>();
  let unit_conversions = 0;
  // Input flows seen per category, and all characterized inputs, so a category
  // can be told "you cover 5 of the 26 inputs this run characterized".
  // Outputs are left out on both sides: an emission characterizes only the
  // categories it acts in (CO2 has no acidification factor), so counting it as
  // a missing input would overstate the gap.
  const inputsByCategory = new Map<string, Set<number>>();
  const allCharacterizedInputs = new Set<number>();
  const substanceByFlow = new Map<number, string>();

  for (const r of componentResults) {
    for (const c of r.flow_contributions) {
      contributions++;
      substanceByFlow.set(c.flow_id, c.substance_name);
      const seen = inputsByCategory.get(c.category_name) ?? new Set<number>();
      if (c.flow_type !== 'output') {
        allCharacterizedInputs.add(c.flow_id);
        seen.add(c.flow_id);
      }
      inputsByCategory.set(c.category_name, seen);
      const tier = c.source_tier ?? classifyFactorSource(c.factor_source);
      by_tier[tier]++;
      if (/global warming|climate change/i.test(c.category_name)) {
        // Magnitude, so a credit (negative contribution) cannot push a share past 100%.
        gwMagnitude[tier] += Math.abs(c.impact_contribution);
      }
      if (regional && (c.geographic_scope ?? 'Global').toLowerCase() === 'global') {
        regional_fallbacks++;
      } else if (regional) {
        regionalSubstances.add(c.substance_name);
      }
      if (c.unit_conversion) unit_conversions++;
    }
  }

  const gwTotal = SOURCE_TIERS.reduce((s, t) => s + gwMagnitude[t], 0);
  const gw_share_by_tier = zero();
  for (const t of SOURCE_TIERS) gw_share_by_tier[t] = gwTotal > 0 ? gwMagnitude[t] / gwTotal : 0;
  const excluded_flows = componentResults.reduce((s, r) => s + (r.excluded_flows ?? 0), 0);
  const invalid_quantity_flows = componentResults.reduce(
    (s, r) => s + (r.invalid_quantity_flows ?? 0),
    0,
  );
  const allocated = componentResults.filter((r) => (r.allocation_factor ?? 1) < 1);
  const unchar = opts.uncharacterized ?? [];
  const uncharNames = [...new Set(unchar.map((u) => u.substance_name))];

  const category_coverage = [...inputsByCategory.entries()]
    .filter(() => allCharacterizedInputs.size > 0)
    .map(([category, seen]) => {
      const missing = [...allCharacterizedInputs].filter((id) => !seen.has(id));
      const names = [...new Set(missing.map((id) => substanceByFlow.get(id) ?? 'unnamed flow'))];
      return {
        category,
        covered: seen.size,
        total: allCharacterizedInputs.size,
        missing_examples: names.slice(0, 5),
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category));

  const pct = (x: number) => (x > 0 && x < 0.01 ? '<1%' : `${Math.round(x * 100)}%`);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const listed = (names: string[], max: number) =>
    names.slice(0, max).join(', ') + (names.length > max ? ` and ${names.length - max} more` : '');

  const statement: string[] = [
    'Quantities are case data, entered by hand or extracted from the case documents. Every factor is secondary data; the flow table lists its source per row.',
  ];
  if (contributions === 0) {
    statement.push('No flow was characterized, so there is nothing to grade yet.');
  } else if (gwTotal > 0) {
    const parts = SOURCE_TIERS.filter((t) => gwMagnitude[t] > 0).map(
      (t) => `${pct(gw_share_by_tier[t])} on ${TIER_PHRASE[t]}`,
    );
    statement.push(`The Global Warming result rests ${parts.join(', ')}.`);
  } else {
    const parts = SOURCE_TIERS.filter((t) => by_tier[t] > 0).map(
      (t) => `${by_tier[t]} on ${TIER_PHRASE[t]}`,
    );
    statement.push(`Of ${contributions} contributions, ${parts.join(', ')}.`);
  }
  if (contributions > 0) {
    if (!regional) {
      statement.push('All factors are Global averages (no region selected).');
    } else if (regional_fallbacks > 0) {
      statement.push(
        `${regional_fallbacks} of ${contributions} contributions use a Global factor because no ${region} factor exists, so geographic representativeness is limited for them.`,
      );
      // Which ones the region did change. Without this the reader assumes the
      // whole model is regional, when in practice it is the grid and little else.
      const regionalNames = [...regionalSubstances].sort();
      if (regionalNames.length) {
        statement.push(
          `Only ${listed(regionalNames, 4)} used a ${region} factor; every other factor is the same in every region.`,
        );
      } else {
        statement.push(
          `Nothing in this run has a ${region} factor: the region changed no number in this result.`,
        );
      }
    } else {
      statement.push(`Every contribution uses a ${region} factor.`);
    }
  }
  if (unit_conversions > 0) {
    statement.push(
      `${unit_conversions} ${plural(unit_conversions, 'quantity was', 'quantities were')} converted to the factor's unit; the flow table shows each conversion.`,
    );
  }
  if (excluded_flows > 0) {
    statement.push(
      `${excluded_flows} flow-category ${plural(excluded_flows, 'pair was', 'pairs were')} left out because the unit could not be converted (see warnings).`,
    );
  }
  if (invalid_quantity_flows > 0) {
    statement.push(
      `${invalid_quantity_flows} ${plural(invalid_quantity_flows, 'flow was', 'flows were')} skipped because the quantity is not a number (see warnings).`,
    );
  }
  const partial = category_coverage.filter((c) => c.covered < c.total);
  for (const c of partial.slice(0, 3)) {
    statement.push(
      `${c.category} covers ${c.covered} of ${c.total} inputs: ${listed(c.missing_examples, 3)} ${
        c.missing_examples.length === 1 ? 'has' : 'have'
      } no ${c.category.toLowerCase()} factor, so that total is incomplete.`,
    );
  }
  if (unchar.length > 0) {
    statement.push(
      `${unchar.length} ${plural(unchar.length, 'flow has', 'flows have')} no factor in this method and add nothing to the result: ${listed(uncharNames, 5)}.`,
    );
  }
  statement.push(
    allocated.length > 0
      ? `Allocation (ISO 14044 4.3.4) applied to ${allocated.length} ${plural(allocated.length, 'process', 'processes')}: ${listed(
          allocated.map((r) => `${r.component_name} ${pct(r.allocation_factor ?? 1)}`),
          5,
        )}.`
      : 'No allocation applied: every process is treated as making only this product.',
  );

  return {
    contributions,
    by_tier,
    gw_share_by_tier,
    regional_fallbacks,
    unit_conversions,
    excluded_flows,
    invalid_quantity_flows,
    allocated_components: allocated.length,
    uncharacterized_flows: unchar.length,
    uncharacterized_examples: uncharNames.slice(0, 10),
    category_coverage,
    statement,
  };
}

/**
 * Format algorithm steps for display
 *
 * Converts algorithm steps into a human-readable format
 * suitable for logging or UI display.
 *
 * @param steps - Algorithm execution steps
 * @returns Formatted step descriptions
 */
export function formatAlgorithmSteps(steps: AlgorithmStep[]): string[] {
  return steps.map((step) => {
    let message = `Step ${step.step_number}: ${step.step_description}`;

    if (step.details) {
      const detailStr = JSON.stringify(step.details, null, 2);
      message += `\n  Details: ${detailStr}`;
    }

    return message;
  });
}
