/**
 * POST /api/ingest/apply — reviewed ingestion plan → real case, atomically.
 *
 * Body: { project_id, case_name, nodes, flows, costs, notes } — the plan a
 * user confirmed (and possibly edited: substituted matches, deselected
 * flows) on the review screen. Creates the case, the 5-tier component tree
 * (parent names remapped to new ids in order), the flows, and the aggregated
 * cost columns in ONE transaction — the whole case exists or none of it.
 *
 * Flows with no substance_id are counted as held-for-review, never silently
 * dropped; flows whose unit cannot convert into the substance's factor unit
 * are skipped and reported the same way (mirrors the save-time unit guard).
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { convertQuantity } from '@/lib/units';
import type { IngestCost, IngestNode } from '@/lib/ingest/schema';
import type { MappedFlow } from '@/lib/ingest/maplca';
import { validateProcessModel } from '@/lib/ingest/schema';

const TIER_LEVEL: Record<string, number> = {
  product: 1,
  machine_line: 2,
  subprocess: 3,
  operation: 4,
  elemental_task: 5,
};

const COST_COLUMN: Record<string, string> = {
  labor: 'labor_cost',
  energy: 'energy_cost',
  material: 'material_cost',
  transportation: 'transportation_cost',
  opex: 'opex',
  capex: 'capex',
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const body = await request.json();

    const projectId = parseInt(body.project_id);
    const caseName: string = String(body.case_name ?? '').trim();
    const nodes: IngestNode[] = Array.isArray(body.nodes) ? body.nodes : [];
    const flows: MappedFlow[] = Array.isArray(body.flows) ? body.flows : [];
    const costs: IngestCost[] = Array.isArray(body.costs) ? body.costs : [];
    const notes: string[] = Array.isArray(body.notes) ? body.notes : [];

    if (!projectId || !caseName || nodes.length === 0) {
      return NextResponse.json(
        { error: 'project_id, case_name, and at least one node are required' },
        { status: 400 }
      );
    }

    const hasAccess = await checkProjectAccess(userId, projectId, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Re-validate structure server-side — the client may have edited the plan.
    const structural = validateProcessModel({
      product_name: caseName,
      case_name: caseName,
      nodes,
      flows: [],
      costs: [],
      source_docs: [],
      notes: [],
    });
    if (structural.length) {
      return NextResponse.json(
        { error: `Plan structure invalid: ${structural.join('; ')}` },
        { status: 400 }
      );
    }

    // Factor-unit lookup for the unit guard, outside the transaction.
    const substanceIds = [...new Set(flows.map((f) => f.substance_id).filter(Boolean))] as number[];
    const unitBySubstance = new Map<number, string | null>();
    for (const sid of substanceIds) {
      const row = await queryOne<any>(`SELECT unit FROM substances WHERE substance_id = ?`, [sid]);
      unitBySubstance.set(sid, row?.unit ?? null);
    }

    const skippedFlows: string[] = [];

    const result = await transaction(async (conn) => {
      const sourceDoc = flows[0]?.provenance || costs[0]?.provenance?.doc || 'uploaded document';
      const [caseIns]: any = await conn.query(
        `INSERT INTO case_table (project_id, case_name, case_type, description)
         VALUES (?, ?, 'base', ?)`,
        [
          projectId,
          caseName,
          `Ingested from document. ${notes.join(' ')} [source: ${sourceDoc}]`.slice(0, 1000),
        ]
      );
      const caseId = caseIns.insertId;

      // Components in plan order (parents always precede children — the
      // connector emits them that way and validation guarantees the links).
      const idByName = new Map<string, number>();
      for (const n of nodes) {
        const [compIns]: any = await conn.query(
          `INSERT INTO component
             (case_id, parent_component_id, component_name, component_type,
              hierarchy_level, description, quantity, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseId,
            n.parent ? (idByName.get(n.parent) ?? null) : null,
            n.name,
            n.tier,
            TIER_LEVEL[n.tier] ?? 1,
            `${n.description ?? ''}${
              n.provenance ? ` [source: ${n.provenance.doc} · ${n.provenance.locator}]` : ''
            }`.trim() || null,
            n.quantity ?? 1.0,
            n.unit ?? 'unit',
          ]
        );
        idByName.set(n.name, compIns.insertId);
      }

      let applied = 0;
      let held = 0;
      for (const f of flows) {
        if (!f.substance_id) {
          held++;
          skippedFlows.push(`${f.substance_text} (${f.node}): no confirmed substance match`);
          continue;
        }
        const componentId = idByName.get(f.node);
        if (!componentId) {
          held++;
          skippedFlows.push(`${f.substance_text} (${f.node}): node not in plan`);
          continue;
        }
        const factorUnit = unitBySubstance.get(f.substance_id);
        if (factorUnit && !convertQuantity(1, f.unit, factorUnit)) {
          held++;
          skippedFlows.push(
            `${f.substance_text} (${f.node}): unit '${f.unit}' cannot convert to factor unit '${factorUnit}'`
          );
          continue;
        }
        await conn.query(
          `INSERT INTO flows
             (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [
            componentId,
            f.substance_id,
            f.direction,
            f.quantity,
            f.unit,
            f.provenance ? `ingested: ${f.provenance}`.slice(0, 255) : null,
          ]
        );
        applied++;
      }

      // Aggregate costs per node into the component cost columns.
      const costByNode = new Map<string, Record<string, number>>();
      for (const c of costs) {
        const col = COST_COLUMN[c.category];
        const componentId = idByName.get(c.node);
        if (!col || !componentId) continue;
        const acc = costByNode.get(c.node) ?? {};
        acc[col] = (acc[col] ?? 0) + Number(c.amount || 0);
        costByNode.set(c.node, acc);
      }
      for (const [node, cols] of costByNode) {
        const componentId = idByName.get(node)!;
        const sets = Object.keys(cols).map((k) => `${k} = ?`).join(', ');
        await conn.query(`UPDATE component SET ${sets} WHERE component_id = ?`, [
          ...Object.values(cols),
          componentId,
        ]);
      }

      return { caseId, components: idByName.size, applied, held, costNodes: costByNode.size };
    });

    return NextResponse.json(
      {
        success: true,
        case_id: result.caseId,
        case_name: caseName,
        components_created: result.components,
        flows_applied: result.applied,
        flows_held_for_review: result.held,
        held_details: skippedFlows,
        cost_nodes: result.costNodes,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Ingest apply error:', error);
    return NextResponse.json({ error: 'Failed to apply ingestion plan' }, { status: 500 });
  }
}
