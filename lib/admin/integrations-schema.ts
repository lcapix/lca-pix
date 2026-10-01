// Admin → Integrations, Schema tab: which tables each integration writes to,
// the real per-table record totals, and the Sankey nodes/links that draw
// "source → table".
//
// Pure module: no React, no DOM, no fetch.

import type { Status, UISource } from '@/lib/admin/integrations';

/** The tables integrations write into, in display order. */
export const SCHEMA_TABLES = [
  'substances',
  'valuation_methods',
  'characterization_factors',
  'cost_rates',
];

// Per-source pipeline: which tables it writes to, what each write means,
// and a current record count + freshness so the user can reason about it.
/** One "source writes into table" route. */
export interface PipelineRoute {
  table: (typeof SCHEMA_TABLES)[number];
  records: number;
  note: string;
}
/** All the routes one source writes. */
export interface SourcePipeline {
  sourceId: string;
  routes: PipelineRoute[];
}
/** Every integration's pipeline, in display (and Sankey node) order. */
export const SOURCE_PIPELINES: SourcePipeline[] = [
  {
    sourceId: 'openlca',
    routes: [
      { table: 'substances', records: 15, note: 'Substance master list with CAS numbers' },
      { table: 'valuation_methods', records: 8, note: 'LCIA methods (CML 2001, ReCiPe…)' },
      { table: 'characterization_factors', records: 18, note: 'Method × category × substance factors' },
    ],
  },
  {
    sourceId: 'pubchem',
    routes: [
      { table: 'substances', records: 1, note: 'Hazard data + formulas (enrichment)' },
    ],
  },
  {
    sourceId: 'electricity_maps',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Grid carbon-intensity rate per region' },
      { table: 'characterization_factors', records: 0, note: 'Real-time GWP factors for electricity' },
    ],
  },
  {
    sourceId: 'bls',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Median hourly wages by occupation' },
    ],
  },
  {
    sourceId: 'eia',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Energy price per fuel + region' },
    ],
  },
  {
    sourceId: 'metals',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Spot prices for metal commodities' },
    ],
  },
];

/**
 * Per-table totals — REAL counts derived from /api/integrations/status
 * (substance master, LCIA methods, characterization factors, cost rates)
 * instead of the former hardcoded per-route numbers.
 */
export function schemaTableTotals(status: Status | null): Record<string, number> {
  const factorsTotal = (status?.factorsByMethod ?? []).reduce(
    (s, m) => s + Number(m.factors ?? 0),
    0,
  );
  const ratesTotal = (status?.rateCache ?? []).reduce(
    (s, r) => s + Number(r.cnt ?? 0),
    0,
  );
  const tableTotals: Record<string, number> = {
    substances: Number(status?.substances?.total ?? 0),
    valuation_methods: (status?.factorsByMethod ?? []).length,
    characterization_factors: factorsTotal,
    cost_rates: ratesTotal,
  };
  return tableTotals;
}

/**
 * How many sources write into each table — used to split a table's REAL
 * record total evenly across its inbound pipes (we don't track per-source
 * provenance per row, so an even split is the honest approximation rather
 * than a fabricated per-edge count). A table nobody writes counts as 1.
 */
export function countWritersPerTable(
  pipelines: SourcePipeline[] = SOURCE_PIPELINES,
  tables: string[] = SCHEMA_TABLES,
): Record<string, number> {
  return tables.reduce<Record<string, number>>((acc, t) => {
    acc[t] = pipelines.filter((p) => p.routes.some((r) => r.table === t)).length || 1;
    return acc;
  }, {});
}

/** A Sankey node: an integration on the left or a table on the right. */
export type SankeyNode =
  | { name: string; kind: 'source' }
  | { name: string; kind: 'table' };

/** A Sankey link between node indices; `records` is the shown count. */
export interface SankeyLink {
  source: number;
  target: number;
  value: number;
  records: number;
}

/**
 * Build Sankey nodes + links. Recharts requires numeric src/target indices:
 * source nodes come first (named after the matching UI source, else the
 * pipeline id), then one node per table. Each link carries the table's
 * total split evenly across its writers, rounded. Sankey requires every
 * link to have a strictly positive value, so zero-record pipes get a tiny
 * placeholder weight (0.5) so the wiring still renders.
 */
export function buildSchemaSankey(
  uiSrc: UISource[],
  tableTotals: Record<string, number>,
  writersPerTable: Record<string, number>,
  pipelines: SourcePipeline[] = SOURCE_PIPELINES,
  tables: string[] = SCHEMA_TABLES,
): {
  sourceNodes: Array<{ name: string; kind: 'source' }>;
  nodes: SankeyNode[];
  links: SankeyLink[];
} {
  const sourceNodes = pipelines.map((p) => {
    const src = uiSrc.find((s) => s.id === p.sourceId);
    return { name: src?.name ?? p.sourceId, kind: 'source' as const };
  });
  const tableNodes = tables.map((t) => ({
    name: t,
    kind: 'table' as const,
  }));
  const nodes = [...sourceNodes, ...tableNodes];
  const tableOffset = sourceNodes.length;
  const links = pipelines.flatMap((p, srcIdx) =>
    p.routes.map((r) => {
      const share = Math.round((tableTotals[r.table] ?? 0) / writersPerTable[r.table]);
      return {
        source: srcIdx,
        target: tableOffset + tables.indexOf(r.table),
        value: Math.max(share, 0.5),
        records: share,
      };
    }),
  );
  return { sourceNodes, nodes, links };
}

/**
 * Whether a rendered Sankey node is a table: its payload says so, or its
 * index is past the source nodes.
 */
export function isSankeyTableNode(
  payload: { kind?: string } | undefined,
  index: number,
  sourceCount: number,
): boolean {
  return payload?.kind === 'table' || index >= sourceCount;
}

/** The UI source a pipeline belongs to, if the status lists it. */
export function pipelineSource(uiSrc: UISource[], sourceId: string): UISource | undefined {
  return uiSrc.find((s) => s.id === sourceId);
}

/**
 * Real per-table share for one route: the table total divided by the
 * number of writers (1 when unknown), rounded.
 */
export function routeRecords(
  tableTotals: Record<string, number>,
  writersPerTable: Record<string, number>,
  table: string,
): number {
  return Math.round((tableTotals[table] ?? 0) / (writersPerTable[table] ?? 1));
}

/** A source's per-table shares summed across its destination tables. */
export function pipelineTotalRecords(
  pipeline: SourcePipeline,
  tableTotals: Record<string, number>,
  writersPerTable: Record<string, number>,
): number {
  return pipeline.routes.reduce(
    (s, r) => s + routeRecords(tableTotals, writersPerTable, r.table),
    0,
  );
}

/** The caption under a table's count on the summary row. */
export function tableCountLabel(n: number): string {
  return n > 0 ? 'records' : 'empty';
}
