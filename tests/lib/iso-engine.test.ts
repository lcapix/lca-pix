import { describe, it, expect, vi } from 'vitest';
import {
  applyAllocation,
  calculateComponentImpacts,
  classifyFactorSource,
  effectiveAllocation,
  summarizeDataQuality,
  type ComponentImpactResult,
  type FlowContribution,
  type LCAResult,
} from '@/lib/lca-engine';
import { buildGoalScope, buildRunSnapshot, perFunctionalUnitScale } from '@/lib/run-snapshot';

function fakeConn(sequence: any[][]) {
  let i = 0;
  return {
    query: vi.fn().mockImplementation(async () => [sequence[i++], null]),
  } as any;
}

const contribution = (over: Partial<FlowContribution> = {}): FlowContribution => ({
  flow_id: 1,
  substance_id: 1,
  substance_name: 'Steel',
  cas_number: null,
  flow_type: 'input',
  quantity: 1,
  unit: 'kg',
  characterization_factor: 1,
  impact_contribution: 1,
  category_id: 1,
  category_name: 'Global Warming',
  geographic_scope: 'Global',
  ...over,
});

const comp = (
  name: string,
  contributions: FlowContribution[],
  extra: Partial<ComponentImpactResult> = {},
): ComponentImpactResult => ({
  component_id: 1,
  component_name: name,
  component_type: 'operation',
  hierarchy_level: 4,
  impacts: [],
  flow_contributions: contributions,
  total_flows_processed: contributions.length,
  driver_flows_count: contributions.length,
  warnings: [],
  ...extra,
});

describe('classifyFactorSource', () => {
  it.each([
    ['lciafmt TRACI 2.1 (US EPA, public domain)', 'authoritative'],
    ['IPCC AR5 GWP100', 'authoritative'],
    ['Ember 2024 grid intensity', 'authoritative'],
    ['worldsteel 2023 LCI data', 'industry_average'],
    ['Industry survey, December 2023', 'industry_average'],
    ['LCAPIX legacy pack (not yet verified)', 'unverified'],
    ['representative paper; no published source cited yet (education estimate)', 'unverified'],
    ['US EPA WARM v16 (Dec 2023), Exhibit 3-11 office paper', 'authoritative'],
    ['NGA industry-average EPD ASTM-EPD121 (2019; expired 2024-12-20)', 'industry_average'],
    ['', 'unknown'],
    [null, 'unknown'],
  ])('%s -> %s', (ref, tier) => {
    expect(classifyFactorSource(ref as string | null)).toBe(tier);
  });
});

describe('effectiveAllocation (ISO 14044 4.3.4)', () => {
  it('multiplies shares down the tree; missing or invalid shares count as 1', () => {
    const m = effectiveAllocation([
      { component_id: 1, parent_component_id: null, allocation_factor: 0.5 },
      { component_id: 2, parent_component_id: 1, allocation_factor: '0.500000' },
      { component_id: 3, parent_component_id: 2 },
      { component_id: 4, parent_component_id: null, allocation_factor: 0 },
      { component_id: 5, parent_component_id: null, allocation_factor: 2 },
    ]);
    expect(m.get(1)).toBe(0.5);
    expect(m.get(2)).toBe(0.25);
    expect(m.get(3)).toBe(0.25);
    expect(m.get(4)).toBe(1);
    expect(m.get(5)).toBe(1);
  });

  it('survives a corrupt parent cycle', () => {
    const m = effectiveAllocation([
      { component_id: 1, parent_component_id: 2, allocation_factor: 0.5 },
      { component_id: 2, parent_component_id: 1, allocation_factor: 0.5 },
    ]);
    expect(Number.isFinite(m.get(1)!)).toBe(true);
  });

  it('scales impacts and every contribution, and records the share', () => {
    const r = comp('Welding', [contribution({ impact_contribution: 10 })], {
      impacts: [
        { category_id: 1, category_name: 'Global Warming', impact_value: 10, unit: 'kg CO2 eq', flow_count: 1 },
      ],
    });
    applyAllocation(r, 0.3);
    expect(r.impacts[0].impact_value).toBeCloseTo(3);
    expect(r.flow_contributions[0].impact_contribution).toBeCloseTo(3);
    expect(r.flow_contributions[0].allocation_factor).toBe(0.3);
    expect(r.allocation_factor).toBe(0.3);
  });
});

describe('summarizeDataQuality (ISO 14044 4.2.3.6)', () => {
  it('grades Global Warming by source tier and names every gap', () => {
    const dq = summarizeDataQuality(
      [
        comp(
          'Cutting',
          [
            contribution({ flow_id: 1, impact_contribution: 75, source_tier: 'authoritative', geographic_scope: 'US' }),
            contribution({ flow_id: 2, impact_contribution: 25, source_tier: 'industry_average', unit_conversion: '1 g = 0.001 kg' }),
          ],
          { excluded_flows: 1 },
        ),
        comp(
          'Welding',
          [contribution({ flow_id: 3, impact_contribution: 5, source_tier: 'authoritative', category_name: 'Acidification' })],
          { allocation_factor: 0.4 },
        ),
      ],
      { region: 'US', uncharacterized: [{ substance_name: 'Lubricating oil' }] },
    );
    expect(dq.contributions).toBe(3);
    expect(dq.gw_share_by_tier.authoritative).toBeCloseTo(0.75);
    expect(dq.gw_share_by_tier.industry_average).toBeCloseTo(0.25);
    expect(dq.regional_fallbacks).toBe(2);
    expect(dq.unit_conversions).toBe(1);
    expect(dq.excluded_flows).toBe(1);
    expect(dq.allocated_components).toBe(1);
    expect(dq.uncharacterized_flows).toBe(1);
    const text = dq.statement.join(' ');
    expect(text).toContain('75% on authoritative');
    expect(text).toContain('25% on industry-average');
    expect(text).toContain('2 of 3 contributions use a Global factor');
    expect(text).toContain('Lubricating oil');
    expect(text).toContain('Welding 40%');
  });

  it('names which substances the region actually changed, not just the fallbacks', () => {
    // The real shape of a regional run: electricity has a US factor, every
    // material is a global average. A reader should not infer that choosing US
    // regionalized the model.
    const dq = summarizeDataQuality(
      [
        comp('Cutting', [
          contribution({ flow_id: 1, substance_name: 'Electricity', geographic_scope: 'US', impact_contribution: 4 }),
          contribution({ flow_id: 2, substance_name: 'Aluminum', geographic_scope: 'Global', impact_contribution: 80 }),
          contribution({ flow_id: 3, substance_name: 'Steel', geographic_scope: 'Global', impact_contribution: 16 }),
        ]),
      ],
      { region: 'US' },
    )
    const text = dq.statement.join(' ')
    expect(text).toContain('2 of 3 contributions use a Global factor')
    expect(text).toContain('Only Electricity used a US factor')
    expect(text).not.toContain('Aluminum used a US factor')
  })

  it('says plainly when a chosen region changed nothing at all', () => {
    const dq = summarizeDataQuality(
      [comp('Cutting', [contribution({ flow_id: 1, substance_name: 'Aluminum', geographic_scope: 'Global' })])],
      { region: 'EU' },
    )
    expect(dq.statement.join(' ')).toContain('the region changed no number in this result')
  })

  it('says which categories cover only some of the inputs', () => {
    // The bike's shape: every input has a climate factor, only electricity has
    // an acidification one. The acidification total must not read as complete.
    const dq = summarizeDataQuality([
      comp('Cut', [
        contribution({ flow_id: 1, substance_name: 'Aluminum', impact_contribution: 70 }),
        contribution({ flow_id: 2, substance_name: 'Electricity', impact_contribution: 1 }),
        contribution({ flow_id: 2, substance_name: 'Electricity', impact_contribution: 0.007, category_name: 'Acidification' }),
      ]),
      comp('Pack', [contribution({ flow_id: 3, substance_name: 'Cardboard', impact_contribution: 3 })]),
    ]);
    const gw = dq.category_coverage.find((c) => c.category === 'Global Warming')!;
    const acid = dq.category_coverage.find((c) => c.category === 'Acidification')!;
    expect(gw).toMatchObject({ covered: 3, total: 3, missing_examples: [] });
    expect(acid).toMatchObject({ covered: 1, total: 3 });
    expect(acid.missing_examples).toEqual(['Aluminum', 'Cardboard']);
    const text = dq.statement.join(' ');
    expect(text).toContain('Acidification covers 1 of 3 inputs');
    expect(text).toContain('so that total is incomplete');
    expect(text).not.toContain('Global Warming covers');
  });

  it('says so when nothing was characterized', () => {
    const text = summarizeDataQuality([]).statement.join(' ');
    expect(text).toContain('nothing to grade');
    expect(text).toContain('No allocation applied');
  });
});

describe('goal & scope (ISO 14044 4.2)', () => {
  it('scales a case total to one functional unit', () => {
    expect(perFunctionalUnitScale(1, 52000)).toBeCloseTo(1 / 52000);
    expect(perFunctionalUnitScale(0.0667, 1)).toBeCloseTo(0.0667);
    expect(perFunctionalUnitScale('', null)).toBe(1);
  });

  it('merges study-level (project) and case-level fields', () => {
    const gs = buildGoalScope(
      {
        functional_unit: 'One bicycle ridden 15,000 km',
        system_boundary: 'cradle-to-gate',
        boundary_notes: 'Excludes packaging',
      },
      { reference_flow: '2.000000', reference_flow_unit: 'bike', modeled_output: '4.000000' },
    );
    expect(gs).toMatchObject({
      functional_unit: 'One bicycle ridden 15,000 km',
      reference_flow: 2,
      reference_flow_unit: 'bike',
      modeled_output: 4,
      per_fu_scale: 0.5,
      boundary_notes: 'Excludes packaging',
    });
  });

  it('falls back to defaults when the migrate-014 columns are absent', () => {
    expect(buildGoalScope({}, {})).toMatchObject({
      functional_unit: null,
      system_boundary: 'cradle-to-gate',
      reference_flow: 1,
      per_fu_scale: 1,
    });
  });

  it('is frozen into the run snapshot with data quality, source and allocation', () => {
    const r = comp('Welding', [
      contribution({ source_tier: 'authoritative', factor_source: 'IPCC AR5', allocation_factor: 0.5 }),
    ]);
    const result: LCAResult = {
      summary: {
        total_components: 1,
        components_with_flows: 1,
        total_flows_processed: 1,
        total_driver_flows: 1,
        impact_categories_calculated: 1,
        calculation_method: 'CML 2001',
        calculation_timestamp: new Date().toISOString(),
      },
      component_results: [r],
      algorithm_steps: [],
      total_impacts: [],
      warnings: [],
      data_quality: summarizeDataQuality([r]),
    };
    const snap = buildRunSnapshot(result, 'CML 2001', 'Global', buildGoalScope({ functional_unit: 'FU' }, {}));
    expect(snap.goal_scope?.functional_unit).toBe('FU');
    expect(snap.data_quality?.contributions).toBe(1);
    expect(snap.flow_detail[0]).toMatchObject({
      source_tier: 'authoritative',
      source: 'IPCC AR5',
      allocation: 0.5,
    });
  });
});

describe('unit and completeness guards', () => {
  it('labels the result with the factor numerator and warns when a category mixes units', async () => {
    const row = {
      cas_number: null,
      flow_type: 'output',
      flow_unit: 'kg',
      substance_default_unit: 'kg',
      category_id: 3,
      category_name: 'Eutrophication',
      category_unit: 'kg PO4 eq',
      characterization_factor: 1,
      factor_basis: 'elementary',
      geographic_scope: 'Global',
    };
    const conn = fakeConn([
      [{ component_id: 1, component_name: 'X', component_type: 'operation', hierarchy_level: 4 }],
      [
        { ...row, flow_id: 1, substance_id: 1, substance_name: 'A', quantity: 2, factor_unit: 'kg N eq / kg' },
        { ...row, flow_id: 2, substance_id: 2, substance_name: 'B', quantity: 1, factor_unit: 'kg PO4 eq' },
      ],
    ]);
    const r = await calculateComponentImpacts(1, conn, { method: 'TRACI 2.1' });
    expect(r.impacts[0].unit).toBe('kg N eq');
    expect(r.warnings.some((w) => /mixes reference units/.test(w))).toBe(true);
    expect(r.flow_contributions[0].source_tier).toBe('unknown');
    expect(r.characterized_flow_ids).toEqual([1, 2]);
  });

  it('leaves a flow out of the characterized set when only a wrong-direction factor exists', async () => {
    const conn = fakeConn([
      [{ component_id: 1, component_name: 'X', component_type: 'operation', hierarchy_level: 4 }],
      [
        {
          flow_id: 7, substance_id: 9, substance_name: 'Steel', cas_number: null,
          flow_type: 'output', quantity: 1, flow_unit: 'kg', substance_default_unit: 'kg',
          category_id: 1, category_name: 'Global Warming', category_unit: 'kg CO2 eq',
          factor_unit: 'kg CO2 eq / kg', characterization_factor: 1.9, factor_basis: 'embodied',
          geographic_scope: 'Global',
        },
      ],
    ]);
    const r = await calculateComponentImpacts(1, conn, {});
    expect(r.flow_contributions).toHaveLength(0);
    expect(r.characterized_flow_ids).toEqual([]);
  });
});
