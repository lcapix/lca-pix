/**
 * LCA CALCULATION ENGINE
 *
 * Implements the core LCA calculation algorithm using the CML 2001 methodology.
 * This engine processes environmental flows and calculates impact category results
 * by applying characterization factors to substance quantities.
 *
 * Algorithm Overview (CML 2001):
 * ================================
 *
 * For each component in the product system:
 *   1. Identify all environmental flows (inputs/outputs)
 *   2. Filter for driver flows (is_driver = TRUE)
 *   3. For each driver flow:
 *      a. Lookup characterization factor from driver_impact_factors table
 *      b. Calculate impact: Impact = Quantity × Characterization_Factor
 *      c. Aggregate by impact category
 *   4. Sum all component impacts to get total impact per category
 *
 * Formula:
 * --------
 * Impact_CategoryX = Σ(Flow_Quantity_i × Characterization_Factor_i)
 *
 * Where:
 *   - Flow_Quantity_i = amount of substance i emitted/consumed
 *   - Characterization_Factor_i = environmental impact per unit of substance i for category X
 *
 * Example:
 * --------
 * Global Warming Impact = (CO₂_quantity × 1.0) + (CH₄_quantity × 28.0) + (N₂O_quantity × 265.0)
 *                      = (125.25 kg × 1.0) + (2.5 kg × 28.0) + (0 kg × 265.0)
 *                      = 125.25 + 70.0 + 0
 *                      = 195.25 kg CO₂ eq
 */

import type { Connection, RowDataPacket } from 'mysql2/promise';
import { canonicalizeRegion, selectBestScopeRows } from './factor-selection';
import { convertQuantity, normalizeUnit } from './units';

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
  if (/legacy pack|not yet verified|zeroed|quarantin|no published source|not yet cited/.test(s)) {
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
  /** Components whose burden was allocated (allocation_factor < 1). */
  allocated_components: number;
  /** Flows no factor in the method characterizes (they add nothing). */
  uncharacterized_flows: number;
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
  impacts: CategoryImpact[];
  flow_contributions: FlowContribution[];
  total_flows_processed: number;
  driver_flows_count: number;
  /** Data-quality problems that excluded or altered contributions (unit
   * mismatches, missing units). Never empty silently — surfaced to the run. */
  warnings: string[];
  /** Flow × category pairs left out because the flow's unit could not be converted. */
  excluded_flows?: number;
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

    const rawQuantity = parseFloat(row.quantity);
    const factor = parseFloat(row.characterization_factor);
    const flowUnit: string | null = row.flow_unit ?? null;
    const factorUnit: string | null = row.substance_default_unit ?? null;

    let quantityInFactorUnit = rawQuantity;
    let conversionNote: string | undefined;

    const flowNorm = normalizeUnit(flowUnit);
    const factorNorm = normalizeUnit(factorUnit);

    if (!flowUnit || !flowUnit.trim()) {
      warnings.push(
        `Flow ${row.flow_id} (${row.substance_name}): no unit recorded — assumed ${factorUnit ?? 'factor unit'}.`,
      );
    } else if (factorNorm && flowNorm && flowNorm !== factorNorm) {
      const conv = convertQuantity(rawQuantity, flowUnit, factorUnit);
      if (conv) {
        quantityInFactorUnit = conv.quantity;
        conversionNote = conv.note;
      } else {
        warnings.push(
          `Flow ${row.flow_id} (${row.substance_name}): unit '${flowUnit}' cannot be converted to factor unit '${factorUnit}' — EXCLUDED from ${row.category_name}.`,
        );
        excluded++;
        continue;
      }
    } else if (flowUnit && !flowNorm) {
      warnings.push(
        `Flow ${row.flow_id} (${row.substance_name}): unrecognized unit '${flowUnit}' — EXCLUDED from ${row.category_name}.`,
      );
      excluded++;
      continue;
    }

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
    total_flows_processed: flowContributions.length,
    driver_flows_count: new Set(flowContributions.map((f) => f.flow_id)).size,
    warnings,
    excluded_flows: excluded,
    characterized_flow_ids: [...characterized],
  };
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
              parent_component_id, allocation_factor
       FROM component
       WHERE case_id = ?
       ORDER BY hierarchy_level, component_id`,
      [caseId]
    );
  } catch (err: any) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    [components] = await connection.query<RowDataPacket[]>(
      `SELECT component_id, component_name, component_type, hierarchy_level,
              parent_component_id
       FROM component
       WHERE case_id = ?
       ORDER BY hierarchy_level, component_id`,
      [caseId]
    );
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
    componentResults.push(result);

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
  let unit_conversions = 0;

  for (const r of componentResults) {
    for (const c of r.flow_contributions) {
      contributions++;
      const tier = c.source_tier ?? classifyFactorSource(c.factor_source);
      by_tier[tier]++;
      if (/global warming|climate change/i.test(c.category_name)) {
        // Magnitude, so a credit (negative contribution) cannot push a share past 100%.
        gwMagnitude[tier] += Math.abs(c.impact_contribution);
      }
      if (regional && (c.geographic_scope ?? 'Global').toLowerCase() === 'global') {
        regional_fallbacks++;
      }
      if (c.unit_conversion) unit_conversions++;
    }
  }

  const gwTotal = SOURCE_TIERS.reduce((s, t) => s + gwMagnitude[t], 0);
  const gw_share_by_tier = zero();
  for (const t of SOURCE_TIERS) gw_share_by_tier[t] = gwTotal > 0 ? gwMagnitude[t] / gwTotal : 0;
  const excluded_flows = componentResults.reduce((s, r) => s + (r.excluded_flows ?? 0), 0);
  const allocated = componentResults.filter((r) => (r.allocation_factor ?? 1) < 1);
  const unchar = opts.uncharacterized ?? [];
  const uncharNames = [...new Set(unchar.map((u) => u.substance_name))];

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
    allocated_components: allocated.length,
    uncharacterized_flows: unchar.length,
    uncharacterized_examples: uncharNames.slice(0, 10),
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

/**
 * Validate flow contributions
 *
 * Ensures all flow contributions have valid characterization factors
 * and positive quantities. Returns list of validation issues.
 *
 * @param contributions - Flow contributions to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateFlowContributions(
  contributions: FlowContribution[]
): string[] {
  const errors: string[] = [];

  for (const contrib of contributions) {
    if (contrib.quantity <= 0) {
      errors.push(
        `Flow ${contrib.flow_id} (${contrib.substance_name}) has non-positive quantity: ${contrib.quantity}`
      );
    }

    if (contrib.characterization_factor === 0) {
      errors.push(
        `Flow ${contrib.flow_id} (${contrib.substance_name}) has zero characterization factor for ${contrib.category_name}`
      );
    }

    if (isNaN(contrib.impact_contribution)) {
      errors.push(
        `Flow ${contrib.flow_id} (${contrib.substance_name}) has invalid impact contribution (NaN)`
      );
    }
  }

  return errors;
}
