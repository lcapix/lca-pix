'use client';

import { uiSources, type Status } from '@/lib/admin/integrations';
import {
  buildSchemaSankey,
  countWritersPerTable,
  schemaTableTotals,
} from '@/lib/admin/integrations-schema';
import { SchemaTableSummary } from './schema-table-summary';
import { SchemaFlowSankey } from './schema-flow-sankey';
import { SchemaPipelines } from './schema-pipelines';

/** Schema tab: table totals, the source → table Sankey and pipeline cards. */
export function SchemaTab({ status }: { status: Status | null }) {
  const uiSrc = uiSources(status);
  // Per-table totals — REAL counts derived from /api/integrations/status
  // (substance master, LCIA methods, characterization factors, cost rates)
  // instead of the former hardcoded per-route numbers.
  const tableTotals = schemaTableTotals(status);
  // How many sources write into each table — used to split a table's REAL
  // record total evenly across its inbound pipes.
  const writersPerTable = countWritersPerTable();
  // Build Sankey nodes + links. Recharts requires numeric src/target indices.
  const { sourceNodes, nodes, links } = buildSchemaSankey(uiSrc, tableTotals, writersPerTable);

  return (
    <>
      {/* Summary row — how many records each table holds across sources */}
      <SchemaTableSummary tableTotals={tableTotals} />

      {/* Sankey — the actual flow diagram */}
      <SchemaFlowSankey nodes={nodes} links={links} sourceCount={sourceNodes.length} />

      {/* Per-source pipeline cards — explicit "X feeds Y" with counts */}
      <SchemaPipelines
        uiSrc={uiSrc}
        tableTotals={tableTotals}
        writersPerTable={writersPerTable}
      />
    </>
  );
}
