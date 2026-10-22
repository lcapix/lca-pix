import { describe, it, expect } from 'vitest';
import { uiSources, type ApiSource, type Status } from '@/lib/admin/integrations';
import {
  SCHEMA_TABLES,
  SOURCE_PIPELINES,
  buildSchemaSankey,
  countWritersPerTable,
  isSankeyTableNode,
  pipelineSource,
  pipelineTotalRecords,
  routeRecords,
  schemaTableTotals,
  tableCountLabel,
  type SourcePipeline,
} from '@/lib/admin/integrations-schema';

function src(id: string, name: string): ApiSource {
  return {
    id,
    name,
    description: '',
    keyRequired: false,
    configured: true,
    status: 'success',
    events: 0,
    fails: 0,
    records: 0,
    lastSync: null,
    lastStatus: null,
    rateLimit: null,
  };
}

const STATUS: Status = {
  substances: { total: 15, enriched: 4 },
  factorsByMethod: [
    { method_name: 'CML 2001', factors: 101 },
    { method_name: 'ReCiPe', factors: '50' as unknown as number },
  ],
  rateCache: [
    { rate_type: 'labor', cnt: 7 },
    { rate_type: 'energy', cnt: 3 },
  ],
  sources: [src('openlca', 'openLCA'), src('bls', 'BLS')],
};

describe('pipeline constants', () => {
  it('lists the four tables in display order', () => {
    expect(SCHEMA_TABLES).toEqual([
      'substances',
      'valuation_methods',
      'characterization_factors',
      'cost_rates',
    ]);
  });

  it('lists the six sources in order, each writing only known tables', () => {
    expect(SOURCE_PIPELINES.map((p) => p.sourceId)).toEqual([
      'openlca',
      'pubchem',
      'electricity_maps',
      'bls',
      'eia',
      'metals',
    ]);
    for (const p of SOURCE_PIPELINES) {
      for (const r of p.routes) expect(SCHEMA_TABLES).toContain(r.table);
    }
  });
});

describe('schemaTableTotals', () => {
  it('is all zeros without a status', () => {
    expect(schemaTableTotals(null)).toEqual({
      substances: 0,
      valuation_methods: 0,
      characterization_factors: 0,
      cost_rates: 0,
    });
  });

  it('counts substances, methods, summed factors and summed rates', () => {
    expect(schemaTableTotals(STATUS)).toEqual({
      substances: 15,
      valuation_methods: 2,
      characterization_factors: 151,
      cost_rates: 10,
    });
  });

  it('treats missing counts as 0', () => {
    const s = {
      substances: {} as Status['substances'],
      factorsByMethod: [{ method_name: 'm', factors: null as unknown as number }],
      rateCache: [{ rate_type: 'r', cnt: undefined as unknown as number }],
    };
    expect(schemaTableTotals(s)).toEqual({
      substances: 0,
      valuation_methods: 1,
      characterization_factors: 0,
      cost_rates: 0,
    });
  });
});

describe('countWritersPerTable', () => {
  it('counts the sources writing each table', () => {
    expect(countWritersPerTable()).toEqual({
      substances: 2,
      valuation_methods: 1,
      characterization_factors: 2,
      cost_rates: 4,
    });
  });

  it('counts a table nobody writes as 1 and a source once per table', () => {
    const pipelines: SourcePipeline[] = [
      {
        sourceId: 'a',
        routes: [
          { table: 't1', records: 0, note: '' },
          { table: 't1', records: 0, note: '' },
        ],
      },
    ];
    expect(countWritersPerTable(pipelines, ['t1', 't2'])).toEqual({ t1: 1, t2: 1 });
  });
});

describe('buildSchemaSankey', () => {
  const uiSrc = uiSources(STATUS);
  const totals = schemaTableTotals(STATUS);
  const writers = countWritersPerTable();

  it('puts the sources first (UI name, else the pipeline id), then the tables', () => {
    const { sourceNodes, nodes } = buildSchemaSankey(uiSrc, totals, writers);
    expect(sourceNodes).toEqual([
      { name: 'openLCA', kind: 'source' },
      { name: 'pubchem', kind: 'source' },
      { name: 'electricity_maps', kind: 'source' },
      { name: 'BLS', kind: 'source' },
      { name: 'eia', kind: 'source' },
      { name: 'metals', kind: 'source' },
    ]);
    expect(nodes).toEqual([
      ...sourceNodes,
      { name: 'substances', kind: 'table' },
      { name: 'valuation_methods', kind: 'table' },
      { name: 'characterization_factors', kind: 'table' },
      { name: 'cost_rates', kind: 'table' },
    ]);
  });

  it('links each route to its table, splitting the total evenly and rounding', () => {
    const { links } = buildSchemaSankey(uiSrc, totals, writers);
    expect(links).toEqual([
      // substances 15 / 2 writers = 7.5 -> 8
      { source: 0, target: 6, value: 8, records: 8 },
      { source: 0, target: 7, value: 2, records: 2 },
      // factors 151 / 2 = 75.5 -> 76
      { source: 0, target: 8, value: 76, records: 76 },
      { source: 1, target: 6, value: 8, records: 8 },
      // cost rates 10 / 4 = 2.5 -> 3
      { source: 2, target: 9, value: 3, records: 3 },
      { source: 2, target: 8, value: 76, records: 76 },
      { source: 3, target: 9, value: 3, records: 3 },
      { source: 4, target: 9, value: 3, records: 3 },
      { source: 5, target: 9, value: 3, records: 3 },
    ]);
  });

  it('gives empty pipes a 0.5 placeholder weight but 0 records', () => {
    const { links } = buildSchemaSankey([], schemaTableTotals(null), writers);
    expect(links).toHaveLength(9);
    for (const l of links) {
      expect(l.value).toBe(0.5);
      expect(l.records).toBe(0);
    }
    // 1 / 4 writers rounds to 0 too.
    const one = buildSchemaSankey([], { cost_rates: 1 }, writers).links.find(
      (l) => l.source === 3,
    );
    expect(one).toEqual({ source: 3, target: 9, value: 0.5, records: 0 });
  });

  it('does not default a missing writer count (unlike routeRecords)', () => {
    const pipelines: SourcePipeline[] = [
      { sourceId: 'a', routes: [{ table: 't', records: 0, note: '' }] },
    ];
    const [link] = buildSchemaSankey([], { t: 4 }, {}, pipelines, ['t']).links;
    expect(link.records).toBeNaN();
    expect(link.value).toBeNaN();
  });
});

describe('isSankeyTableNode', () => {
  it('trusts the payload kind, else the index past the sources', () => {
    expect(isSankeyTableNode({ kind: 'table' }, 0, 6)).toBe(true);
    expect(isSankeyTableNode({ kind: 'source' }, 2, 6)).toBe(false);
    expect(isSankeyTableNode(undefined, 6, 6)).toBe(true);
    expect(isSankeyTableNode(undefined, 5, 6)).toBe(false);
    expect(isSankeyTableNode({ kind: 'source' }, 7, 6)).toBe(true);
  });
});

describe('pipelineSource', () => {
  it('finds the UI source by id', () => {
    const uiSrc = uiSources(STATUS);
    expect(pipelineSource(uiSrc, 'bls')?.name).toBe('BLS');
    expect(pipelineSource(uiSrc, 'eia')).toBeUndefined();
  });
});

describe('routeRecords / pipelineTotalRecords', () => {
  const totals = schemaTableTotals(STATUS);
  const writers = countWritersPerTable();

  it('splits a table total across its writers, rounded', () => {
    expect(routeRecords(totals, writers, 'substances')).toBe(8);
    expect(routeRecords(totals, writers, 'valuation_methods')).toBe(2);
    expect(routeRecords(totals, writers, 'cost_rates')).toBe(3);
  });

  it('treats a missing total as 0 and a missing writer count as 1', () => {
    expect(routeRecords({}, writers, 'substances')).toBe(0);
    expect(routeRecords({ t: 7 }, {}, 't')).toBe(7);
  });

  it('sums a source\'s routes', () => {
    const [openlca, pubchem, electricity] = SOURCE_PIPELINES;
    expect(pipelineTotalRecords(openlca, totals, writers)).toBe(8 + 2 + 76);
    expect(pipelineTotalRecords(pubchem, totals, writers)).toBe(8);
    expect(pipelineTotalRecords(electricity, totals, writers)).toBe(3 + 76);
    expect(pipelineTotalRecords(openlca, schemaTableTotals(null), writers)).toBe(0);
  });
});

describe('tableCountLabel', () => {
  it('says records only for a positive count', () => {
    expect(tableCountLabel(1)).toBe('records');
    expect(tableCountLabel(0)).toBe('empty');
    expect(tableCountLabel(-1)).toBe('empty');
  });
});
